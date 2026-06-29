const DATA_URL = new URL("./data/comics.json", import.meta.url);
const BATCH_SIZE = 14;
const THEME_STORAGE_KEY = "doa-reader-theme";
const LAST_VIEWED_STORAGE_KEY = "doa-reader-current-index";
const BOOKMARK_SLUG_KEY = "doa-reader-bookmark-slug";
const BOOKMARK_INDEX_KEY = "doa-reader-bookmark-index";

const els = {
  feed: document.querySelector("#comicFeed"),
  sentinel: document.querySelector("#sentinel"),
  archiveStatus: document.querySelector("#archiveStatus"),
  template: document.querySelector("#comicTemplate"),
  themeButton: document.querySelector("#themeButton"),
  firstButton: document.querySelector("#firstButton"),
  resumeButton: document.querySelector("#resumeButton"),
  latestButton: document.querySelector("#latestButton"),
  timelineTrack: document.querySelector("#timelineTrack"),
  timelineTicks: document.querySelector("#timelineTicks"),
  timelineProgress: document.querySelector("#timelineProgress"),
  timelineThumb: document.querySelector("#timelineThumb"),
  timelineBubble: document.querySelector("#timelineBubble"),
  currentYear: document.querySelector("#currentYear"),
  currentDate: document.querySelector("#currentDate"),
  currentTitle: document.querySelector("#currentTitle"),
  yearSelect: document.querySelector("#yearSelect"),
  monthSelect: document.querySelector("#monthSelect"),
  daySelect: document.querySelector("#daySelect"),
  jumpButton: document.querySelector("#jumpButton"),
};

let archive = [];
let dateIndex = new Map();
let renderedUntil = 0;
let currentIndex = 0;
let dragIndex = 0;
let userIsDragging = false;
let suppressSelectUpdates = false;

const monthFormatter = new Intl.DateTimeFormat(undefined, { month: "short", timeZone: "UTC" });
const dateFormatter = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

boot();

async function boot() {
  initThemeToggle();

  try {
    const response = await fetch(DATA_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`Archive request failed: ${response.status}`);
    const payload = await response.json();
    archive = payload.comics
      .map(normalizeComic)
      .filter((comic) => comic.image)
      .sort((a, b) => a.timestamp - b.timestamp);

    if (!archive.length) throw new Error("Archive is empty");

    buildDateIndex();
    renderTimelineTicks();
    populateYearSelect();
    bindEvents();
    updateBookmarkUi();

    const requestedIndex = getRequestedIndex();
    startAt(requestedIndex, { scrollToTop: true, replaceUrl: false });
    els.archiveStatus.textContent = `${archive.length.toLocaleString()} comics indexed`;
  } catch (error) {
    els.archiveStatus.textContent = "Archive unavailable";
    els.feed.innerHTML = `<div class="error-state"><strong>Could not load the archive.</strong><br>${escapeHtml(error.message)}</div>`;
    console.error(error);
  }
}

function initThemeToggle() {
  setTheme(getTheme(), { persist: false });
  els.themeButton.addEventListener("click", () => {
    setTheme(getTheme() === "dark" ? "light" : "dark");
  });
}

function getTheme() {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function setTheme(theme, options = {}) {
  const nextTheme = theme === "dark" ? "dark" : "light";
  const isDark = nextTheme === "dark";
  document.documentElement.dataset.theme = nextTheme;
  els.themeButton.setAttribute("aria-pressed", String(isDark));
  els.themeButton.setAttribute("aria-label", isDark ? "Use light mode" : "Use dark mode");
  els.themeButton.title = isDark ? "Use light mode" : "Use dark mode";

  if (options.persist === false) return;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  } catch {
    // Theme persistence is a convenience; the toggle should still work without storage.
  }
}

function normalizeComic(comic, index) {
  const timestamp = Date.parse(comic.publishedAt);
  const date = Number.isFinite(timestamp) ? new Date(timestamp) : new Date();
  const dateKey = date.toISOString().slice(0, 10);
  return {
    ...comic,
    index,
    timestamp: date.getTime(),
    dateKey,
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    imageWidth: Number(comic.imageWidth) || 1000,
    imageHeight: Number(comic.imageHeight) || 333,
    hoverText: String(comic.hoverText || "").trim(),
    comments: Number(comic.comments) || 0,
  };
}

function bindEvents() {
  els.firstButton.addEventListener("click", () => startAt(0, { scrollToTop: true }));
  els.latestButton.addEventListener("click", () => startAt(archive.length - 1, { scrollToTop: true }));
  els.resumeButton.addEventListener("click", () => {
    const bookmarkedIndex = getBookmarkedIndex();
    if (bookmarkedIndex !== null) {
      startAt(bookmarkedIndex, { scrollToTop: true });
    }
  });

  els.jumpButton.addEventListener("click", () => jumpToSelectedDate());
  els.yearSelect.addEventListener("change", () => {
    if (suppressSelectUpdates) return;
    populateMonthSelect(Number(els.yearSelect.value));
    populateDaySelect(Number(els.yearSelect.value), Number(els.monthSelect.value));
  });
  els.monthSelect.addEventListener("change", () => {
    if (suppressSelectUpdates) return;
    populateDaySelect(Number(els.yearSelect.value), Number(els.monthSelect.value));
  });

  els.timelineTrack.addEventListener("pointerdown", onTimelinePointerDown);
  els.timelineTrack.addEventListener("keydown", onTimelineKeyDown);
  window.addEventListener("scroll", requestVisibleUpdate, { passive: true });
  window.addEventListener("resize", () => updateTimelineForIndex(currentIndex));

  const loader = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) appendNextBatch();
  }, { rootMargin: "900px 0px" });
  loader.observe(els.sentinel);
}

function startAt(index, options = {}) {
  currentIndex = clampIndex(index);
  renderedUntil = currentIndex;
  els.feed.textContent = "";
  appendNextBatch();
  updateTimelineForIndex(currentIndex);
  updateDateSelects(archive[currentIndex]);
  localStorage.setItem(LAST_VIEWED_STORAGE_KEY, String(currentIndex));

  if (options.scrollToTop) {
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "auto" }));
  }

  if (options.replaceUrl !== false) {
    const url = new URL(window.location.href);
    url.searchParams.set("from", archive[currentIndex].dateKey);
    history.replaceState(null, "", url);
  }
}

function appendNextBatch() {
  if (!archive.length || renderedUntil >= archive.length) return;
  const fragment = document.createDocumentFragment();
  const end = Math.min(renderedUntil + BATCH_SIZE, archive.length);

  for (let index = renderedUntil; index < end; index += 1) {
    fragment.append(createComicCard(archive[index], index));
  }

  renderedUntil = end;
  els.feed.append(fragment);
}

function createComicCard(comic, index) {
  const node = els.template.content.firstElementChild.cloneNode(true);
  node.dataset.index = String(index);

  const toggle = node.querySelector(".comic-toggle");
  const image = node.querySelector(".comic-image");
  const details = node.querySelector(".comic-details");
  const detailRow = node.querySelector(".detail-row");
  const iframe = node.querySelector(".comments-frame");

  node.querySelector(".comic-title").textContent = comic.title;
  node.querySelector(".comic-date").textContent = formatComicDate(comic);
  node.querySelector(".comment-count").textContent = `${comic.comments.toLocaleString()} comments`;
  node.querySelector(".detail-posted").textContent = formatComicDate(comic);
  node.querySelector(".detail-comments").textContent = comic.comments.toLocaleString();
  const hoverDetail = node.querySelector(".hover-detail");
  const hoverText = node.querySelector(".detail-hover");
  if (comic.hoverText) {
    detailRow.classList.add("has-hover");
    hoverDetail.hidden = false;
    hoverText.textContent = comic.hoverText;
    toggle.title = comic.hoverText;
  }

  const sourceLink = node.querySelector(".source-link");
  sourceLink.href = comic.link;

  const bookmarkButton = node.querySelector(".bookmark-button");
  bookmarkButton.addEventListener("click", () => setBookmark(index));

  image.referrerPolicy = "no-referrer";
  image.src = comic.image;
  image.alt = comic.hoverText || comic.title;
  if (comic.hoverText) image.title = comic.hoverText;
  image.width = comic.imageWidth;
  image.height = comic.imageHeight;

  iframe.title = `Comments for ${comic.title}`;
  iframe.dataset.src = `${comic.link}#comments`;

  const expand = () => {
    const isExpanded = node.classList.toggle("is-expanded");
    details.hidden = !isExpanded;
    toggle.setAttribute("aria-expanded", String(isExpanded));
    if (isExpanded && !iframe.src) iframe.src = iframe.dataset.src;
  };

  toggle.addEventListener("click", expand);
  image.addEventListener("click", expand);
  updateBookmarkButton(bookmarkButton, index);
  return node;
}

function setBookmark(index) {
  const comic = archive[clampIndex(index)];
  localStorage.setItem(BOOKMARK_SLUG_KEY, comic.slug);
  localStorage.setItem(BOOKMARK_INDEX_KEY, String(comic.index));
  updateBookmarkUi();
}

function getBookmarkedIndex() {
  const slug = localStorage.getItem(BOOKMARK_SLUG_KEY);
  if (slug) {
    const bySlug = archive.findIndex((comic) => comic.slug === slug);
    if (bySlug >= 0) return bySlug;
  }

  const savedValue = localStorage.getItem(BOOKMARK_INDEX_KEY);
  if (savedValue === null) return null;

  const savedIndex = Number(savedValue);
  return Number.isFinite(savedIndex) ? clampIndex(savedIndex) : null;
}

function updateBookmarkUi() {
  const bookmarkedIndex = getBookmarkedIndex();
  if (bookmarkedIndex === null) {
    els.resumeButton.disabled = true;
    els.resumeButton.textContent = "No Bookmark";
    els.resumeButton.title = "Bookmark a comic first";
  } else {
    const comic = archive[bookmarkedIndex];
    els.resumeButton.disabled = false;
    els.resumeButton.textContent = "Resume Bookmark";
    els.resumeButton.title = `${comic.title} - ${formatComicDate(comic)}`;
  }

  document.querySelectorAll(".bookmark-button").forEach((button) => {
    const card = button.closest(".comic-card");
    updateBookmarkButton(button, Number(card?.dataset.index));
  });
}

function updateBookmarkButton(button, index) {
  const bookmarkedIndex = getBookmarkedIndex();
  const isBookmarked = bookmarkedIndex !== null && index === bookmarkedIndex;
  button.classList.toggle("is-bookmarked", isBookmarked);
  button.setAttribute("aria-pressed", String(isBookmarked));
  button.setAttribute("aria-label", isBookmarked ? "Saved bookmark" : "Bookmark this comic");
  button.title = isBookmarked ? "This is your saved bookmark" : "Save this comic as your bookmark";
}

function requestVisibleUpdate() {
  if (requestVisibleUpdate.pending) return;
  requestVisibleUpdate.pending = true;
  requestAnimationFrame(() => {
    requestVisibleUpdate.pending = false;
    const nextIndex = getVisibleCardIndex();
    if (nextIndex !== null && nextIndex !== currentIndex) {
      currentIndex = nextIndex;
      localStorage.setItem(LAST_VIEWED_STORAGE_KEY, String(currentIndex));
      updateTimelineForIndex(currentIndex);
      updateDateSelects(archive[currentIndex]);
    }
  });
}

function getVisibleCardIndex() {
  const cards = [...document.querySelectorAll(".comic-card")];
  if (!cards.length) return null;
  const targetY = Math.max(92, window.innerHeight * 0.22);
  let best = null;
  let bestDistance = Infinity;
  for (const card of cards) {
    const rect = card.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > window.innerHeight) continue;
    const distance = Math.abs(rect.top - targetY);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = Number(card.dataset.index);
    }
  }
  return best;
}

function onTimelinePointerDown(event) {
  userIsDragging = true;
  els.timelineTrack.classList.add("is-dragging");
  els.timelineTrack.setPointerCapture(event.pointerId);
  previewTimelineAt(event.clientY);

  const move = (moveEvent) => previewTimelineAt(moveEvent.clientY);
  const up = () => {
    userIsDragging = false;
    els.timelineTrack.classList.remove("is-dragging");
    els.timelineTrack.removeEventListener("pointermove", move);
    els.timelineTrack.removeEventListener("pointerup", up);
    els.timelineTrack.removeEventListener("pointercancel", up);
    startAt(dragIndex, { scrollToTop: true });
  };

  els.timelineTrack.addEventListener("pointermove", move);
  els.timelineTrack.addEventListener("pointerup", up);
  els.timelineTrack.addEventListener("pointercancel", up);
}

function previewTimelineAt(clientY) {
  dragIndex = indexFromTrackY(clientY);
  updateTimelineForIndex(dragIndex, { preview: true });
}

function indexFromTrackY(clientY) {
  const rect = els.timelineTrack.getBoundingClientRect();
  const ratio = clamp((clientY - rect.top) / rect.height, 0, 1);
  return clampIndex(Math.round(ratio * (archive.length - 1)));
}

function onTimelineKeyDown(event) {
  const steps = {
    ArrowUp: -1,
    ArrowDown: 1,
    PageUp: -30,
    PageDown: 30,
    Home: -Infinity,
    End: Infinity,
  };

  if (!(event.key in steps)) return;
  event.preventDefault();
  const step = steps[event.key];
  const nextIndex = step === Infinity ? archive.length - 1 : step === -Infinity ? 0 : currentIndex + step;
  startAt(nextIndex, { scrollToTop: true });
}

function updateTimelineForIndex(index, options = {}) {
  if (!archive.length) return;
  const comic = archive[clampIndex(index)];
  const ratio = archive.length === 1 ? 0 : index / (archive.length - 1);
  const percent = `${ratio * 100}%`;

  els.timelineThumb.style.top = percent;
  els.timelineProgress.style.height = percent;
  els.timelineBubble.style.top = percent;
  els.timelineBubble.textContent = `${comic.dateKey} ${comic.title}`;

  if (!options.preview || !userIsDragging) {
    els.currentYear.textContent = String(comic.year);
    els.currentDate.textContent = formatComicDate(comic);
    els.currentTitle.textContent = comic.title;
    els.timelineTrack.setAttribute("aria-valuemax", String(archive.length - 1));
    els.timelineTrack.setAttribute("aria-valuenow", String(index));
    els.timelineTrack.setAttribute("aria-valuetext", `${comic.dateKey} ${comic.title}`);
  }
}

function renderTimelineTicks() {
  els.timelineTicks.textContent = "";
  const years = [...new Set(archive.map((comic) => comic.year))];
  const fragment = document.createDocumentFragment();
  for (const year of years) {
    const firstIndex = archive.findIndex((comic) => comic.year === year);
    const tick = document.createElement("div");
    tick.className = "timeline-tick";
    tick.style.top = `${(firstIndex / (archive.length - 1)) * 100}%`;
    tick.textContent = String(year);
    fragment.append(tick);
  }
  els.timelineTicks.append(fragment);
}

function buildDateIndex() {
  dateIndex = new Map();
  for (const comic of archive) {
    if (!dateIndex.has(comic.dateKey)) dateIndex.set(comic.dateKey, comic.index);
  }
}

function populateYearSelect() {
  const years = [...new Set(archive.map((comic) => comic.year))];
  els.yearSelect.replaceChildren(...years.map((year) => option(String(year), String(year))));
  populateMonthSelect(years[0]);
}

function populateMonthSelect(year) {
  const months = [...new Set(archive.filter((comic) => comic.year === year).map((comic) => comic.month))];
  els.monthSelect.replaceChildren(...months.map((month) => {
    const label = monthFormatter.format(new Date(Date.UTC(2020, month - 1, 1)));
    return option(String(month).padStart(2, "0"), label);
  }));
  populateDaySelect(year, months[0]);
}

function populateDaySelect(year, month) {
  const days = [...new Set(archive
    .filter((comic) => comic.year === year && comic.month === month)
    .map((comic) => comic.day))];
  els.daySelect.replaceChildren(...days.map((day) => option(String(day).padStart(2, "0"), String(day).padStart(2, "0"))));
}

function updateDateSelects(comic) {
  suppressSelectUpdates = true;
  if (els.yearSelect.value !== String(comic.year)) {
    els.yearSelect.value = String(comic.year);
    populateMonthSelect(comic.year);
  }
  els.monthSelect.value = String(comic.month).padStart(2, "0");
  populateDaySelect(comic.year, comic.month);
  els.daySelect.value = String(comic.day).padStart(2, "0");
  suppressSelectUpdates = false;
}

function jumpToSelectedDate() {
  const key = [
    els.yearSelect.value,
    els.monthSelect.value,
    els.daySelect.value,
  ].join("-");

  if (dateIndex.has(key)) {
    startAt(dateIndex.get(key), { scrollToTop: true });
    return;
  }

  const target = Date.parse(`${key}T00:00:00Z`);
  const index = archive.findIndex((comic) => comic.timestamp >= target);
  startAt(index === -1 ? archive.length - 1 : index, { scrollToTop: true });
}

function getRequestedIndex() {
  const params = new URLSearchParams(window.location.search);
  const slug = params.get("comic");
  if (slug) {
    const bySlug = archive.findIndex((comic) => comic.slug === slug);
    if (bySlug >= 0) return bySlug;
  }

  const from = params.get("from");
  if (from) {
    if (dateIndex.has(from)) return dateIndex.get(from);
    const target = Date.parse(`${from}T00:00:00Z`);
    const byDate = archive.findIndex((comic) => comic.timestamp >= target);
    if (byDate >= 0) return byDate;
  }

  const saved = Number(localStorage.getItem(LAST_VIEWED_STORAGE_KEY));
  return Number.isFinite(saved) ? clampIndex(saved) : 0;
}

function option(value, label) {
  const element = document.createElement("option");
  element.value = value;
  element.textContent = label;
  return element;
}

function formatComicDate(comic) {
  return dateFormatter.format(new Date(comic.timestamp));
}

function clampIndex(index) {
  return Math.min(Math.max(Number(index) || 0, 0), Math.max(archive.length - 1, 0));
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]);
}

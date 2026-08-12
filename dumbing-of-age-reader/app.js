import { applySegmentStyle, decorateArchive, isSegmentBoundary } from "./metadata.js";

const DATA_URL = new URL("./data/comics.json", import.meta.url);
const BATCH_SIZE = 14;
const THEME_STORAGE_KEY = "doa-reader-theme";
const LAST_VIEWED_STORAGE_KEY = "doa-reader-current-index";
const BOOKMARK_SLUG_KEY = "doa-reader-bookmark-slug";
const BOOKMARK_INDEX_KEY = "doa-reader-bookmark-index";
const FAVORITES_KEY = "doa-reader-favorite-slugs";
const SYNC_URL_PARAM = "sync";
const SYNC_PREFIX = "doa-sync:";

const els = {
  feed: document.querySelector("#comicFeed"),
  sentinel: document.querySelector("#sentinel"),
  archiveStatus: document.querySelector("#archiveStatus"),
  template: document.querySelector("#comicTemplate"),
  themeButton: document.querySelector("#themeButton"),
  firstButton: document.querySelector("#firstButton"),
  resumeButton: document.querySelector("#resumeButton"),
  favoritesMenu: document.querySelector("#favoritesMenu"),
  favoritesSummary: document.querySelector("#favoritesSummary"),
  favoritesList: document.querySelector("#favoritesList"),
  clearFavoritesButton: document.querySelector("#clearFavoritesButton"),
  syncMenu: document.querySelector("#syncMenu"),
  syncKeyField: document.querySelector("#syncKeyField"),
  syncStatus: document.querySelector("#syncStatus"),
  createSyncKeyButton: document.querySelector("#createSyncKeyButton"),
  copySyncKeyButton: document.querySelector("#copySyncKeyButton"),
  copySyncLinkButton: document.querySelector("#copySyncLinkButton"),
  importSyncKeyButton: document.querySelector("#importSyncKeyButton"),
  latestButton: document.querySelector("#latestButton"),
  timelinePanel: document.querySelector("#timelinePanel"),
  timelineMiniRail: document.querySelector("#timelineMiniRail"),
  timelineTrack: document.querySelector("#timelineTrack"),
  timelineSegments: document.querySelector("#timelineSegments"),
  timelineTicks: document.querySelector("#timelineTicks"),
  timelineMilestones: document.querySelector("#timelineMilestones"),
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
let syncStatusTimer = 0;

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
    archive = decorateArchive(payload.comics
      .map(normalizeComic)
      .filter((comic) => comic.image)
      .sort((a, b) => a.timestamp - b.timestamp));

    if (!archive.length) throw new Error("Archive is empty");

    buildDateIndex();
    renderTimelineTicks();
    populateYearSelect();
    bindEvents();
    updateBookmarkUi();
    updateFavoritesUi();
    updateSyncButtons();

    const syncedIndex = importSyncFromUrl();
    const requestedIndex = syncedIndex ?? getRequestedIndex();
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
  els.clearFavoritesButton.addEventListener("click", () => {
    setFavoriteSlugs([]);
    updateFavoritesUi();
  });
  els.createSyncKeyButton.addEventListener("click", createSyncKey);
  els.copySyncKeyButton.addEventListener("click", () => copySyncText(els.syncKeyField.value, "Key copied"));
  els.copySyncLinkButton.addEventListener("click", () => copySyncText(createSyncLink(), "Link copied"));
  els.importSyncKeyButton.addEventListener("click", () => importSyncText(els.syncKeyField.value));
  els.syncKeyField.addEventListener("input", updateSyncButtons);

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
  els.timelinePanel.addEventListener("pointerdown", () => els.timelinePanel.classList.add("is-peeking"));
  els.timelinePanel.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      els.timelinePanel.classList.remove("is-peeking");
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      els.timelinePanel.classList.add("is-peeking");
    }
  });
  document.addEventListener("pointerdown", (event) => {
    if (!els.timelinePanel.contains(event.target)) els.timelinePanel.classList.remove("is-peeking");
  }, true);
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
  const feedWasEmpty = !els.feed.childElementCount;

  for (let index = renderedUntil; index < end; index += 1) {
    const comic = archive[index];
    if (isSegmentBoundary(comic) || (feedWasEmpty && index === currentIndex)) {
      fragment.append(createSegmentBanner(comic));
    }
    fragment.append(createComicCard(archive[index], index));
  }

  renderedUntil = end;
  els.feed.append(fragment);
}

function createSegmentBanner(comic) {
  const banner = document.createElement("section");
  banner.className = "segment-banner";
  applySegmentStyle(banner, comic);

  const kicker = document.createElement("span");
  kicker.className = "segment-kicker";
  kicker.textContent = `${comic.book.label} · ${comic.storyline.label}`;

  const title = document.createElement("strong");
  title.className = "segment-title";
  title.textContent = comic.storyline.name;

  const bookTitle = document.createElement("span");
  bookTitle.className = "segment-book-title";
  bookTitle.textContent = comic.book.fullTitle;

  const meta = document.createElement("span");
  meta.className = "segment-meta";
  meta.textContent = comic.storyline.starts ? `Begins ${formatComicDate(comic)}` : `Showing from ${formatComicDate(comic)}`;

  const chips = document.createElement("span");
  chips.className = "segment-chips";
  if (comic.book.starts) chips.append(chip("Book shift"));
  if (comic.storyline.starts) chips.append(chip("Storyline shift"));
  if (!comic.book.starts && !comic.storyline.starts) chips.append(chip("Segment context"));
  if (comic.authorEvent) chips.append(chip(comic.authorEvent.label, "event"));

  banner.append(kicker, title, bookTitle, meta, chips);
  return banner;
}

function createComicCard(comic, index) {
  const node = els.template.content.firstElementChild.cloneNode(true);
  node.dataset.index = String(index);
  applySegmentStyle(node, comic);

  const toggle = node.querySelector(".comic-toggle");
  const image = node.querySelector(".comic-image");
  const details = node.querySelector(".comic-details");
  const detailRow = node.querySelector(".detail-row");
  const iframe = node.querySelector(".comments-frame");
  const meta = node.querySelector(".comic-meta");

  node.querySelector(".comic-title").textContent = comic.title;
  node.querySelector(".comic-date").textContent = formatComicDate(comic);
  meta.append(createComicChips(comic));
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

  const favoriteButton = node.querySelector(".favorite-button");
  favoriteButton.addEventListener("click", () => toggleFavorite(index));

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
  updateFavoriteButton(favoriteButton, index);
  updateBookmarkButton(bookmarkButton, index);
  return node;
}

function createComicChips(comic) {
  const chips = document.createElement("span");
  chips.className = "comic-chips";
  chips.append(chip(comic.book.label), chip(comic.storyline.name));
  if (comic.authorEvent) chips.append(chip(comic.authorEvent.label, "event"));
  return chips;
}

function chip(label, variant = "") {
  const element = document.createElement("span");
  element.className = variant ? `comic-chip comic-chip-${variant}` : "comic-chip";
  element.textContent = label;
  return element;
}

function createSyncKey() {
  const key = encodeSyncPayload(createSyncPayload());
  els.syncKeyField.value = key;
  updateSyncButtons();
  setSyncStatus("Key ready");
}

function createSyncPayload() {
  const bookmarkIndex = getBookmarkedIndex();
  const lastViewedIndex = getSavedLastViewedIndex();
  return {
    type: "doa-reader-sync",
    version: 1,
    savedAt: new Date().toISOString(),
    bookmark: bookmarkIndex === null ? null : archive[bookmarkIndex].slug,
    bookmarkIndex,
    lastViewed: archive[lastViewedIndex]?.slug || null,
    lastViewedIndex,
    favorites: getFavoriteSlugs(),
    theme: getTheme(),
  };
}

function importSyncFromUrl() {
  const url = new URL(window.location.href);
  const key = url.searchParams.get(SYNC_URL_PARAM);
  if (!key) return null;

  try {
    const targetIndex = applySyncPayload(decodeSyncPayload(key));
    els.syncKeyField.value = key;
    updateSyncButtons();
    setSyncStatus("Synced");
    url.searchParams.delete(SYNC_URL_PARAM);
    history.replaceState(null, "", url);
    return targetIndex;
  } catch (error) {
    console.warn(error);
    setSyncStatus("Invalid key", "error");
    return null;
  }
}

function importSyncText(value) {
  try {
    const targetIndex = applySyncPayload(decodeSyncPayload(value));
    updateSyncButtons();
    setSyncStatus("Synced");
    if (targetIndex !== null) startAt(targetIndex, { scrollToTop: true });
  } catch (error) {
    console.warn(error);
    setSyncStatus("Invalid key", "error");
  }
}

function applySyncPayload(payload) {
  if (!payload || payload.type !== "doa-reader-sync" || payload.version !== 1) {
    throw new Error("Unsupported sync payload");
  }

  const importedFavorites = Array.isArray(payload.favorites) ? payload.favorites : [];
  setFavoriteSlugs([...importedFavorites, ...getFavoriteSlugs()].filter((slug) => findComicIndexBySlugOrIndex(slug) !== null));

  const bookmarkIndex = findComicIndexBySlugOrIndex(payload.bookmark, payload.bookmarkIndex);
  if (bookmarkIndex !== null) {
    const comic = archive[bookmarkIndex];
    localStorage.setItem(BOOKMARK_SLUG_KEY, comic.slug);
    localStorage.setItem(BOOKMARK_INDEX_KEY, String(bookmarkIndex));
  }

  if (payload.theme === "light" || payload.theme === "dark") {
    setTheme(payload.theme);
  }

  const lastViewedIndex = findComicIndexBySlugOrIndex(payload.lastViewed, payload.lastViewedIndex);
  if (lastViewedIndex !== null) {
    localStorage.setItem(LAST_VIEWED_STORAGE_KEY, String(lastViewedIndex));
  }

  updateBookmarkUi();
  updateFavoritesUi();
  return lastViewedIndex ?? bookmarkIndex;
}

function encodeSyncPayload(payload) {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  return `${SYNC_PREFIX}${bytesToBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")}`;
}

function decodeSyncPayload(value) {
  const key = extractSyncKey(value);
  const base64 = key.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(key.length / 4) * 4, "=");
  return JSON.parse(new TextDecoder().decode(base64ToBytes(base64)));
}

function extractSyncKey(value) {
  const text = String(value || "").trim();
  if (!text) throw new Error("Missing sync key");

  try {
    const url = new URL(text);
    const fromUrl = url.searchParams.get(SYNC_URL_PARAM);
    if (fromUrl) return extractSyncKey(fromUrl);
  } catch {
    // Plain sync keys are expected here.
  }

  return text.replace(new RegExp(`^${SYNC_PREFIX}`, "i"), "").replace(/\s+/g, "");
}

function bytesToBase64(bytes) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function createSyncLink() {
  const key = els.syncKeyField.value.trim() || encodeSyncPayload(createSyncPayload());
  const url = new URL(window.location.href);
  url.searchParams.set(SYNC_URL_PARAM, extractSyncKey(key));
  url.searchParams.delete("comic");
  url.searchParams.delete("from");
  return url.toString();
}

async function copySyncText(value, message) {
  const text = value.trim();
  if (!text) {
    setSyncStatus("No key", "error");
    return;
  }

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      const scratch = document.createElement("textarea");
      scratch.value = text;
      scratch.setAttribute("readonly", "");
      scratch.className = "clipboard-scratch";
      document.body.append(scratch);
      scratch.select();
      document.execCommand("copy");
      scratch.remove();
    }
    setSyncStatus(message);
  } catch (error) {
    console.warn(error);
    setSyncStatus("Copy failed", "error");
  }
}

function updateSyncButtons() {
  const hasKey = Boolean(els.syncKeyField.value.trim());
  els.copySyncKeyButton.disabled = !hasKey;
  els.copySyncLinkButton.disabled = !hasKey;
}

function setSyncStatus(message, state = "") {
  window.clearTimeout(syncStatusTimer);
  els.syncStatus.textContent = message;
  els.syncStatus.dataset.state = state;
  if (message) {
    syncStatusTimer = window.setTimeout(() => {
      els.syncStatus.textContent = "";
      els.syncStatus.dataset.state = "";
    }, 5200);
  }
}

function getSavedLastViewedIndex() {
  const savedValue = localStorage.getItem(LAST_VIEWED_STORAGE_KEY);
  const savedIndex = savedValue === null ? currentIndex : Number(savedValue);
  return Number.isFinite(savedIndex) ? clampIndex(savedIndex) : clampIndex(currentIndex);
}

function findComicIndexBySlugOrIndex(slug, fallbackIndex = null) {
  if (typeof slug === "string" && slug) {
    const bySlug = archive.findIndex((comic) => comic.slug === slug);
    if (bySlug >= 0) return bySlug;
  }

  if (fallbackIndex === null || fallbackIndex === undefined || fallbackIndex === "") {
    return null;
  }

  const byIndex = Number(fallbackIndex);
  if (Number.isFinite(byIndex) && archive[clampIndex(byIndex)]) {
    return clampIndex(byIndex);
  }

  return null;
}

function setBookmark(index) {
  const comic = archive[clampIndex(index)];
  localStorage.setItem(BOOKMARK_SLUG_KEY, comic.slug);
  localStorage.setItem(BOOKMARK_INDEX_KEY, String(comic.index));
  updateBookmarkUi();
}

function toggleFavorite(index) {
  const comic = archive[clampIndex(index)];
  const slugs = getFavoriteSlugs();
  const existingIndex = slugs.indexOf(comic.slug);
  if (existingIndex >= 0) {
    slugs.splice(existingIndex, 1);
  } else {
    slugs.unshift(comic.slug);
  }
  setFavoriteSlugs(slugs);
  updateFavoritesUi();
}

function getFavoriteSlugs() {
  try {
    const parsed = JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((slug) => typeof slug === "string") : [];
  } catch {
    return [];
  }
}

function setFavoriteSlugs(slugs) {
  const unique = [...new Set(slugs.filter((slug) => typeof slug === "string" && slug))].slice(0, 200);
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(unique));
}

function getFavoriteComics() {
  const bySlug = new Map(archive.map((comic) => [comic.slug, comic]));
  return getFavoriteSlugs().map((slug) => bySlug.get(slug)).filter(Boolean);
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

function updateFavoritesUi() {
  const favorites = getFavoriteComics();
  els.favoritesSummary.textContent = `Favorites (${favorites.length})`;
  els.clearFavoritesButton.disabled = !favorites.length;
  els.favoritesList.textContent = "";

  if (!favorites.length) {
    const empty = document.createElement("span");
    empty.className = "favorites-empty";
    empty.textContent = "No favorites saved yet.";
    els.favoritesList.append(empty);
  } else {
    const fragment = document.createDocumentFragment();
    for (const comic of favorites) {
      const item = document.createElement("button");
      item.className = "favorite-jump";
      item.type = "button";
      item.dataset.slug = comic.slug;
      item.innerHTML = `<strong>${escapeHtml(comic.title)}</strong><span>${escapeHtml(formatComicDate(comic))} · ${escapeHtml(comic.book.label)}</span>`;
      item.addEventListener("click", () => {
        els.favoritesMenu.open = false;
        const index = archive.findIndex((entry) => entry.slug === comic.slug);
        if (index >= 0) startAt(index, { scrollToTop: true });
      });
      fragment.append(item);
    }
    els.favoritesList.append(fragment);
  }

  document.querySelectorAll(".favorite-button").forEach((button) => {
    const card = button.closest(".comic-card");
    updateFavoriteButton(button, Number(card?.dataset.index));
  });
}

function updateFavoriteButton(button, index) {
  const comic = archive[clampIndex(index)];
  const isFavorite = getFavoriteSlugs().includes(comic.slug);
  button.classList.toggle("is-favorite", isFavorite);
  button.setAttribute("aria-pressed", String(isFavorite));
  button.setAttribute("aria-label", isFavorite ? "Remove from favorites" : "Favorite this comic");
  button.title = isFavorite ? "Remove from favorites" : "Add to favorites";
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
  els.timelinePanel.classList.add("is-dragging");
  els.timelineTrack.classList.add("is-dragging");
  els.timelineTrack.setPointerCapture(event.pointerId);
  previewTimelineAt(event.clientY);

  const move = (moveEvent) => previewTimelineAt(moveEvent.clientY);
  const up = () => {
    userIsDragging = false;
    els.timelinePanel.classList.remove("is-dragging");
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
  const percent = `${timelinePercent(index)}%`;

  applySegmentStyle(els.timelinePanel, comic);
  els.timelinePanel.style.setProperty("--timeline-current", percent);
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
  els.timelineMiniRail.textContent = "";
  els.timelineSegments.textContent = "";
  els.timelineTicks.textContent = "";
  els.timelineMilestones.textContent = "";

  const segmentFragment = document.createDocumentFragment();
  const miniSegmentFragment = document.createDocumentFragment();
  const segmentStarts = archive
    .map((comic, index) => ({ comic, index }))
    .filter(({ comic, index }) => index === 0 || isSegmentBoundary(comic));

  for (const [segmentIndex, { comic, index }] of segmentStarts.entries()) {
    const nextIndex = segmentStarts[segmentIndex + 1]?.index ?? archive.length - 1;
    const start = timelinePercent(index);
    const end = segmentIndex === segmentStarts.length - 1 ? 100 : timelinePercent(nextIndex);
    segmentFragment.append(createTimelineSegment(comic, start, end));
    miniSegmentFragment.append(createTimelineSegment(comic, start, end));
  }
  els.timelineSegments.append(segmentFragment);
  els.timelineMiniRail.append(miniSegmentFragment);

  const years = [...new Set(archive.map((comic) => comic.year))];
  const tickFragment = document.createDocumentFragment();
  for (const year of years) {
    const firstIndex = archive.findIndex((comic) => comic.year === year);
    const tick = document.createElement("div");
    tick.className = "timeline-tick";
    tick.style.top = `${timelinePercent(firstIndex)}%`;
    tick.textContent = String(year);
    tickFragment.append(tick);
  }
  els.timelineTicks.append(tickFragment);

  const milestoneFragment = document.createDocumentFragment();
  archive.forEach((comic, index) => {
    if (!comic.authorEvent) return;
    const marker = document.createElement("button");
    const label = document.createElement("span");
    marker.className = "timeline-milestone";
    marker.type = "button";
    marker.style.top = `${timelinePercent(index)}%`;
    marker.title = `${comic.authorEvent.label}: ${comic.title} - ${formatComicDate(comic)}`;
    marker.setAttribute("aria-label", marker.title);
    applySegmentStyle(marker, comic);
    label.textContent = comic.authorEvent.label;
    marker.append(label);
    marker.addEventListener("pointerdown", (event) => event.stopPropagation());
    marker.addEventListener("click", (event) => {
      event.stopPropagation();
      startAt(index, { scrollToTop: true });
    });
    milestoneFragment.append(marker);
  });
  els.timelineMilestones.append(milestoneFragment);
}

function createTimelineSegment(comic, start, end) {
  const segment = document.createElement("span");
  segment.className = "timeline-segment";
  segment.style.top = `${start}%`;
  segment.style.height = `${Math.max(end - start, 0.45)}%`;
  segment.title = `${comic.book.label} · ${comic.book.fullTitle}: ${comic.storyline.name}`;
  applySegmentStyle(segment, comic);
  return segment;
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

function timelinePercent(index) {
  return archive.length <= 1 ? 0 : (clampIndex(index) / (archive.length - 1)) * 100;
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

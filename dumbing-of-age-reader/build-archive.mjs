import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const FEED_BASE = "https://www.dumbingofage.com/comic/feed/";
const OUT_FILE = path.resolve("data/comics.json");
const USER_AGENT = "AshodinVenteal DoA reader archive builder (+https://ashodinventeal.github.io/)";
const FETCH_DELAY_MS = 130;
const FETCH_TIMEOUT_MS = 15000;
const MAX_RETRIES = 5;
const RETRY_BASE_DELAY_MS = 1000;
const RETRY_MAX_DELAY_MS = 15000;

const args = new Map(process.argv.slice(2).map((arg) => {
  const [key, value = "true"] = arg.replace(/^--/, "").split("=");
  return [key, value];
}));

const maxPages = args.has("max-pages") ? Number(args.get("max-pages")) : Infinity;
const detailFrom = args.has("detail-from") ? Date.parse(`${args.get("detail-from")}T00:00:00Z`) : null;
const detailLimit = parseLimit(args.get("detail-limit"), detailFrom ? Infinity : 30);
const forceDetails = args.has("force-details");
const onlyDetails = args.has("only-details");
const fullFeed = args.has("full-feed");
const detailConcurrency = Math.max(1, Number(args.get("detail-concurrency") ?? 2));
const saveEvery = Math.max(0, Number(args.get("save-every") ?? 250));
const stopAfterKnownPages = Math.max(1, Number(args.get("stop-after-known-pages") ?? 5));

await main();

async function main() {
  const existingBySlug = await readExistingArchive();
  let uniqueComics = [...existingBySlug.values()];

  if (!onlyDetails) {
    const comics = [];
    let page = 1;
    let feedComplete = true;
    let knownPageStreak = 0;

    while (page <= maxPages) {
      let xml;
      try {
        xml = await fetchFeedPage(page);
      } catch (error) {
        if (existingBySlug.size && page > 1) {
          feedComplete = false;
          process.stderr.write(`Stopping feed crawl at page ${page}: ${error.message}\n`);
          process.stderr.write("Keeping existing archived comics beyond the fetched pages.\n");
          break;
        }
        throw error;
      }

      if (!xml) break;

      const items = parseItems(xml).map(parseComicItem).filter(Boolean);
      if (!items.length) break;

      comics.push(...items);
      if (!fullFeed && existingBySlug.size) {
        const hasNewComic = items.some((comic) => !existingBySlug.has(comic.slug));
        knownPageStreak = hasNewComic ? 0 : knownPageStreak + 1;
      }

      if (page === 1 || page % 25 === 0) {
        process.stdout.write(`Fetched page ${page}: ${comics.length} comics so far\n`);
      }
      if (knownPageStreak >= stopAfterKnownPages) {
        feedComplete = false;
        process.stdout.write(`Stopping after ${knownPageStreak} already-indexed feed pages at page ${page}.\n`);
        process.stdout.write("Keeping existing archived comics beyond the fetched pages.\n");
        break;
      }

      page += 1;
      await sleep(FETCH_DELAY_MS);
    }

    comics.sort((a, b) => Date.parse(a.publishedAt) - Date.parse(b.publishedAt));
    const fetchedComics = dedupeBySlug(comics).map((comic) => mergeExistingComic(existingBySlug.get(comic.slug), comic));

    if (feedComplete || !existingBySlug.size) {
      uniqueComics = fetchedComics;
    } else {
      const mergedBySlug = new Map(existingBySlug);
      for (const comic of fetchedComics) {
        mergedBySlug.set(comic.slug, comic);
      }
      uniqueComics = [...mergedBySlug.values()];
    }
  }

  uniqueComics.sort((a, b) => Date.parse(a.publishedAt) - Date.parse(b.publishedAt));
  await enrichHoverText(uniqueComics);
  await writeArchive(uniqueComics);
  process.stdout.write(`Wrote ${uniqueComics.length} comics to ${OUT_FILE}\n`);
}

async function writeArchive(comics) {
  const payload = {
    generatedAt: new Date().toISOString(),
    source: FEED_BASE,
    count: comics.length,
    comics,
  };

  await mkdir(path.dirname(OUT_FILE), { recursive: true });
  await writeFile(OUT_FILE, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function readExistingArchive() {
  try {
    const existing = JSON.parse(await readFile(OUT_FILE, "utf8"));
    return new Map((existing.comics ?? []).map((comic) => [comic.slug, comic]));
  } catch {
    return new Map();
  }
}

function mergeExistingComic(existing, next) {
  return {
    ...existing,
    ...next,
    hoverText: next.hoverText || existing?.hoverText || "",
  };
}

async function enrichHoverText(comics) {
  if (!detailLimit) return;

  const candidates = comics.filter((comic) => {
    if (!forceDetails && comic.hoverText) return false;
    if (detailFrom !== null && Date.parse(comic.publishedAt) < detailFrom) return false;
    return true;
  });
  const missing = detailLimit === Infinity ? candidates : candidates.slice(-detailLimit).reverse();

  if (missing.length) {
    process.stdout.write(`Fetching hover text for ${missing.length} comics with ${detailConcurrency} workers\n`);
  }

  let cursor = 0;
  let completed = 0;
  let added = 0;
  let saving = Promise.resolve();

  async function worker() {
    while (cursor < missing.length) {
      const comic = missing[cursor];
      cursor += 1;

      try {
        const hoverText = await fetchHoverText(comic);
        if (hoverText) {
          comic.hoverText = hoverText;
          added += 1;
        }
      } catch (error) {
        process.stderr.write(`Could not fetch hover text for ${comic.slug}: ${error.message}\n`);
      }

      completed += 1;
      if (completed % 100 === 0 || completed === missing.length) {
        process.stdout.write(`Hover text progress: ${completed}/${missing.length}, updated ${added}\n`);
      }
      if (saveEvery && completed % saveEvery === 0) {
        saving = saving.then(() => writeArchive(comics));
      }
      await sleep(FETCH_DELAY_MS);
    }
  }

  await Promise.all(Array.from({ length: Math.min(detailConcurrency, missing.length) }, worker));
  await saving;
}

async function fetchHoverText(comic) {
  const html = await fetchText(comic.link);
  const imageTag = findComicImageTag(html, comic.image);
  return cleanHoverText(attr(imageTag, "title") || attr(imageTag, "alt"));
}

async function fetchFeedPage(page) {
  const url = page === 1 ? FEED_BASE : `${FEED_BASE}?paged=${page}`;
  return fetchText(url, { page });
}

async function fetchText(url, context = {}) {
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      let response;
      try {
        response = await fetch(url, {
          signal: controller.signal,
          headers: {
            "User-Agent": USER_AGENT,
            "Accept": "application/rss+xml, application/xml;q=0.9, */*;q=0.8",
          },
        });
      } finally {
        clearTimeout(timeout);
      }

      if (response.status === 404) return null;
      if (!response.ok) {
        const error = new Error(`${context.page ? `Feed page ${context.page}` : url} failed with ${response.status}`);
        error.retryAfter = retryAfterMs(response.headers.get("retry-after"));
        throw error;
      }
      return response.text();
    } catch (caught) {
      const error = caught.name === "AbortError"
        ? new Error(`${context.page ? `Feed page ${context.page}` : url} timed out after ${FETCH_TIMEOUT_MS / 1000}s`)
        : caught;
      lastError = error;
      if (attempt < MAX_RETRIES) {
        const delay = error.retryAfter ?? retryDelayMs(attempt);
        process.stderr.write(`${error.message}; retrying in ${Math.round(delay / 1000)}s (${attempt}/${MAX_RETRIES})\n`);
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

function parseItems(xml) {
  return [...xml.matchAll(/<item\b[\s\S]*?<\/item>/g)].map((match) => match[0]);
}

function parseComicItem(itemXml) {
  const title = decodeEntities(textTag(itemXml, "title")).trim();
  const link = decodeEntities(textTag(itemXml, "link")).trim();
  const publishedAt = new Date(decodeEntities(textTag(itemXml, "pubDate")).trim()).toISOString();
  const guid = decodeEntities(textTag(itemXml, "guid")).trim();
  const content = cdataTag(itemXml, "content:encoded");
  const imageTag = content.match(/<img\b[^>]*>/i)?.[0] ?? "";
  const featured = itemXml.match(/<toocheke:featured_image\b[^>]*>/i)?.[0] ?? "";
  const enclosure = itemXml.match(/<enclosure\b[^>]*>/i)?.[0] ?? "";
  const image = attr(featured, "url") || attr(enclosure, "url") || attr(imageTag, "src");
  const hoverText = cleanHoverText(attr(imageTag, "title") || attr(imageTag, "alt"));

  if (!title || !link || !image) return null;

  return {
    id: postIdFromGuid(guid),
    title,
    slug: slugFromLink(link),
    link,
    publishedAt,
    image,
    imageWidth: Number(attr(featured, "width") || attr(imageTag, "width")) || null,
    imageHeight: Number(attr(featured, "height") || attr(imageTag, "height")) || null,
    hoverText,
    comments: Number(decodeEntities(textTag(itemXml, "slash:comments")).trim()) || 0,
  };
}

function textTag(xml, tagName) {
  const match = xml.match(new RegExp(`<${escapeRegExp(tagName)}\\b[^>]*>([\\s\\S]*?)<\\/${escapeRegExp(tagName)}>`, "i"));
  return match ? stripCdata(match[1]) : "";
}

function cdataTag(xml, tagName) {
  return stripCdata(textTag(xml, tagName));
}

function stripCdata(value) {
  return value.replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "");
}

function attr(tag, name) {
  const match = tag.match(new RegExp(`\\b${escapeRegExp(name)}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, "i"));
  return match ? decodeEntities(match[2]) : "";
}

function findComicImageTag(html, imageUrl) {
  const comicArea = html.match(/<div id="one-comic-option"[\s\S]*?<\/div>/i)?.[0] ?? html;
  const tags = [...comicArea.matchAll(/<img\b[^>]*>/gi)].map((match) => match[0]);
  const imagePath = new URL(imageUrl).pathname;
  return tags.find((tag) => {
    const src = attr(tag, "src");
    if (!src) return false;
    try {
      return new URL(src, "https://www.dumbingofage.com").pathname === imagePath;
    } catch {
      return src.includes(imagePath);
    }
  }) ?? tags[0] ?? "";
}

function cleanHoverText(value) {
  return decodeEntities(value).replace(/\s+/g, " ").trim();
}

function parseLimit(value, fallback) {
  if (value === undefined) return fallback;
  if (value === "all") return Infinity;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function postIdFromGuid(guid) {
  const match = guid.match(/[?&]p=(\d+)/);
  return match ? Number(match[1]) : null;
}

function slugFromLink(link) {
  const match = link.match(/\/comic\/([^/]+)\/?$/);
  return match ? match[1] : "";
}

function dedupeBySlug(comics) {
  const seen = new Set();
  const unique = [];
  for (const comic of comics) {
    if (seen.has(comic.slug)) continue;
    seen.add(comic.slug);
    unique.push(comic);
  }
  return unique;
}

function decodeEntities(value) {
  return String(value)
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#8211;/g, "-")
    .replace(/&#8212;/g, "-")
    .replace(/&#8217;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)));
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryAfterMs(value) {
  if (!value) return null;

  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.min(RETRY_MAX_DELAY_MS, Math.max(0, seconds * 1000));

  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.min(RETRY_MAX_DELAY_MS, Math.max(0, date - Date.now())) : null;
}

function retryDelayMs(attempt) {
  const exponential = Math.min(RETRY_MAX_DELAY_MS, RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
  return exponential + Math.floor(Math.random() * 500);
}

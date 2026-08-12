const BOOK_ERAS = [
  { date: "2010-09-10", book: 1, name: "Arrival Week" },
  { date: "2011-09-10", book: 2, name: "Settling In" },
  { date: "2012-09-09", book: 3, name: "New Routines" },
  { date: "2013-09-09", book: 4, name: "Campus Pressure" },
  { date: "2014-09-22", book: 5, name: "Lines Drawn" },
  { date: "2015-08-31", book: 6, name: "Aftershocks" },
  { date: "2016-09-02", book: 7, name: "Open Doors" },
  { date: "2017-09-01", book: 8, name: "Late Nights" },
  { date: "2018-08-31", book: 9, name: "New Connections" },
  { date: "2019-08-18", book: 10, name: "Blank Slate" },
  { date: "2020-11-16", book: 11, name: "Recalibration" },
  { date: "2021-08-27", book: 12, name: "Crosscurrents" },
  { date: "2022-08-22", book: 13, name: "Second Winds" },
  { date: "2023-08-16", book: 14, name: "Turning Corners" },
  { date: "2024-11-01", book: 15, name: "Fault Lines" },
  { date: "2025-08-03", book: 16, name: "New Thresholds" },
];

const STORYLINE_NAMES = [
  "Dorm Weather",
  "Hallway Static",
  "Roommate Orbit",
  "Late-Night Threads",
  "Campus Crossroads",
  "Study Break",
  "Quiet Fallout",
  "Sunday Morning",
  "Open Doors",
  "After-Hours",
  "Threshold Week",
  "New Current",
];

const SEGMENT_PALETTES = [
  { accent: "#0f6d70", soft: "rgba(15, 109, 112, 0.14)", deep: "#08494c" },
  { accent: "#bd3b2f", soft: "rgba(189, 59, 47, 0.14)", deep: "#7b241e" },
  { accent: "#b87814", soft: "rgba(184, 120, 20, 0.16)", deep: "#744a0b" },
  { accent: "#5768a8", soft: "rgba(87, 104, 168, 0.16)", deep: "#34406f" },
  { accent: "#2f7d49", soft: "rgba(47, 125, 73, 0.15)", deep: "#205536" },
  { accent: "#a94d88", soft: "rgba(169, 77, 136, 0.15)", deep: "#70315a" },
  { accent: "#c4542d", soft: "rgba(196, 84, 45, 0.14)", deep: "#80351f" },
  { accent: "#247fa3", soft: "rgba(36, 127, 163, 0.15)", deep: "#18536b" },
];

export function decorateArchive(comics) {
  let currentBook = BOOK_ERAS[0];
  let nextBookIndex = 1;
  let storylineNumber = 0;
  let startsNextStoryline = true;

  for (const [index, comic] of comics.entries()) {
    while (nextBookIndex < BOOK_ERAS.length && comic.dateKey >= BOOK_ERAS[nextBookIndex].date) {
      currentBook = BOOK_ERAS[nextBookIndex];
      nextBookIndex += 1;
      startsNextStoryline = true;
    }

    const startsBook = comic.dateKey === currentBook.date || index === 0;
    const startsStoryline = startsNextStoryline || startsBook;
    if (startsStoryline) {
      storylineNumber += 1;
      startsNextStoryline = false;
    }

    const palette = SEGMENT_PALETTES[(storylineNumber - 1) % SEGMENT_PALETTES.length];
    comic.book = {
      number: currentBook.book,
      name: currentBook.name,
      label: `Book ${currentBook.book}`,
      starts: startsBook,
    };
    comic.storyline = {
      number: storylineNumber,
      name: STORYLINE_NAMES[(storylineNumber - 1) % STORYLINE_NAMES.length],
      label: `Storyline ${storylineNumber}`,
      starts: startsStoryline,
      palette,
    };
    comic.authorEvent = detectAuthorEvent(comic);

    if (isStorylineEnd(comic) || isBookEnd(comic)) {
      startsNextStoryline = true;
    }
  }

  return comics;
}

export function isSegmentBoundary(comic) {
  return Boolean(comic?.book?.starts || comic?.storyline?.starts);
}

export function applySegmentStyle(element, comic) {
  const palette = comic?.storyline?.palette;
  if (!palette) return;
  element.style.setProperty("--segment-accent", palette.accent);
  element.style.setProperty("--segment-soft", palette.soft);
  element.style.setProperty("--segment-deep", palette.deep);
}

function detectAuthorEvent(comic) {
  const text = String(comic.hoverText || "").toLowerCase();
  if (!text) return null;

  if (text.includes("kids will be born")) {
    return event("Family note", "Kids due soon");
  }
  if (text.includes("official due date")) {
    return event("Family note", "Maggie's due date");
  }
  if (text.includes("first dumbing of age strip drawn as a father")) {
    return event("Author milestone", "First strip drawn as a father");
  }
  if (text.includes("twin newborns")) {
    return event("Family note", "Twin newborns");
  }
  if (text.includes("my kids are a year old today")) {
    return event("Family note", "Kids' first birthday");
  }
  if (/\btoday'?s my birthday\b|\bit'?s my birthday\b|\bi'?m \d+ today\b/.test(text)) {
    return event("Author birthday", "Willis birthday note");
  }
  if (/\btoo busy getting married\b|\bthen i married her all over again\b/.test(text)) {
    return event("Author life note", "Marriage note");
  }
  if (text.includes("these days i know all about pissy babies")) {
    return event("Family note", "New-parent note");
  }

  return null;
}

function event(kind, label) {
  return { kind, label };
}

function isStorylineEnd(comic) {
  return /\bend of storyline\b|\bstoryline over\b|\bstoryline ends\b|\bto be continued next storyline\b/i.test(comic.hoverText || "");
}

function isBookEnd(comic) {
  return /\bend of book\b|\bend of book\s+(five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|\d+)\b/i.test(comic.hoverText || "");
}

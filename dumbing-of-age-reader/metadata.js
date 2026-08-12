const BOOK_ERAS = [
  { date: "2010-09-10", book: 1, name: "This Campus is a Friggin' Escher Print" },
  { date: "2011-10-31", book: 2, name: "I Beg You, Don't Cast Your Body into the Cragged Shame Pits of the Lustwolves" },
  { date: "2012-11-12", book: 3, name: "Your Stupid Overconfidence is Nostalgic" },
  { date: "2013-10-24", book: 4, name: "Amazi-Girl is Always Prepared for Anything" },
  { date: "2014-09-22", book: 5, name: "Hey, Guess What, I'm a Lesbian!" },
  { date: "2015-08-31", book: 6, name: "The Machinations of My Revenge Will Be Cold, Swift, and Absolutely Ridiculous" },
  { date: "2016-09-02", book: 7, name: "Just Put Down The Ukulele, Only Then Can The Healing Begin" },
  { date: "2017-09-01", book: 8, name: "Up Here We Can Be Garbage" },
  { date: "2018-08-31", book: 9, name: "Now Let's Go Commit Something Mildly Subversive Which, at Worst, Will Serve as a Humanizing Anecdote and Not as Anything Truly Threatening to the Power Structures at Hand" },
  { date: "2019-08-18", book: 10, name: "Renounce Magical Thinking and Embrace Empirical Evidence" },
  { date: "2020-09-10", book: 11, name: "I Excised All My Anxieties Into Cartoon Characters Who Definitely Don't Have Feelings For Each Other" },
  { date: "2021-08-27", book: 12, name: "Her Hugs Are Traps" },
  { date: "2022-08-22", book: 13, name: "My Peer Group's Smoochy Chart Is Basically Now An Ouroboros" },
  { date: "2023-08-16", book: 14, name: "Reminding Myself That Despite What That Sign on the Highway Says, Hell Isn't Real" },
  { date: "2024-08-07", book: 15, name: "I'm A Trash Goblin Who Craves Mess" },
  { date: "2025-08-03", book: 16, name: "Book 16 (uncollected)", published: false },
];

const STORYLINES = [
  { date: "2010-09-10", book: 1, number: 1, name: "Move-In Day" },
  { date: "2010-10-25", book: 1, number: 2, name: "Uphill From Here" },
  { date: "2010-12-07", book: 1, number: 3, name: "Men are from Beck, Women are from Clark" },
  { date: "2011-02-21", book: 1, number: 4, name: "The Bechdel Test" },
  { date: "2011-04-25", book: 1, number: 5, name: "Media Rumble" },
  { date: "2011-07-04", book: 1, number: 6, name: "Yesterday Was Thursday" },
  { date: "2011-10-31", book: 2, number: 1, name: "Pajama Jeans" },
  { date: "2012-01-16", book: 2, number: 2, name: "Choosing My Religion" },
  { date: "2012-03-26", book: 2, number: 3, name: "The First Step Towards Recovery" },
  { date: "2012-05-21", book: 2, number: 4, name: "Time Keeps on Slippin'" },
  { date: "2012-07-02", book: 2, number: 5, name: "Saturday's All Right for Slighting" },
  { date: "2012-09-10", book: 2, number: 6, name: "Strange Beerfellows" },
  { date: "2012-11-12", book: 3, number: 1, name: "If the Shoe Splits" },
  { date: "2013-02-11", book: 3, number: 2, name: "Guess Who's Coming to Galasso's" },
  { date: "2013-04-22", book: 3, number: 3, name: "Answers in Hennessy" },
  { date: "2013-07-13", book: 3, number: 4, name: "Just Hangin' Out With My Family" },
  { date: "2013-10-24", book: 4, number: 1, name: "The Only Dope For Me Is You" },
  { date: "2014-02-18", book: 4, number: 2, name: "I Was a Teenage Churchmouse" },
  { date: "2014-05-13", book: 4, number: 3, name: "Up All Night to Get Vengeance" },
  { date: "2014-07-06", book: 4, number: 4, name: "The Whiteboard Dingdong Bandit" },
  { date: "2014-09-22", book: 5, number: 1, name: "When Somebody Loved Me" },
  { date: "2014-12-22", book: 5, number: 2, name: "Three's a Crowd" },
  { date: "2015-03-27", book: 5, number: 3, name: "The Butterflies Won't Fly Away" },
  { date: "2015-07-10", book: 5, number: 4, name: "Walking with Dina" },
  { date: "2015-08-31", book: 6, number: 1, name: "To Those Who'd Ground Me" },
  { date: "2015-11-26", book: 6, number: 2, name: "That Perfect Girl" },
  { date: "2016-02-24", book: 6, number: 3, name: "When God Closes The Door" },
  { date: "2016-06-08", book: 6, number: 4, name: "It All Returns" },
  { date: "2016-09-02", book: 7, number: 1, name: "Glower Vacuum" },
  { date: "2016-12-24", book: 7, number: 2, name: "Everything You've Ever Wanted Floats Above" },
  { date: "2017-02-20", book: 7, number: 3, name: "The Thing I Was Before" },
  { date: "2017-06-05", book: 7, number: 4, name: "The 'Do' List" },
  { date: "2017-09-01", book: 8, number: 1, name: "Face the Strange" },
  { date: "2017-11-21", book: 8, number: 2, name: "This Is the Way that We Love" },
  { date: "2018-02-06", book: 8, number: 3, name: "Faz Is Great" },
  { date: "2018-05-21", book: 8, number: 4, name: "Of Mike And Men" },
  { date: "2018-08-31", book: 9, number: 1, name: "Flyin' to the Red" },
  { date: "2018-12-06", book: 9, number: 2, name: "But the Sun Still Shines" },
  { date: "2019-03-02", book: 9, number: 3, name: "Sometimes the Sky Was So Far Away" },
  { date: "2019-05-14", book: 9, number: 4, name: "Vote for Robin" },
  { date: "2019-08-18", book: 10, number: 1, name: "Birthday Pursuit" },
  { date: "2019-12-14", book: 10, number: 2, name: "To Remind You of My Love" },
  { date: "2020-03-16", book: 10, number: 3, name: "When It Crumbles" },
  { date: "2020-06-24", book: 10, number: 4, name: "Is a Song Forever?" },
  { date: "2020-09-10", book: 11, number: 1, name: "This Bright Millennium" },
  { date: "2020-11-16", book: 11, number: 2, name: "Look Straight Ahead" },
  { date: "2021-01-20", book: 11, number: 3, name: "See You in the Funny Page" },
  { date: "2021-04-02", book: 11, number: 4, name: "Hompk!" },
  { date: "2021-06-07", book: 11, number: 5, name: "As Long As It's Free" },
  { date: "2021-08-27", book: 12, number: 1, name: "Sister, Christian" },
  { date: "2021-11-13", book: 12, number: 2, name: "I'll Leave You A Phantom" },
  { date: "2022-01-18", book: 12, number: 3, name: "Trial and Sarah" },
  { date: "2022-04-13", book: 12, number: 4, name: "Don't Stop Billie-ving" },
  { date: "2022-07-02", book: 12, number: 5, name: "This Was Halloween" },
  { date: "2022-08-22", book: 13, number: 1, name: "Bring Me to Life Drawing" },
  { date: "2022-11-18", book: 13, number: 2, name: "Turning Saints Into the Sea" },
  { date: "2023-02-13", book: 13, number: 3, name: "Joementum" },
  { date: "2023-05-11", book: 13, number: 4, name: "But Don't Give Yourself Away" },
  { date: "2023-08-16", book: 14, number: 1, name: "Everybody's Looking for Nothing" },
  { date: "2023-11-08", book: 14, number: 2, name: "It's The Love I Haven't Got" },
  { date: "2024-02-02", book: 14, number: 3, name: "Trystin' in the Wind" },
  { date: "2024-04-27", book: 14, number: 4, name: "For Me It Was Tuesday" },
  { date: "2024-08-07", book: 15, number: 1, name: "Love Dares You To Change" },
  { date: "2024-11-01", book: 15, number: 2, name: "The One Where Jocelyne Returns" },
  { date: "2025-02-02", book: 15, number: 3, name: "Me And Who You Say I Was Yesterday" },
  { date: "2025-05-07", book: 15, number: 4, name: "The Only Exception" },
  { date: "2025-08-03", book: 16, number: 1, name: "Not-So Smooth Criminals" },
  { date: "2025-11-17", book: 16, number: 2, name: "I'm the Problem, It's Me" },
  { date: "2026-02-28", book: 16, number: 3, name: "Fools' Spring" },
  { date: "2026-06-06", book: 16, number: 4, name: "What a RARR! Mood I'm in" },
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
  let currentStoryline = STORYLINES[0];
  let nextStorylineIndex = 1;

  for (const [index, comic] of comics.entries()) {
    while (nextBookIndex < BOOK_ERAS.length && comic.dateKey >= BOOK_ERAS[nextBookIndex].date) {
      currentBook = BOOK_ERAS[nextBookIndex];
      nextBookIndex += 1;
    }

    while (nextStorylineIndex < STORYLINES.length && comic.dateKey >= STORYLINES[nextStorylineIndex].date) {
      currentStoryline = STORYLINES[nextStorylineIndex];
      nextStorylineIndex += 1;
    }

    const startsBook = comic.dateKey === currentBook.date || index === 0;
    const startsStoryline = comic.dateKey === currentStoryline.date || index === 0;
    const storylineIndex = Math.max(nextStorylineIndex - 1, 0);
    const bookNumber = String(currentBook.book).padStart(2, "0");
    const storylineNumber = String(currentStoryline.number).padStart(2, "0");
    const palette = SEGMENT_PALETTES[storylineIndex % SEGMENT_PALETTES.length];

    comic.book = {
      number: currentBook.book,
      name: currentBook.name,
      fullTitle: `Dumbing of Age, Volume ${currentBook.book}: ${currentBook.name}`,
      label: `Book ${bookNumber}`,
      published: currentBook.published !== false,
      starts: startsBook,
    };

    if (!comic.book.published) {
      comic.book.fullTitle = currentBook.name;
    }

    comic.storyline = {
      number: currentStoryline.number,
      globalNumber: storylineIndex + 1,
      bookNumber: currentStoryline.book,
      name: currentStoryline.name,
      label: `Storyline ${storylineNumber}`,
      starts: startsStoryline,
      palette,
    };
    comic.authorEvent = detectAuthorEvent(comic);
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

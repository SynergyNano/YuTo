import type { Chapter } from "@/types";

export const CHAPTER_COLORS = [
  "#3B82F6", // blue
  "#10B981", // green
  "#F59E0B", // amber
  "#8B5CF6", // violet
  "#EC4899", // pink
  "#06B6D4", // cyan
  "#EF4444", // red
  "#84CC16", // lime
  "#6366F1", // indigo
  "#14B8A6", // teal
];

const CHAPTER_PATTERNS = [
  /^(챕터\s*\d+[^\n]*)/m,
  /^(Chapter\s*\d+[^\n]*)/im,
  /^(제\d+장[^\n]*)/m,
  /^(\[챕터\s*\d+[^\]]*\][^\n]*)/m,
  /^(#{1,3}\s*챕터\s*\d+[^\n]*)/m,
  /^(#{1,3}\s*Chapter\s*\d+[^\n]*)/im,
];

const NUMBER_EXTRACTOR = /(\d+)/;

function getChapterNumber(title: string): number {
  const match = title.match(NUMBER_EXTRACTOR);
  return match ? parseInt(match[1], 10) : 0;
}

export function getDefaultImageCount(chapterNumber: number): number {
  const n = chapterNumber <= 3 ? 10 : chapterNumber <= 5 ? 5 : 3;
  return Math.min(10, n);
}

export function parseChapters(script: string): Chapter[] {
  // Build a combined pattern to find any chapter heading
  const combinedPattern = new RegExp(
    [
      "(?:^챕터\\s*\\d+[^\\n]*)",
      "(?:^Chapter\\s*\\d+[^\\n]*)",
      "(?:^제\\d+장[^\\n]*)",
      "(?:^\\[챕터\\s*\\d+[^\\]]*\\][^\\n]*)",
      "(?:^#{1,3}\\s*챕터\\s*\\d+[^\\n]*)",
      "(?:^#{1,3}\\s*Chapter\\s*\\d+[^\\n]*)",
    ].join("|"),
    "gim"
  );

  const matches: { index: number; title: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = combinedPattern.exec(script)) !== null) {
    matches.push({ index: m.index, title: m[0].trim() });
  }

  if (matches.length === 0) return [];

  const chapters: Chapter[] = [];
  for (let i = 0; i < matches.length && i < 10; i++) {
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : script.length;
    const content = script.slice(start, end).trim();
    const number = getChapterNumber(matches[i].title) || i + 1;

    chapters.push({
      index: i,
      number,
      title: matches[i].title,
      content,
      color: CHAPTER_COLORS[i % CHAPTER_COLORS.length],
      imageCount: getDefaultImageCount(number),
    });
  }

  return chapters;
}

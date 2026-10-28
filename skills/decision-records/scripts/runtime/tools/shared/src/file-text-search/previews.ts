/*
 * Synced TypeScript runtime; repository maintenance edits tools/shared/src/file-text-search/previews.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/shared/src/file-text-search/previews.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/shared/src/file-text-search/previews.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
import {
  matchTextSegments,
  matchTextSegmentIdentifiers,
  TextSearchMatcherError
} from "./segment-matcher.ts";
import type {
  FileTextSearchPreview,
  FileTextSearchRange,
  LineMatch,
  ValidatedRequest
} from "./contracts.ts";
import { FileTextSearchError } from "./contracts.ts";

export function findLineMatches(
  lines: readonly string[],
  query: ValidatedRequest["query"],
  signal: AbortSignal | undefined
): readonly LineMatch[] {
  try {
    return matchTextSegments(
      query,
      lines.map((text, index) => ({ identifier: index + 1, text })),
      signal
    ).map(({ identifier: line, ranges }) => ({ line, ranges }));
  } catch (error) {
    if (error instanceof TextSearchMatcherError) {
      throw new FileTextSearchError({
        code: error.code === "aborted" ? "aborted" : "invalid-request",
        message: error.message
      });
    }
    throw error;
  }
}

/** Find all hit lines cheaply, but materialize ranges only through the first omitted range. */
export function findLimitedLineMatches(
  lines: readonly string[],
  query: ValidatedRequest["query"],
  maximum: number,
  signal: AbortSignal | undefined
): Readonly<{
  matched: boolean;
  matches: readonly LineMatch[];
  truncated: boolean;
}> {
  try {
    const identifiers = matchTextSegmentIdentifiers(
      query,
      lines.map((text, index) => ({ identifier: index + 1, text })),
      signal
    );
    if (identifiers.length === 0)
      return { matched: false, matches: [], truncated: false };
    return materializeLimitedLineMatches(
      lines,
      identifiers,
      query,
      maximum,
      signal
    );
  } catch (error) {
    if (error instanceof TextSearchMatcherError) {
      throw new FileTextSearchError({
        code: error.code === "aborted" ? "aborted" : "invalid-request",
        message: error.message
      });
    }
    throw error;
  }
}

function materializeLimitedLineMatches(
  lines: readonly string[],
  identifiers: readonly number[],
  query: ValidatedRequest["query"],
  maximum: number,
  signal: AbortSignal | undefined
): Readonly<{
  matched: boolean;
  matches: readonly LineMatch[];
  truncated: boolean;
}> {
  const lineQuery =
    query.mode === "all" ? { ...query, mode: "any" as const } : query;
  const selected: LineMatch[] = [];
  let count = 0;
  for (const line of identifiers) {
    const match = matchTextSegments(
      lineQuery,
      [{ identifier: line, text: lines[line - 1]! }],
      signal
    )[0];
    if (match === undefined) continue;
    const available = maximum - count;
    if (match.ranges.length > available) {
      if (available > 0)
        selected.push({ line, ranges: match.ranges.slice(0, available) });
      return { matched: true, matches: selected, truncated: true };
    }
    selected.push({ line, ranges: match.ranges });
    count += match.ranges.length;
  }
  return { matched: true, matches: selected, truncated: false };
}

export function hasLineMatches(
  lines: readonly string[],
  query: ValidatedRequest["query"],
  signal: AbortSignal | undefined
): boolean {
  try {
    return (
      matchTextSegmentIdentifiers(
        query,
        lines.map((text, index) => ({ identifier: index + 1, text })),
        signal
      ).length > 0
    );
  } catch (error) {
    if (error instanceof TextSearchMatcherError) {
      throw new FileTextSearchError({
        code: error.code === "aborted" ? "aborted" : "invalid-request",
        message: error.message
      });
    }
    throw error;
  }
}

export function splitPhysicalLines(content: string): readonly string[] {
  const lines = content.split(/\r\n|[\n\r]/u);
  if (/(?:\r\n|[\n\r])$/u.test(content)) lines.pop();
  return lines;
}

export function limitMatchRanges(
  matches: readonly LineMatch[],
  maximum: number
): Readonly<{ matches: readonly LineMatch[]; truncated: boolean }> {
  const selected = new Map<number, FileTextSearchRange[]>();
  let count = 0;
  let truncated = false;
  for (const match of matches) {
    for (const range of match.ranges) {
      if (count >= maximum) {
        truncated = true;
        continue;
      }
      const ranges = selected.get(match.line);
      if (ranges === undefined) {
        selected.set(match.line, [{ ...range }]);
      } else {
        ranges.push({ ...range });
      }
      count += 1;
    }
  }
  return {
    matches: [...selected]
      .sort(([left], [right]) => left - right)
      .map(([line, ranges]) => ({ line, ranges })),
    truncated
  };
}

export function boundPreviews(
  previews: readonly FileTextSearchPreview[],
  availableCharacters: number
): Readonly<{
  characterCount: number;
  previews: readonly FileTextSearchPreview[];
  truncated: boolean;
}> {
  const matching = previews.filter((preview) => preview.ranges.length > 0);
  const context = previews.filter((preview) => preview.ranges.length === 0);
  const bounded: FileTextSearchPreview[] = [];
  let remaining = availableCharacters;
  let truncated = false;
  for (const preview of [...matching, ...context]) {
    if (remaining <= 0) {
      truncated = true;
      continue;
    }
    const clipped = clipPreview(preview, remaining);
    bounded.push(clipped.preview);
    remaining -= clipped.preview.preview.length;
    if (clipped.truncated) truncated = true;
  }
  return {
    characterCount: availableCharacters - remaining,
    previews: bounded.sort((left, right) => left.line - right.line),
    truncated
  };
}

function clipPreview(
  preview: FileTextSearchPreview,
  maximumCharacters: number
): Readonly<{ preview: FileTextSearchPreview; truncated: boolean }> {
  if (preview.preview.length <= maximumCharacters) {
    return { preview, truncated: false };
  }
  if (preview.ranges.length === 0) {
    return {
      preview: {
        ...preview,
        preview: preview.preview.slice(0, maximumCharacters)
      },
      truncated: true
    };
  }
  const first = preview.ranges[0];
  if (first === undefined) return { preview, truncated: false };
  const start =
    first.end - first.start >= maximumCharacters
      ? first.start
      : Math.min(first.start, preview.preview.length - maximumCharacters);
  const end = start + maximumCharacters;
  const ranges = preview.ranges.flatMap((range) => {
    const rangeStart = Math.max(range.start, start);
    const rangeEnd = Math.min(range.end, end);
    return rangeStart < rangeEnd
      ? [{ end: rangeEnd - start, start: rangeStart - start }]
      : [];
  });
  return {
    preview: {
      column: ranges[0] === undefined ? null : ranges[0].start + 1,
      line: preview.line,
      preview: preview.preview.slice(start, end),
      ranges
    },
    truncated: true
  };
}

export function previewsForMatches(
  lines: readonly string[],
  matches: readonly LineMatch[],
  contextLines: number
): readonly FileTextSearchPreview[] {
  const rangesByLine = new Map(
    matches.map((match) => [match.line, match.ranges])
  );
  const previewLineNumbers = new Set<number>();
  for (const match of matches) {
    const first = Math.max(1, match.line - contextLines);
    const last = Math.min(lines.length, match.line + contextLines);
    for (let line = first; line <= last; line += 1) {
      previewLineNumbers.add(line);
    }
  }
  return [...previewLineNumbers]
    .sort((left, right) => left - right)
    .flatMap((line) => {
      const preview = lines[line - 1];
      if (preview === undefined) return [];
      const ranges = rangesByLine.get(line) ?? [];
      return [
        {
          column: ranges[0] === undefined ? null : ranges[0].start + 1,
          line,
          preview,
          ranges
        }
      ];
    });
}

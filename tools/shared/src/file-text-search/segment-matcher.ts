const whitespacePattern = /\p{White_Space}/u;
const segmenter = new Intl.Segmenter("und", { granularity: "grapheme" });

export type TextSearchMode = "all" | "any" | "phrase";

export type TextSearchQuery = Readonly<{
  mode: TextSearchMode;
  text: string;
}>;

/** A value searched independently from every other segment. */
export type TextSearchSegment<Identifier> = Readonly<{
  identifier: Identifier;
  text: string;
}>;

/** UTF-16 offsets in the segment's original text. */
export type TextSearchRange = Readonly<{
  end: number;
  start: number;
}>;

export type TextSearchSegmentMatch<Identifier> = Readonly<{
  identifier: Identifier;
  ranges: readonly TextSearchRange[];
}>;

export type TextSearchMatcher = Readonly<{
  mode: TextSearchMode;
  phrase: string;
  terms: readonly string[];
}>;

export type TextSearchMatcherErrorCode = "aborted" | "invalid-query";

/** Failure at the pure query and segment matching boundary. */
export class TextSearchMatcherError extends Error {
  readonly code: TextSearchMatcherErrorCode;

  constructor(code: TextSearchMatcherErrorCode, message: string) {
    super(message);
    this.name = "TextSearchMatcherError";
    this.code = code;
  }
}

/** Validates and normalizes one explicit text-search query for reuse. */
export function createTextSearchMatcher(
  query: TextSearchQuery
): TextSearchMatcher {
  if (query === null || typeof query !== "object") {
    throw invalidQuery("Text search query must be an object.");
  }
  if (typeof query.text !== "string") {
    throw invalidQuery("Text search query text must be a string.");
  }
  if (!isSearchMode(query.mode)) {
    throw invalidQuery("Text search query mode is unsupported.");
  }
  const phrase = normalizeSearchText(query.text);
  if (phrase.length === 0) {
    throw invalidQuery("Text search query text must not be empty.");
  }
  return {
    mode: query.mode,
    phrase,
    terms: [...new Set(phrase.split(" "))]
  };
}

/**
 * Matches one prepared query against independent text segments.
 * `all` may aggregate terms across segments; `phrase` never does.
 */
export function matchTextSegments<Identifier>(
  matcher: TextSearchMatcher,
  segments: readonly TextSearchSegment<Identifier>[],
  signal?: AbortSignal
): readonly TextSearchSegmentMatch<Identifier>[] {
  throwIfAborted(signal);
  const normalizedSegments: Array<
    Readonly<{
      normalized: NormalizedSegment;
      segment: TextSearchSegment<Identifier>;
    }>
  > = [];
  const matches: TextSearchSegmentMatch<Identifier>[] = [];

  for (const segment of segments) {
    throwIfAborted(signal);
    const normalized = normalizeSegment(segment.text);
    normalizedSegments.push({ normalized, segment });
    const ranges =
      matcher.mode === "phrase"
        ? rangesForNeedle(normalized, matcher.phrase, signal)
        : rangesForTerms(normalized, matcher.terms, signal);
    if (ranges.length > 0) {
      matches.push({ identifier: segment.identifier, ranges });
    }
  }

  if (
    matcher.mode === "all" &&
    !matcher.terms.every((term) => {
      throwIfAborted(signal);
      return normalizedSegments.some(({ normalized }) =>
        normalized.text.includes(term)
      );
    })
  ) {
    return [];
  }
  return matches;
}

type NormalizedSegment = Readonly<{
  spans: readonly OriginalSpan[];
  text: string;
}>;

type OriginalSpan = Readonly<{
  end: number;
  start: number;
}>;

function normalizeSegment(segment: string): NormalizedSegment {
  const normalized = segment.normalize("NFKC").toLowerCase();
  const mapped = mapOriginalGraphemes(segment, normalized);
  appendRemainingNormalizedText(
    mapped.characters,
    normalized,
    mapped.normalizedOffset,
    segment.length
  );
  trimMappedWhitespace(mapped.characters);
  return {
    spans: mapped.characters.flatMap(({ end, start, text }) =>
      Array.from({ length: text.length }, () => ({ end, start }))
    ),
    text: mapped.characters.map(({ text }) => text).join("")
  };
}

function mapOriginalGraphemes(
  segment: string,
  normalized: string
): {
  characters: Array<{ end: number; start: number; text: string }>;
  normalizedOffset: number;
} {
  const mappedCharacters: Array<{ end: number; start: number; text: string }> =
    [];
  let normalizedOffset = 0;
  for (const grapheme of segmenter.segment(segment)) {
    const expected = grapheme.segment.normalize("NFKC").toLowerCase();
    const start = grapheme.index;
    const end = start + grapheme.segment.length;
    const matchingLength = normalized.startsWith(expected, normalizedOffset)
      ? expected.length
      : nextCodePointLength(normalized, normalizedOffset);
    const text = normalized.slice(
      normalizedOffset,
      normalizedOffset + matchingLength
    );
    for (const character of text) {
      appendNormalizedCharacter(mappedCharacters, character, start, end);
    }
    normalizedOffset += matchingLength;
  }
  return { characters: mappedCharacters, normalizedOffset };
}

function appendRemainingNormalizedText(
  mappedCharacters: Array<{ end: number; start: number; text: string }>,
  normalized: string,
  initialOffset: number,
  originalLength: number
): void {
  let normalizedOffset = initialOffset;
  const last = mappedCharacters.at(-1);
  while (normalizedOffset < normalized.length) {
    const length = nextCodePointLength(normalized, normalizedOffset);
    const text = normalized.slice(normalizedOffset, normalizedOffset + length);
    appendNormalizedCharacter(
      mappedCharacters,
      text,
      last?.start ?? 0,
      last?.end ?? originalLength
    );
    normalizedOffset += length;
  }
}

function trimMappedWhitespace(
  mappedCharacters: Array<{ end: number; start: number; text: string }>
): void {
  while (mappedCharacters[0]?.text === " ") mappedCharacters.shift();
  while (mappedCharacters.at(-1)?.text === " ") mappedCharacters.pop();
}

function appendNormalizedCharacter(
  characters: Array<{ end: number; start: number; text: string }>,
  character: string,
  start: number,
  end: number
): void {
  const text = whitespacePattern.test(character) ? " " : character;
  const previous = characters.at(-1);
  if (text === " " && previous?.text === " ") {
    previous.end = end;
  } else {
    characters.push({ end, start, text });
  }
}

function nextCodePointLength(text: string, offset: number): number {
  const codePoint = text.codePointAt(offset);
  return codePoint === undefined ? 0 : codePoint > 0xffff ? 2 : 1;
}

function normalizeSearchText(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\p{White_Space}+/gu, " ")
    .trim();
}

function rangesForTerms(
  segment: NormalizedSegment,
  terms: readonly string[],
  signal: AbortSignal | undefined
): readonly TextSearchRange[] {
  return mergeRanges(
    terms.flatMap((term) => rangesForNeedle(segment, term, signal))
  );
}

function rangesForNeedle(
  segment: NormalizedSegment,
  needle: string,
  signal: AbortSignal | undefined
): readonly TextSearchRange[] {
  const ranges: TextSearchRange[] = [];
  let searchStart = 0;
  while (searchStart < segment.text.length) {
    throwIfAborted(signal);
    const index = segment.text.indexOf(needle, searchStart);
    if (index < 0) break;
    const start = segment.spans[index]?.start;
    const end = segment.spans[index + needle.length - 1]?.end;
    if (start === undefined || end === undefined) break;
    ranges.push({ end, start });
    searchStart = index + 1;
  }
  return mergeRanges(ranges);
}

function mergeRanges(
  ranges: readonly TextSearchRange[]
): readonly TextSearchRange[] {
  const sorted = [...ranges].sort(
    (left, right) => left.start - right.start || left.end - right.end
  );
  const merged: Array<{ end: number; start: number }> = [];
  for (const range of sorted) {
    const previous = merged.at(-1);
    if (previous !== undefined && range.start <= previous.end) {
      previous.end = Math.max(previous.end, range.end);
    } else {
      merged.push({ ...range });
    }
  }
  return merged;
}

function isSearchMode(value: unknown): value is TextSearchMode {
  return value === "all" || value === "any" || value === "phrase";
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw new TextSearchMatcherError("aborted", "Text search was aborted.");
  }
}

function invalidQuery(message: string): TextSearchMatcherError {
  return new TextSearchMatcherError("invalid-query", message);
}

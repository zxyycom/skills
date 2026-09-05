import { constants } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import fastGlob from "fast-glob";
import { isPathWithinDirectory, toPosix } from "../node/filesystem.ts";

const utf8Decoder = new TextDecoder("utf-8", { fatal: true });
const whitespacePattern = /\p{White_Space}/u;
const segmenter = new Intl.Segmenter("und", { granularity: "grapheme" });
const defaultResourceLimits = {
  maxCandidateFiles: 10_000,
  maxFileBytes: 2 * 1024 * 1024,
  maxTotalBytes: 20 * 1024 * 1024
} as const;

export type FileTextSearchMode = "all" | "any" | "phrase";

export type FileTextSearchSelection =
  | Readonly<{
      exclude?: readonly string[];
      include: readonly string[];
      kind: "patterns";
    }>
  | Readonly<{
      kind: "files";
      sourcePaths: readonly string[];
    }>;

export type FileTextSearchPreviewPolicy = Readonly<{
  contextLines: number;
  maxFiles: number;
  maxMatchesPerFile: number;
  maxPreviewCharacters: number;
}>;

export type FileTextSearchResourceLimits = Readonly<{
  maxCandidateFiles: number;
  maxFileBytes: number;
  maxTotalBytes: number;
}>;

export type FileTextSearchRequest = Readonly<{
  limits?: Partial<FileTextSearchResourceLimits>;
  preview: FileTextSearchPreviewPolicy;
  query: Readonly<{
    mode: FileTextSearchMode;
    text: string;
  }>;
  root: string;
  selection: FileTextSearchSelection;
  signal?: AbortSignal;
}>;

export type FileTextSearchRange = Readonly<{
  end: number;
  start: number;
}>;

/** A physical source line. Columns and ranges use UTF-16 offsets. */
export type FileTextSearchPreview = Readonly<{
  column: number | null;
  line: number;
  preview: string;
  ranges: readonly FileTextSearchRange[];
}>;

export type FileTextSearchHit = Readonly<{
  previews: readonly FileTextSearchPreview[];
  sourcePath: string;
}>;

export type FileTextSearchTruncation = Readonly<{
  files: boolean;
  matches: boolean;
  previewCharacters: boolean;
}>;

export type FileTextSearchResult = Readonly<{
  hits: readonly FileTextSearchHit[];
  truncation: FileTextSearchTruncation;
}>;

export type FileTextSearchErrorCode =
  | "aborted"
  | "invalid-file"
  | "invalid-path"
  | "invalid-request"
  | "invalid-root"
  | "invalid-utf8"
  | "read-failed"
  | "resource-limit";

/** A stable, path-redacted failure for the file-text-search boundary. */
export class FileTextSearchError extends Error {
  readonly code: FileTextSearchErrorCode;
  readonly sourcePath: string | null;

  constructor(
    options: Readonly<{
      code: FileTextSearchErrorCode;
      message: string;
      sourcePath?: string | null;
    }>
  ) {
    super(options.message);
    this.name = "FileTextSearchError";
    this.code = options.code;
    this.sourcePath = options.sourcePath ?? null;
  }
}

type ValidatedRequest = Readonly<{
  limits: FileTextSearchResourceLimits;
  preview: FileTextSearchPreviewPolicy;
  query: Readonly<{
    mode: FileTextSearchMode;
    phrase: string;
    terms: readonly string[];
  }>;
  root: string;
  selection: FileTextSearchSelection;
  signal: AbortSignal | undefined;
}>;

type NormalizedLine = Readonly<{
  spans: readonly OriginalSpan[];
  text: string;
}>;

type OriginalSpan = Readonly<{
  end: number;
  start: number;
}>;

type LineMatch = Readonly<{
  line: number;
  ranges: readonly FileTextSearchRange[];
}>;

/**
 * Searches the selected ordinary UTF-8 files below one collection root.
 * It returns filesystem facts only; callers map sourcePath to domain identity.
 */
export async function searchFileText(
  request: FileTextSearchRequest
): Promise<FileTextSearchResult> {
  const validated = validateRequest(request);
  throwIfAborted(validated.signal);
  const root = await openRoot(validated.root, validated.signal);
  const sourcePaths = await selectSourcePaths(root, validated);
  const truncation = {
    files: false,
    matches: false,
    previewCharacters: false
  };
  const hits: FileTextSearchHit[] = [];
  let previewCharacters = 0;
  let scannedBytes = 0;

  for (const sourcePath of sourcePaths) {
    throwIfAborted(validated.signal);
    const read = await readSelectedFile(
      root,
      sourcePath,
      validated.limits,
      scannedBytes,
      validated.signal
    );
    scannedBytes += read.byteLength;
    const content = read.content;
    const matches = findLineMatches(content, validated.query, validated.signal);
    if (matches.length === 0) continue;

    if (hits.length >= validated.preview.maxFiles) {
      truncation.files = true;
      break;
    }

    const limitedMatches = limitMatchRanges(
      matches,
      validated.preview.maxMatchesPerFile
    );
    if (limitedMatches.truncated) truncation.matches = true;
    const previews = previewsForMatches(
      splitPhysicalLines(content),
      limitedMatches.matches,
      validated.preview.contextLines
    );
    const bounded = boundPreviews(
      previews,
      validated.preview.maxPreviewCharacters - previewCharacters
    );
    previewCharacters += bounded.characterCount;
    if (bounded.truncated) truncation.previewCharacters = true;

    if (bounded.previews.some((preview) => preview.ranges.length > 0)) {
      hits.push({ sourcePath, previews: bounded.previews });
    } else {
      truncation.previewCharacters = true;
      break;
    }

    if (bounded.truncated) break;
  }

  return { hits, truncation };
}

function validateRequest(request: FileTextSearchRequest): ValidatedRequest {
  if (request === null || typeof request !== "object") {
    throw invalidRequest("File text search request must be an object.");
  }
  if (typeof request.root !== "string" || request.root.length === 0) {
    throw invalidRequest("File text search root must be a non-empty path.");
  }
  if (request.query === null || typeof request.query !== "object") {
    throw invalidRequest("File text search query must be an object.");
  }
  if (typeof request.query.text !== "string") {
    throw invalidRequest("File text search query text must be a string.");
  }
  if (!isSearchMode(request.query.mode)) {
    throw invalidRequest("File text search query mode is unsupported.");
  }
  const normalizedQuery = normalizeSearchText(request.query.text);
  if (normalizedQuery.length === 0) {
    throw invalidRequest("File text search query text must not be empty.");
  }
  if (request.preview === null || typeof request.preview !== "object") {
    throw invalidRequest("File text search preview policy must be an object.");
  }
  validatePreviewPolicy(request.preview);
  const limits = validateResourceLimits(request.limits);
  validateSelection(request.selection, limits.maxCandidateFiles);

  return {
    limits,
    preview: request.preview,
    query: {
      mode: request.query.mode,
      phrase: normalizedQuery,
      terms: [...new Set(normalizedQuery.split(" "))]
    },
    root: request.root,
    selection: request.selection,
    signal: request.signal
  };
}

function validateResourceLimits(
  input: FileTextSearchRequest["limits"]
): FileTextSearchResourceLimits {
  if (input !== undefined && (input === null || typeof input !== "object")) {
    throw invalidRequest("File text search resource limits must be an object.");
  }
  const limits = { ...defaultResourceLimits, ...input };
  for (const key of [
    "maxCandidateFiles",
    "maxFileBytes",
    "maxTotalBytes"
  ] as const) {
    if (!isPositiveInteger(limits[key])) {
      throw invalidRequest(
        `File text search ${key} must be a positive integer.`
      );
    }
  }
  return limits;
}

function validatePreviewPolicy(policy: FileTextSearchPreviewPolicy): void {
  if (!isNonNegativeInteger(policy.contextLines)) {
    throw invalidRequest(
      "File text search contextLines must be a non-negative integer."
    );
  }
  for (const key of [
    "maxFiles",
    "maxMatchesPerFile",
    "maxPreviewCharacters"
  ] as const) {
    if (!isPositiveInteger(policy[key])) {
      throw invalidRequest(
        `File text search ${key} must be a positive integer.`
      );
    }
  }
}

function validateSelection(
  selection: FileTextSearchSelection,
  maxCandidateFiles: number
): void {
  if (selection === null || typeof selection !== "object") {
    throw invalidRequest("File text search selection must be an object.");
  }
  if (selection.kind === "files") {
    if ("include" in selection || "exclude" in selection) {
      throw invalidRequest(
        "File text search selection must use either files or patterns."
      );
    }
    if (!Array.isArray(selection.sourcePaths)) {
      throw invalidRequest(
        "File text search file selection must contain sourcePaths."
      );
    }
    if (selection.sourcePaths.length > maxCandidateFiles) {
      throw resourceLimit(
        "File text search candidate file limit was exceeded."
      );
    }
    for (const sourcePath of selection.sourcePaths) {
      parseSourcePath(sourcePath);
    }
    return;
  }
  if (selection.kind === "patterns") {
    if ("sourcePaths" in selection) {
      throw invalidRequest(
        "File text search selection must use either files or patterns."
      );
    }
    validatePatterns(selection.include, "include", false);
    if (selection.exclude !== undefined) {
      validatePatterns(selection.exclude, "exclude", true);
    }
    return;
  }
  throw invalidRequest("File text search selection kind is unsupported.");
}

function validatePatterns(
  patterns: unknown,
  name: string,
  allowEmpty: boolean
): void {
  if (!Array.isArray(patterns) || (!allowEmpty && patterns.length === 0)) {
    throw invalidRequest(
      `File text search ${name} patterns must not be empty.`
    );
  }
  for (const pattern of patterns) {
    if (typeof pattern !== "string" || pattern.length === 0) {
      throw invalidRequest(
        `File text search ${name} patterns must be non-empty strings.`
      );
    }
    if (
      pattern.includes("\\") ||
      path.posix.isAbsolute(pattern) ||
      path.win32.isAbsolute(pattern) ||
      pattern.split("/").includes("..") ||
      pattern.startsWith("!")
    ) {
      throw new FileTextSearchError({
        code: "invalid-path",
        message:
          "File text search patterns must remain below the collection root."
      });
    }
  }
}

async function openRoot(
  requestedRoot: string,
  signal: AbortSignal | undefined
): Promise<string> {
  const root = path.resolve(requestedRoot);
  throwIfAborted(signal);
  let entry: Awaited<ReturnType<typeof fs.lstat>>;
  try {
    entry = await fs.lstat(root);
  } catch {
    throw new FileTextSearchError({
      code: "invalid-root",
      message: "File text search root is unavailable."
    });
  }
  if (entry.isSymbolicLink() || !entry.isDirectory()) {
    throw new FileTextSearchError({
      code: "invalid-root",
      message: "File text search root must be a non-symbolic-link directory."
    });
  }
  let canonicalRoot: string;
  try {
    canonicalRoot = await fs.realpath(root);
  } catch {
    throw new FileTextSearchError({
      code: "invalid-root",
      message: "File text search root cannot be verified."
    });
  }
  throwIfAborted(signal);
  return canonicalRoot;
}

async function selectSourcePaths(
  root: string,
  request: ValidatedRequest
): Promise<readonly string[]> {
  const selected =
    request.selection.kind === "files"
      ? request.selection.sourcePaths
      : await selectPatternSourcePaths(
          root,
          request.selection,
          request.limits.maxCandidateFiles,
          request.signal
        );
  const sourcePaths = [...new Set(selected.map(parseSourcePath))].sort(
    compareText
  );
  for (const sourcePath of sourcePaths) {
    await verifySelectedFile(root, sourcePath, request.signal);
  }
  return sourcePaths;
}

async function selectPatternSourcePaths(
  root: string,
  selection: Extract<FileTextSearchSelection, { kind: "patterns" }>,
  maxCandidateFiles: number,
  signal: AbortSignal | undefined
): Promise<readonly string[]> {
  throwIfAborted(signal);
  try {
    const stream = fastGlob.stream([...selection.include], {
      absolute: false,
      cwd: root,
      dot: true,
      followSymbolicLinks: false,
      ignore: selection.exclude === undefined ? [] : [...selection.exclude],
      objectMode: false,
      onlyFiles: true,
      unique: true
    });
    const paths: string[] = [];
    for await (const entry of stream) {
      throwIfAborted(signal);
      if (paths.length >= maxCandidateFiles) {
        throw resourceLimit(
          "File text search candidate file limit was exceeded."
        );
      }
      if (typeof entry !== "string") {
        throw new FileTextSearchError({
          code: "read-failed",
          message: "File text search enumerator returned an invalid path."
        });
      }
      paths.push(toPosix(entry));
    }
    throwIfAborted(signal);
    return paths;
  } catch (error) {
    if (error instanceof FileTextSearchError) throw error;
    throw new FileTextSearchError({
      code: "read-failed",
      message: "File text search could not enumerate selected files."
    });
  }
}

async function verifySelectedFile(
  root: string,
  sourcePath: string,
  signal: AbortSignal | undefined
): Promise<void> {
  const segments = sourcePath.split("/");
  let current = root;
  for (const segment of segments) {
    throwIfAborted(signal);
    current = path.join(current, segment);
    let entry: Awaited<ReturnType<typeof fs.lstat>>;
    try {
      entry = await fs.lstat(current);
    } catch {
      throw invalidFile(
        sourcePath,
        "File text search selected file is unavailable."
      );
    }
    if (entry.isSymbolicLink()) {
      throw invalidFile(
        sourcePath,
        "File text search does not search symbolic links."
      );
    }
  }

  let entry: Awaited<ReturnType<typeof fs.lstat>>;
  try {
    entry = await fs.lstat(current);
  } catch {
    throw invalidFile(
      sourcePath,
      "File text search selected file is unavailable."
    );
  }
  if (!entry.isFile()) {
    throw invalidFile(
      sourcePath,
      "File text search only accepts ordinary files."
    );
  }
  try {
    const [canonicalRoot, canonicalFile] = await Promise.all([
      fs.realpath(root),
      fs.realpath(current)
    ]);
    if (!isPathWithinDirectory(canonicalFile, canonicalRoot)) {
      throw invalidFile(
        sourcePath,
        "File text search selected file escapes the collection root."
      );
    }
  } catch (error) {
    if (error instanceof FileTextSearchError) throw error;
    throw invalidFile(
      sourcePath,
      "File text search selected file cannot be verified."
    );
  }
}

async function readSelectedFile(
  root: string,
  sourcePath: string,
  limits: FileTextSearchResourceLimits,
  scannedBytes: number,
  signal: AbortSignal | undefined
): Promise<Readonly<{ byteLength: number; content: string }>> {
  await verifySelectedFile(root, sourcePath, signal);
  throwIfAborted(signal);
  const target = path.join(root, ...sourcePath.split("/"));
  let handle: Awaited<ReturnType<typeof fs.open>>;
  try {
    handle = await fs.open(target, constants.O_RDONLY | constants.O_NOFOLLOW);
  } catch {
    throw invalidFile(
      sourcePath,
      "File text search could not safely open a selected file."
    );
  }
  try {
    const opened = await handle.stat();
    if (!opened.isFile()) {
      throw invalidFile(
        sourcePath,
        "File text search only accepts ordinary files."
      );
    }
    if (opened.size > limits.maxFileBytes) {
      throw resourceLimit(
        "File text search single-file byte limit was exceeded."
      );
    }
    if (scannedBytes + opened.size > limits.maxTotalBytes) {
      throw resourceLimit(
        "File text search total scanned byte limit was exceeded."
      );
    }
    await verifyOpenedFile(root, sourcePath, opened, signal);
    const data = await readHandleBytes(
      handle,
      Math.min(limits.maxFileBytes, limits.maxTotalBytes - scannedBytes),
      signal
    );
    if (scannedBytes + data.length > limits.maxTotalBytes) {
      throw resourceLimit(
        "File text search total scanned byte limit was exceeded."
      );
    }
    throwIfAborted(signal);
    try {
      return { byteLength: data.length, content: utf8Decoder.decode(data) };
    } catch {
      throw new FileTextSearchError({
        code: "invalid-utf8",
        message: "File text search selected file is not valid UTF-8.",
        sourcePath
      });
    }
  } finally {
    await handle.close();
  }
}

async function verifyOpenedFile(
  root: string,
  sourcePath: string,
  opened: Awaited<ReturnType<Awaited<ReturnType<typeof fs.open>>["stat"]>>,
  signal: AbortSignal | undefined
): Promise<void> {
  await verifySelectedFile(root, sourcePath, signal);
  const target = path.join(root, ...sourcePath.split("/"));
  let current: Awaited<ReturnType<typeof fs.lstat>>;
  try {
    current = await fs.lstat(target);
  } catch {
    throw invalidFile(
      sourcePath,
      "File text search selected file changed while it was opened."
    );
  }
  if (
    current.isSymbolicLink() ||
    !current.isFile() ||
    current.dev !== opened.dev ||
    current.ino !== opened.ino
  ) {
    throw invalidFile(
      sourcePath,
      "File text search selected file changed while it was opened."
    );
  }
}

async function readHandleBytes(
  handle: Awaited<ReturnType<typeof fs.open>>,
  maximumBytes: number,
  signal: AbortSignal | undefined
): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  while (true) {
    throwIfAborted(signal);
    const buffer = new Uint8Array(
      Math.min(64 * 1024, maximumBytes - byteLength + 1)
    );
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, null);
    if (bytesRead === 0) break;
    byteLength += bytesRead;
    if (byteLength > maximumBytes) {
      throw resourceLimit("File text search byte limit was exceeded.");
    }
    chunks.push(buffer.slice(0, bytesRead));
  }
  const content = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    content.set(chunk, offset);
    offset += chunk.length;
  }
  return content;
}

function findLineMatches(
  content: string,
  query: ValidatedRequest["query"],
  signal: AbortSignal | undefined
): readonly LineMatch[] {
  const lines = splitPhysicalLines(content);
  const normalizedLines: NormalizedLine[] = [];
  const rangesByLine: Array<readonly FileTextSearchRange[]> = [];
  for (const line of lines) {
    throwIfAborted(signal);
    const normalized = normalizeLine(line);
    normalizedLines.push(normalized);
    rangesByLine.push(
      query.mode === "phrase"
        ? rangesForNeedle(normalized, query.phrase, signal)
        : rangesForTerms(normalized, query.terms, signal)
    );
  }
  const fileMatches =
    query.mode === "all"
      ? query.terms.every((term) => {
          throwIfAborted(signal);
          return normalizedLines.some((line) => line.text.includes(term));
        })
      : rangesByLine.some((ranges) => ranges.length > 0);
  if (!fileMatches) return [];

  return rangesByLine.flatMap((ranges, index) =>
    ranges.length === 0 ? [] : [{ line: index + 1, ranges }]
  );
}

function splitPhysicalLines(content: string): readonly string[] {
  const lines = content.split(/\r\n|[\n\r]/u);
  if (/(?:\r\n|[\n\r])$/u.test(content)) lines.pop();
  return lines;
}

function normalizeLine(line: string): NormalizedLine {
  const normalized = line.normalize("NFKC").toLowerCase();
  const mappedCharacters: Array<{ end: number; start: number; text: string }> =
    [];
  let normalizedOffset = 0;
  for (const segment of segmenter.segment(line)) {
    const expected = segment.segment.normalize("NFKC").toLowerCase();
    const start = segment.index;
    const end = start + segment.segment.length;
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
  const last = mappedCharacters.at(-1);
  while (normalizedOffset < normalized.length) {
    const length = nextCodePointLength(normalized, normalizedOffset);
    const text = normalized.slice(normalizedOffset, normalizedOffset + length);
    appendNormalizedCharacter(
      mappedCharacters,
      text,
      last?.start ?? 0,
      last?.end ?? line.length
    );
    normalizedOffset += length;
  }
  while (mappedCharacters[0]?.text === " ") mappedCharacters.shift();
  while (mappedCharacters.at(-1)?.text === " ") mappedCharacters.pop();
  return {
    spans: mappedCharacters.flatMap(({ end, start, text }) =>
      Array.from({ length: text.length }, () => ({ end, start }))
    ),
    text: mappedCharacters.map(({ text }) => text).join("")
  };
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
  line: NormalizedLine,
  terms: readonly string[],
  signal: AbortSignal | undefined
): readonly FileTextSearchRange[] {
  return mergeRanges(
    terms.flatMap((term) => rangesForNeedle(line, term, signal))
  );
}

function rangesForNeedle(
  line: NormalizedLine,
  needle: string,
  signal: AbortSignal | undefined
): readonly FileTextSearchRange[] {
  const ranges: FileTextSearchRange[] = [];
  let searchStart = 0;
  while (searchStart < line.text.length) {
    throwIfAborted(signal);
    const index = line.text.indexOf(needle, searchStart);
    if (index < 0) break;
    const start = line.spans[index]?.start;
    const end = line.spans[index + needle.length - 1]?.end;
    if (start === undefined || end === undefined) break;
    ranges.push({ end, start });
    searchStart = index + 1;
  }
  return mergeRanges(ranges);
}

function mergeRanges(
  ranges: readonly FileTextSearchRange[]
): readonly FileTextSearchRange[] {
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

function limitMatchRanges(
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

function boundPreviews(
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

function previewsForMatches(
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

function parseSourcePath(sourcePath: unknown): string {
  if (
    typeof sourcePath !== "string" ||
    sourcePath.length === 0 ||
    sourcePath.includes("\\") ||
    sourcePath.includes("\0") ||
    path.posix.isAbsolute(sourcePath) ||
    path.win32.isAbsolute(sourcePath)
  ) {
    throw new FileTextSearchError({
      code: "invalid-path",
      message:
        "File text search source paths must be root-relative POSIX paths."
    });
  }
  const segments = sourcePath.split("/");
  if (
    segments.some(
      (segment) => segment.length === 0 || segment === "." || segment === ".."
    )
  ) {
    throw new FileTextSearchError({
      code: "invalid-path",
      message:
        "File text search source paths must remain below the collection root."
    });
  }
  return segments.join("/");
}

function isSearchMode(value: unknown): value is FileTextSearchMode {
  return value === "all" || value === "any" || value === "phrase";
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function invalidRequest(message: string): FileTextSearchError {
  return new FileTextSearchError({ code: "invalid-request", message });
}

function resourceLimit(message: string): FileTextSearchError {
  return new FileTextSearchError({ code: "resource-limit", message });
}

function invalidFile(
  messageSourcePath: string,
  message: string
): FileTextSearchError {
  return new FileTextSearchError({
    code: "invalid-file",
    message,
    sourcePath: messageSourcePath
  });
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted === true) {
    throw new FileTextSearchError({
      code: "aborted",
      message: "File text search was aborted."
    });
  }
}

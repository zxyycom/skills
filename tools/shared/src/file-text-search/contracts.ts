import type {
  TextSearchMatcher,
  TextSearchMode,
  TextSearchRange
} from "./segment-matcher.ts";

export type FileTextSearchMode = TextSearchMode;

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

export type FileTextSearchRange = TextSearchRange;

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

export type ValidatedRequest = Readonly<{
  limits: FileTextSearchResourceLimits;
  preview: FileTextSearchPreviewPolicy;
  query: TextSearchMatcher;
  root: string;
  selection: FileTextSearchSelection;
  signal: AbortSignal | undefined;
}>;

export type LineMatch = Readonly<{
  line: number;
  ranges: readonly FileTextSearchRange[];
}>;

export function invalidRequest(message: string): FileTextSearchError {
  return new FileTextSearchError({ code: "invalid-request", message });
}

export function resourceLimit(message: string): FileTextSearchError {
  return new FileTextSearchError({ code: "resource-limit", message });
}

export function invalidFile(
  messageSourcePath: string,
  message: string
): FileTextSearchError {
  return new FileTextSearchError({
    code: "invalid-file",
    message,
    sourcePath: messageSourcePath
  });
}

export function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted === true) {
    throw new FileTextSearchError({
      code: "aborted",
      message: "File text search was aborted."
    });
  }
}

import type {
  FileTextSearchHit,
  FileTextSearchRequest,
  FileTextSearchResult,
  FileTextSearchResourceLimits,
  FileTextSearchPreviewPolicy,
  ValidatedRequest
} from "./contracts.ts";
import { throwIfAborted } from "./contracts.ts";
import { openRoot, readSelectedFile, selectSourcePaths } from "./files.ts";
import {
  boundPreviews,
  findLimitedLineMatches,
  hasLineMatches,
  previewsForMatches,
  splitPhysicalLines
} from "./previews.ts";
import { validateRequest } from "./request.ts";

export type RecordTextSearchResult = FileTextSearchResult &
  Readonly<{
    matched: number;
    scannedFiles: number;
    selectedFiles: number;
    limits: FileTextSearchResourceLimits;
    preview: FileTextSearchPreviewPolicy;
  }>;

type RecordTextSourceValidator = (
  source: Readonly<{ sourcePath: string; content: string }>
) => void;

/** Counts matching files independently of the display budget; a first hidden hit bounds scanning. */
export async function searchRecordText(
  request: FileTextSearchRequest,
  validateSource?: RecordTextSourceValidator
): Promise<RecordTextSearchResult> {
  const validated = validateRequest(request);
  throwIfAborted(validated.signal);
  const root = await openRoot(validated.root, validated.signal);
  const sourcePaths = await selectSourcePaths(root, validated);
  return await collectRecordHits(root, sourcePaths, validated, validateSource);
}

type RecordSearchState = {
  hits: FileTextSearchHit[];
  truncation: { files: boolean; matches: boolean; previewCharacters: boolean };
  matched: number;
  scannedFiles: number;
  scannedBytes: number;
  previewCharacters: number;
};

async function collectRecordHits(
  root: string,
  sourcePaths: readonly string[],
  validated: ValidatedRequest,
  validateSource: RecordTextSourceValidator | undefined
): Promise<RecordTextSearchResult> {
  const state: RecordSearchState = {
    hits: [],
    truncation: { files: false, matches: false, previewCharacters: false },
    matched: 0,
    scannedFiles: 0,
    scannedBytes: 0,
    previewCharacters: 0
  };
  for (const sourcePath of sourcePaths) {
    if (
      !(await collectRecordHit(
        root,
        sourcePath,
        validated,
        state,
        validateSource
      ))
    )
      break;
  }
  return {
    hits: state.hits,
    truncation: state.truncation,
    matched: state.matched,
    scannedFiles: state.scannedFiles,
    selectedFiles: sourcePaths.length,
    limits: validated.limits,
    preview: validated.preview
  };
}

async function collectRecordHit(
  root: string,
  sourcePath: string,
  validated: ValidatedRequest,
  state: RecordSearchState,
  validateSource: RecordTextSourceValidator | undefined
): Promise<boolean> {
  throwIfAborted(validated.signal);
  const read = await readSelectedFile(
    root,
    sourcePath,
    validated.limits,
    state.scannedBytes,
    validated.signal
  );
  validateSource?.({ sourcePath, content: read.content });
  throwIfAborted(validated.signal);
  state.scannedBytes += read.byteLength;
  state.scannedFiles += 1;
  const lines = splitPhysicalLines(read.content);
  if (state.hits.length >= validated.preview.maxFiles) {
    if (hasLineMatches(lines, validated.query, validated.signal)) {
      state.matched += 1;
      state.truncation.files = true;
      return false;
    }
    return true;
  }
  const matches = findLimitedLineMatches(
    lines,
    validated.query,
    validated.preview.maxMatchesPerFile,
    validated.signal
  );
  if (!matches.matched) return true;
  state.matched += 1;
  const previewed = recordPreviews(
    lines,
    matches,
    validated.preview,
    state.previewCharacters
  );
  state.previewCharacters += previewed.characterCount;
  state.truncation.matches ||= previewed.matchesTruncated;
  state.truncation.previewCharacters ||= previewed.truncated;
  state.hits.push({ sourcePath, previews: previewed.previews });
  return true;
}

function recordPreviews(
  lines: readonly string[],
  limited: ReturnType<typeof findLimitedLineMatches>,
  policy: ValidatedRequest["preview"],
  usedCharacters: number
) {
  const previews = previewsForMatches(
    lines,
    limited.matches,
    policy.contextLines
  );
  return {
    ...boundPreviews(previews, policy.maxPreviewCharacters - usedCharacters),
    matchesTruncated: limited.truncated
  };
}

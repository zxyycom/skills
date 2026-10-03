import type {
  FileTextSearchHit,
  FileTextSearchRequest,
  FileTextSearchResult,
  FileTextSearchResourceLimits,
  FileTextSearchPreviewPolicy,
  ValidatedRequest,
  LineMatch
} from "./contracts.ts";
import { throwIfAborted } from "./contracts.ts";
import { openRoot, readSelectedFile, selectSourcePaths } from "./files.ts";
import {
  boundPreviews,
  findLineMatches,
  limitMatchRanges,
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

/** Counts matching files independently of the display budget; a first hidden hit bounds scanning. */
export async function searchRecordText(
  request: FileTextSearchRequest
): Promise<RecordTextSearchResult> {
  const validated = validateRequest(request);
  throwIfAborted(validated.signal);
  const root = await openRoot(validated.root, validated.signal);
  const sourcePaths = await selectSourcePaths(root, validated);
  return await collectRecordHits(root, sourcePaths, validated);
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
  validated: ValidatedRequest
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
    if (!(await collectRecordHit(root, sourcePath, validated, state))) break;
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
  state: RecordSearchState
): Promise<boolean> {
  throwIfAborted(validated.signal);
  const read = await readSelectedFile(
    root,
    sourcePath,
    validated.limits,
    state.scannedBytes,
    validated.signal
  );
  state.scannedBytes += read.byteLength;
  state.scannedFiles += 1;
  const matches = findLineMatches(
    read.content,
    validated.query,
    validated.signal
  );
  if (matches.length === 0) return true;
  state.matched += 1;
  if (state.hits.length >= validated.preview.maxFiles) {
    state.truncation.files = true;
    return false;
  }
  const previewed = recordPreviews(
    read.content,
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
  content: string,
  matches: readonly LineMatch[],
  policy: ValidatedRequest["preview"],
  usedCharacters: number
) {
  const limited = limitMatchRanges(matches, policy.maxMatchesPerFile);
  const previews = previewsForMatches(
    splitPhysicalLines(content),
    limited.matches,
    policy.contextLines
  );
  return {
    ...boundPreviews(previews, policy.maxPreviewCharacters - usedCharacters),
    matchesTruncated: limited.truncated
  };
}

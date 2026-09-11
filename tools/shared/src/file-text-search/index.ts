import type {
  FileTextSearchHit,
  FileTextSearchRequest,
  FileTextSearchResult
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

export {
  FileTextSearchError,
  type FileTextSearchErrorCode,
  type FileTextSearchHit,
  type FileTextSearchMode,
  type FileTextSearchPreview,
  type FileTextSearchPreviewPolicy,
  type FileTextSearchRange,
  type FileTextSearchRequest,
  type FileTextSearchResourceLimits,
  type FileTextSearchResult,
  type FileTextSearchSelection,
  type FileTextSearchTruncation
} from "./contracts.ts";

export {
  createTextSearchMatcher,
  matchTextSegments,
  TextSearchMatcherError,
  type TextSearchMatcher,
  type TextSearchMatcherErrorCode,
  type TextSearchMode,
  type TextSearchQuery,
  type TextSearchRange,
  type TextSearchSegment,
  type TextSearchSegmentMatch
} from "./segment-matcher.ts";

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
  return await collectSearchResult(
    root,
    await selectSourcePaths(root, validated),
    validated
  );
}

type SearchState = {
  hits: FileTextSearchHit[];
  previewCharacters: number;
  scannedBytes: number;
  truncation: { files: boolean; matches: boolean; previewCharacters: boolean };
};

async function collectSearchResult(
  root: string,
  sourcePaths: readonly string[],
  validated: ReturnType<typeof validateRequest>
): Promise<FileTextSearchResult> {
  const state: SearchState = {
    hits: [],
    previewCharacters: 0,
    scannedBytes: 0,
    truncation: { files: false, matches: false, previewCharacters: false }
  };
  for (const sourcePath of sourcePaths) {
    if (!(await collectSearchHit(root, sourcePath, validated, state))) break;
  }
  return { hits: state.hits, truncation: state.truncation };
}

async function collectSearchHit(
  root: string,
  sourcePath: string,
  validated: ReturnType<typeof validateRequest>,
  state: SearchState
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
  const matches = findLineMatches(
    read.content,
    validated.query,
    validated.signal
  );
  if (matches.length === 0) return true;
  if (state.hits.length >= validated.preview.maxFiles) {
    state.truncation.files = true;
    return false;
  }
  const hit = createSearchHit(
    sourcePath,
    read.content,
    matches,
    validated,
    state
  );
  if (hit === null) return false;
  state.hits.push(hit);
  return !state.truncation.previewCharacters;
}

function createSearchHit(
  sourcePath: string,
  content: string,
  matches: ReturnType<typeof findLineMatches>,
  validated: ReturnType<typeof validateRequest>,
  state: SearchState
): FileTextSearchHit | null {
  const limited = limitMatchRanges(
    matches,
    validated.preview.maxMatchesPerFile
  );
  if (limited.truncated) state.truncation.matches = true;
  const previews = previewsForMatches(
    splitPhysicalLines(content),
    limited.matches,
    validated.preview.contextLines
  );
  const bounded = boundPreviews(
    previews,
    validated.preview.maxPreviewCharacters - state.previewCharacters
  );
  state.previewCharacters += bounded.characterCount;
  if (bounded.truncated) state.truncation.previewCharacters = true;
  if (bounded.previews.some((preview) => preview.ranges.length > 0)) {
    return { sourcePath, previews: bounded.previews };
  }
  state.truncation.previewCharacters = true;
  return null;
}

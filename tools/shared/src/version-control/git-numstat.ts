import { VersionControlError } from "./errors.ts";
import { normalizeRepositoryPath } from "./repository-path.ts";
import type {
  RevisionId,
  VersionControlPathChange,
  VersionControlRevisionChange
} from "./types.ts";

const objectIdPattern = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u;
const lineCountPattern = /^(?:0|[1-9][0-9]*)$/u;

type RevisionHeader = {
  parents: RevisionId[];
  revision: RevisionId;
};

export function parseGitFirstParentRevisionChanges(
  output: string,
  from: RevisionId,
  to: RevisionId
): VersionControlRevisionChange[] {
  if (from === to) {
    if (output.length !== 0) {
      throw parseError();
    }
    return [];
  }
  if (output.length === 0) {
    throw firstParentError(from, to);
  }
  if (output[0] !== "\0" || !output.endsWith("\0")) {
    throw parseError();
  }

  const tokens = output.split("\0");
  if (tokens.shift() !== "" || tokens.pop() !== "") {
    throw parseError();
  }

  const revisions: VersionControlRevisionChange[] = [];
  let current: VersionControlRevisionChange | null = null;
  let expectingHeader = true;
  let expectingChangeSeparator = false;
  let expectedParent = from;

  for (const token of tokens) {
    if (expectingHeader) {
      if (token.length === 0) {
        throw parseError();
      }
      const header = parseRevisionHeader(token);
      if (header.parents[0] !== expectedParent) {
        throw firstParentError(from, to);
      }
      current = { changes: [], revision: header.revision };
      revisions.push(current);
      expectedParent = header.revision;
      expectingHeader = false;
      expectingChangeSeparator = true;
      continue;
    }

    if (expectingChangeSeparator) {
      if (token !== "") {
        throw parseError();
      }
      expectingChangeSeparator = false;
      continue;
    }

    if (token.length === 0) {
      current = null;
      expectingHeader = true;
      continue;
    }
    if (current === null) {
      throw parseError();
    }

    const record = current.changes.length === 0
      ? removeFirstChangePrefix(token)
      : token;
    current.changes.push(parseNumstatRecord(record));
  }

  if (
    expectingHeader
    || expectingChangeSeparator
    || revisions.length === 0
  ) {
    throw parseError();
  }
  if (expectedParent !== to) {
    throw firstParentError(from, to);
  }
  for (const revision of revisions) {
    const seenPaths = new Set<string>();
    revision.changes.sort((left, right) => left.path.localeCompare(right.path));
    for (const change of revision.changes) {
      if (seenPaths.has(change.path)) {
        throw parseError();
      }
      seenPaths.add(change.path);
    }
  }
  return revisions;
}

function parseRevisionHeader(token: string): RevisionHeader {
  const separatorIndex = token.indexOf("\t");
  if (separatorIndex === -1 || token.indexOf("\t", separatorIndex + 1) !== -1) {
    throw parseError();
  }
  const revision = token.slice(0, separatorIndex);
  const parentText = token.slice(separatorIndex + 1);
  const parents = parentText.length === 0 ? [] : parentText.split(" ");
  if (
    !objectIdPattern.test(revision)
    || parents.some((parent) => !objectIdPattern.test(parent))
    || new Set(parents).size !== parents.length
  ) {
    throw parseError();
  }
  return { parents, revision };
}

function removeFirstChangePrefix(token: string): string {
  if (!token.startsWith("\n")) {
    throw parseError();
  }
  return token.slice(1);
}

function parseNumstatRecord(record: string): VersionControlPathChange {
  const firstTab = record.indexOf("\t");
  const secondTab = record.indexOf("\t", firstTab + 1);
  if (firstTab <= 0 || secondTab <= firstTab + 1) {
    throw parseError();
  }

  const addedText = record.slice(0, firstTab);
  const deletedText = record.slice(firstTab + 1, secondTab);
  let path: string;
  try {
    path = normalizeRepositoryPath(record.slice(secondTab + 1));
  } catch {
    throw parseError();
  }
  if (addedText === "-" || deletedText === "-") {
    if (addedText !== "-" || deletedText !== "-") {
      throw parseError();
    }
    return { addedLineCount: null, deletedLineCount: null, path };
  }

  return {
    addedLineCount: parseLineCount(addedText),
    deletedLineCount: parseLineCount(deletedText),
    path
  };
}

function parseLineCount(value: string): number {
  if (!lineCountPattern.test(value)) {
    throw parseError();
  }
  const count = Number(value);
  if (!Number.isSafeInteger(count)) {
    throw parseError();
  }
  return count;
}

function parseError(): VersionControlError {
  return new VersionControlError(
    "operation-failed",
    "Version-control operation failed: parse first-parent revision changes"
  );
}

function firstParentError(
  from: RevisionId,
  to: RevisionId
): VersionControlError {
  return new VersionControlError(
    "revision-not-first-parent",
    `Version-control revision ${from} is not on the first-parent history of ${to}`
  );
}

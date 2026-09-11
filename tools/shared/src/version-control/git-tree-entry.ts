import { normalizeRepositoryPath } from "./repository-path.ts";

const gitTreeModePattern = /^[0-7]{6}$/u;
const objectIdPattern = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u;

export type GitTreeEntry = {
  mode: string;
  objectId: string;
  objectType: string;
  path: string;
};

export function parseGitTreeEntries(output: string): GitTreeEntry[] {
  const records = output.split("\0");
  if (records.at(-1) === "") {
    records.pop();
  }

  return records.map(parseGitTreeRecord);
}

function parseGitTreeRecord(record: string): GitTreeEntry {
  const separatorIndex = record.indexOf("\t");
  const metadata =
    separatorIndex === -1 ? [] : record.slice(0, separatorIndex).split(/\s+/u);
  const [mode, objectType, objectId] = metadata;
  if (!isTreeMetadata(metadata, mode, objectType, objectId)) {
    throw new Error("Invalid Git tree entry");
  }
  return {
    mode,
    objectId,
    objectType,
    path: normalizeRepositoryPath(record.slice(separatorIndex + 1))
  };
}

function isTreeMetadata(
  metadata: readonly string[],
  mode: string | undefined,
  objectType: string | undefined,
  objectId: string | undefined
): boolean {
  return [
    metadata.length === 3,
    gitTreeModePattern.test(mode ?? ""),
    objectType !== undefined && objectType.length > 0,
    objectIdPattern.test(objectId ?? "")
  ].every(Boolean);
}

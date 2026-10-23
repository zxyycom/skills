import fs from "node:fs/promises";
import path from "node:path";
import type { Dirent } from "node:fs";
import { parseDocument, isMap, isScalar } from "yaml";
import {
  prepareRecordCandidates,
  type CandidateMember,
  type RecordCandidateCollection
} from "../../record-operations/src/candidate.ts";
import { recordCollectionIdentity } from "../../record-operations/src/source.ts";
import { loadDecisionIndexSnapshot } from "./decision-index-snapshot.ts";
import { isDecisionId, isDecisionSourcePath } from "./decision-path.ts";
import {
  decisionIndexFileName,
  decisionIndexDiagnosticMessages
} from "./decision-state-index.ts";

export type CandidateIdentityContext = Readonly<{
  decisionsDirectory: string;
  records: readonly Readonly<{ decisionId: string; sourcePath: string }>[];
  collection: RecordCandidateCollection;
}>;

export async function loadCandidateIdentityContext(
  decisionsDirectory: string
): Promise<CandidateIdentityContext> {
  const identity = await recordCollectionIdentity(decisionsDirectory);
  const collection = await prepareRecordCandidates({
    directory: decisionsDirectory,
    indexFileName: decisionIndexFileName,
    loadPublished: async () => {
      const loaded = await loadDecisionIndexSnapshot({
        decisionsDirectory,
        queryOnly: true
      });
      if (loaded.status === "error")
        throw new Error(
          decisionIndexDiagnosticMessages(loaded.diagnostics).join("; ") +
            "; repair sources and explicitly sync-index"
        );
      return Object.entries(loaded.value.index.entries).map(([id, state]) => ({
        id,
        sourcePath: state.sourcePath
      }));
    },
    members: async () => await candidateMembers(decisionsDirectory),
    header: readDecisionCandidateHeader
  });
  await assertDiscoveryDirectoryIdentity(decisionsDirectory, identity);
  return {
    decisionsDirectory,
    collection,
    records: [...collection.formal, ...collection.candidates].map(
      ({ id, sourcePath }) => ({ decisionId: id, sourcePath })
    )
  };
}

async function candidateMembers(directory: string): Promise<CandidateMember[]> {
  const members: CandidateMember[] = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    if (entry.name === decisionIndexFileName) {
      continue;
    }
    if (entry.name === "archive") {
      members.push(...(await archivedCandidateMembers(directory, entry)));
    } else {
      members.push(regularCandidateMember(entry, entry.name));
    }
  }
  return members.sort((left, right) =>
    left.sourcePath.localeCompare(right.sourcePath)
  );
}

async function archivedCandidateMembers(
  directory: string,
  entry: Dirent<string>
): Promise<CandidateMember[]> {
  if (!entry.isDirectory() || entry.isSymbolicLink()) {
    throw new Error("Decision archive must be a regular directory");
  }
  const archive = path.join(directory, "archive");
  const identity = await recordCollectionIdentity(archive);
  const entries = await fs.readdir(archive, { withFileTypes: true });
  await assertDiscoveryDirectoryIdentity(archive, identity);
  return entries.map((archived) =>
    regularCandidateMember(archived, "archive/" + archived.name)
  );
}

/** 目录发现独立证明路径身份，不依赖读取已发布正式文件的 header。 */
async function assertDiscoveryDirectoryIdentity(
  directory: string,
  expected: Readonly<{ dev: number; ino: number }>
): Promise<void> {
  const current = await recordCollectionIdentity(directory);
  if (current.dev !== expected.dev || current.ino !== expected.ino)
    throw new Error(
      "Decision discovery directory identity changed: " + directory
    );
}

function regularCandidateMember(
  entry: Dirent<string>,
  sourcePath: string
): CandidateMember {
  if (
    !entry.isFile() ||
    entry.isSymbolicLink() ||
    !isDecisionSourcePath(sourcePath)
  ) {
    throw new Error(sourcePath + " is not an allowed regular Decision member");
  }
  return { sourcePath, kind: "unknown" };
}

function candidateHeaderFields(text: string) {
  const raw = text
    .replace(/^\uFEFF/, "")
    .match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (raw === null) {
    return [];
  }
  const document = parseDocument(raw[1]!);
  return isMap(document.contents) ? document.contents.items : [];
}

type HeaderFields = ReturnType<typeof candidateHeaderFields>;

function candidateHeaderStatus(fields: HeaderFields, sourcePath: string) {
  const statuses = fields.filter(
    (pair) => isScalar(pair.key) && pair.key.value === "status"
  );
  if (statuses.length !== 1) {
    throw new Error(
      sourcePath +
        " cannot be safely classified: ambiguous Decision header identity/status"
    );
  }
  const value = statuses[0]?.value;
  const status = isScalar(value) ? value.value : undefined;
  if (status !== "candidate" && status !== "active" && status !== "archived") {
    throw new Error(
      sourcePath +
        " cannot be safely classified as candidate or established Decision"
    );
  }
  if ((status === "archived") !== sourcePath.startsWith("archive/")) {
    throw new Error(sourcePath + " status must match its physical sourcePath");
  }
  return status;
}

function readDecisionCandidateHeader(text: string, member: CandidateMember) {
  const fields = candidateHeaderFields(text);
  const ids = fields.filter(
    (pair) => isScalar(pair.key) && pair.key.value === "id"
  );
  if (ids.length > 1) {
    throw new Error(
      member.sourcePath +
        " cannot be safely classified: ambiguous Decision header identity/status"
    );
  }
  const status = candidateHeaderStatus(fields, member.sourcePath);
  const value = ids[0]?.value;
  const id = isScalar(value) && isDecisionId(value.value) ? value.value : null;
  return {
    id,
    kind: status === "candidate" ? ("candidate" as const) : ("formal" as const)
  };
}

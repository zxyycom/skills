/*
 * Synced TypeScript runtime; repository maintenance edits tools/investigation-report/src/candidates/candidate-discovery.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/investigation-report/src/candidates/candidate-discovery.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/investigation-report/src/candidates/candidate-discovery.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/investigation-report
 * Rebuild: bun run sync:investigation-report-check
 */
import type { Dirent } from "node:fs";
import { parseDocument, isMap, isScalar } from "yaml";
import fs from "node:fs/promises";
import {
  prepareRecordCandidates,
  type CandidateMember,
  type RecordCandidateCollection
} from "../../../record-operations/src/candidate.ts";
import {
  investigationCandidateIdFromFileName,
  isReservedInvestigationCandidateFileName
} from "./candidate-path.ts";
import {
  investigationIndexFileName,
  isInvestigationSourcePath,
  isInvestigationId
} from "../collection/report-path.ts";
import { investigationResourcesDirectoryName } from "../resources/resource-reference.ts";
import { loadInvestigationQueryIndex } from "../index/investigation-state-index.ts";
import type { InvestigationCollectionLayout } from "../collection/investigation-layout.ts";

export type CandidateCollectionLayout = InvestigationCollectionLayout &
  Readonly<{ candidateCollection?: RecordCandidateCollection }>;

/** Candidate-only discovery does not change strict/stage collection inspection. */
export async function discoverInvestigationCandidates(
  directory: string
): Promise<
  CandidateCollectionLayout & { candidateCollection: RecordCandidateCollection }
> {
  const collection = await prepareRecordCandidates({
    directory,
    indexFileName: investigationIndexFileName,
    loadPublished: async () => {
      const loaded = await loadInvestigationQueryIndex({
        investigationsDirectory: directory
      });
      if (loaded.status === "error")
        throw new Error(
          loaded.diagnostics.map(({ message }) => message).join("; ") +
            "; repair sources and explicitly sync-index"
        );
      return Object.entries(loaded.value.entries).map(([id, state]) => ({
        id,
        sourcePath: state.sourcePath
      }));
    },
    members: async () => await candidateMembers(directory),
    header: (text, member) => ({
      id: candidateIdentityFromMarkdown(text),
      kind: member.kind === "candidate" ? "candidate" : "formal"
    })
  });
  return {
    candidateCollection: collection,
    candidateErrors: [...collection.warnings],
    candidateIds: collection.candidates.map(({ id }) => id),
    candidateSources: [...collection.candidates],
    formalSources: [],
    reportIds: collection.formal.map(({ id }) => id),
    errors: []
  };
}

async function candidateMembers(directory: string): Promise<CandidateMember[]> {
  const members: CandidateMember[] = [];
  const entries = await fs.readdir(directory, { withFileTypes: true });
  for (const entry of entries.sort((left, right) =>
    left.name.localeCompare(right.name)
  )) {
    if (entry.name === investigationResourcesDirectoryName) {
      validateCandidateResourceDirectory(entry);
      continue;
    }
    if (entry.name === investigationIndexFileName) {
      continue;
    }
    members.push(candidateMember(entry));
  }
  return members;
}

function validateCandidateResourceDirectory(entry: Dirent<string>): void {
  if (!entry.isDirectory() || entry.isSymbolicLink()) {
    throw new Error("_resources must be a directory and not a symbolic link");
  }
}

function candidateMember(entry: Dirent<string>): CandidateMember {
  if (!entry.isFile() || entry.isSymbolicLink()) {
    throw new Error(
      entry.name +
        " is not allowed at the investigation root; members must be regular files without a symbolic link"
    );
  }
  if (investigationCandidateIdFromFileName(entry.name) !== null) {
    return { sourcePath: entry.name, kind: "candidate" };
  }
  if (
    isReservedInvestigationCandidateFileName(entry.name) ||
    !isInvestigationSourcePath(entry.name)
  ) {
    throw new Error(
      entry.name + " is not an allowed Investigation member path"
    );
  }
  return { sourcePath: entry.name, kind: "formal" };
}

function candidateIdentityFromMarkdown(text: string): string | null {
  const header = text
    .replace(/^\uFEFF/, "")
    .match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (header === null) {
    return null;
  }
  const document = parseDocument(header[1]!);
  if (!isMap(document.contents)) {
    return null;
  }
  const declarations = document.contents.items.filter(
    (pair) => isScalar(pair.key) && pair.key.value === "id"
  );
  if (declarations.length > 1) {
    throw new Error(
      "candidate header has ambiguous duplicate frontmatter id declarations"
    );
  }
  const value = declarations[0]?.value;
  return isScalar(value) &&
    typeof value.value === "string" &&
    isInvestigationId(value.value)
    ? value.value
    : null;
}

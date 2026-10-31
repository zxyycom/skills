/*
 * Synced TypeScript runtime; repository maintenance edits tools/investigation-report/src/candidates/create/candidate-create-transaction.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/investigation-report/src/candidates/create/candidate-create-transaction.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/investigation-report/src/candidates/create/candidate-create-transaction.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/investigation-report
 * Rebuild: bun run sync:investigation-report-check
 */
import type { RecordTransactionPlan } from "../../../../record-operations/src/transactions/transaction.ts";
import path from "node:path";
import { readRecordFileSnapshot } from "../../../../record-operations/src/transactions/transaction-files.ts";
import { investigationFileWrite } from "../../transactions/transaction-files.ts";
import { investigationIndexFileName } from "../../collection/report-path.ts";
import {
  safeCandidateLayout,
  writeCandidateAtomically
} from "../candidate-support.ts";
import type { CandidateCollectionLayout } from "../candidate-discovery.ts";
import type { PreparedInvestigationCandidateCreateOptions } from "./candidate-creation-input.ts";
export type CandidateCreationContext = {
  readonly directory: string;
  readonly candidate: PreparedInvestigationCandidateCreateOptions;
  readonly layout: CandidateCollectionLayout;
  readonly target: string;
  readonly markdown: string;
  readonly cleanupWarnings: string[];
  verifiedLayout: CandidateCollectionLayout;
};

export async function prepareCandidateCreation(
  context: CandidateCreationContext
): Promise<RecordTransactionPlan<PreparedInvestigationCandidateCreateOptions>> {
  const {
    directory: investigationsDirectory,
    candidate,
    layout,
    target,
    markdown
  } = context;
  const file = await investigationFileWrite(
    investigationsDirectory,
    target,
    null,
    markdown,
    {
      writer: async () => {
        const written = await writeCandidateAtomically(target, markdown);
        if (written.isErr()) throw written.error;
        context.cleanupWarnings.push(...written.value.warnings);
        return written.value.identity;
      },
      creationMode: 0o600
    }
  );
  const guards = [
    {
      path: path.join(investigationsDirectory, investigationIndexFileName),
      before: await readRecordFileSnapshot(
        investigationsDirectory,
        path.join(investigationsDirectory, investigationIndexFileName)
      )
    }
  ];
  for (const source of layout.candidateSources) {
    const unchanged = await investigationFileWrite(
      investigationsDirectory,
      path.join(investigationsDirectory, source.sourcePath),
      source.text,
      source.text
    );
    guards.push({ path: unchanged.path, before: unchanged.before });
  }
  return {
    value: candidate,
    root: investigationsDirectory,
    writes: [file],
    index: null,
    guards
  };
}

export async function verifyCandidateCreationBeforeWrite(
  context: CandidateCreationContext
): Promise<void> {
  const { directory: investigationsDirectory, layout } = context;
  const fresh = await safeCandidateLayout(investigationsDirectory);
  if (fresh.status === "error") throw new Error(fresh.errors.join("; "));
  const expected = [...(layout.candidateCollection?.identityById ?? [])].sort(
    ([left], [right]) => left.localeCompare(right)
  );
  const current = [...fresh.value.candidateCollection.identityById].sort(
    ([left], [right]) => left.localeCompare(right)
  );
  if (JSON.stringify(expected) !== JSON.stringify(current))
    throw new Error("Candidate identities changed before exclusive creation");
}

export async function verifyCandidateCreationAfterWrite(
  context: CandidateCreationContext
): Promise<void> {
  const {
    directory: investigationsDirectory,
    layout,
    candidate,
    target
  } = context;
  const current = await safeCandidateLayout(investigationsDirectory);
  if (current.status === "error") throw new Error(current.errors.join("; "));
  const expected = new Map(layout.candidateCollection?.identityById ?? []);
  expected.set(candidate.id, {
    id: candidate.id,
    sourcePath: path.basename(target)
  });
  if (
    identitySignature(expected) !==
    identitySignature(current.value.candidateCollection.identityById)
  )
    throw new Error("Candidate identities or members changed after creation");
  context.verifiedLayout = current.value;
}

function identitySignature(
  entries: ReadonlyMap<string, Readonly<{ id: string; sourcePath: string }>>
): string {
  const identities = [...entries].map(
    ([id, source]) => [id, source.sourcePath] as const
  );
  identities.sort(([left], [right]) => left.localeCompare(right));
  return JSON.stringify(identities);
}

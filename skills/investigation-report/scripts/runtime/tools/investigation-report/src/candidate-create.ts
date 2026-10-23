/*
 * Synced TypeScript runtime; repository maintenance edits tools/investigation-report/src/candidate-create.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/investigation-report/src/candidate-create.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/investigation-report/src/candidate-create.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/investigation-report
 * Rebuild: bun run sync:investigation-report-check
 */
import { writePreparedCandidate } from "./candidate-create-publication.ts";
import { createRecordCandidate } from "../../record-operations/src/candidate.ts";
import fs from "node:fs/promises";
import path from "node:path";
import {
  canonicalizeInvestigationsDirectory,
  investigationIndexFileName,
  investigationNameFromId,
  parseDatedInvestigationId
} from "./report-path.ts";
import {
  InvestigationCollectionMutationLockError,
  withInvestigationCollectionMutationLock
} from "./collection-mutation-lock.ts";
import {
  diagnosticFromError,
  genericInvestigationDiagnostic
} from "./diagnostics.ts";
import {
  prepareCandidateCreate,
  resolveCandidateRelationSelectors,
  allocateCandidatePath,
  type PreparedInvestigationCandidateCreateOptions
} from "./candidate-creation-input.ts";
import {
  candidateOperationDiagnostic,
  createCandidateFailure,
  safeCandidateLayout
} from "./candidate-support.ts";
import type { CandidateCollectionLayout } from "./candidate-discovery.ts";
import type { InvestigationCandidateCreateResult } from "./types.ts";
import type { InvestigationRelationSummaryInput } from "./relation-summary.ts";

export async function createInvestigationCandidate(
  input: unknown
): Promise<InvestigationCandidateCreateResult> {
  return await createInvestigationCandidateWithSummaries(input, []);
}
export async function createInvestigationCandidateFromCli(
  input: unknown,
  relationSummaries: readonly InvestigationRelationSummaryInput[]
): Promise<InvestigationCandidateCreateResult> {
  return await createInvestigationCandidateWithSummaries(
    input,
    relationSummaries
  );
}
async function createInvestigationCandidateWithSummaries(
  input: unknown,
  relationSummaries: readonly InvestigationRelationSummaryInput[]
): Promise<InvestigationCandidateCreateResult> {
  const prepared = prepareCandidateCreate(input);
  if (prepared.isErr())
    return createCandidateFailure("invalid-options", prepared.error);
  try {
    await fs.mkdir(prepared.value.resolved.investigationsDirectory, {
      recursive: true
    });
  } catch (error) {
    return createCandidateFailure(
      "error",
      ["investigation candidate directory could not be created"],
      [
        diagnosticFromError({
          code: "investigation-report.candidate-directory-create-failed",
          error,
          reason:
            "the investigation directory required for the candidate could not be created",
          recovery:
            "make the configured investigation directory available and writable, then retry candidate creation",
          target: prepared.value.resolved.investigationsDirectory
        })
      ]
    );
  }
  const canonical = await canonicalizeInvestigationsDirectory(
    prepared.value.resolved
  );
  if (canonical.isErr())
    return createCandidateFailure("error", canonical.error);
  return await createCandidateUnderLock(
    canonical.value.investigationsDirectory,
    prepared.value.candidate,
    relationSummaries
  );
}

async function createCandidateUnderLock(
  investigationsDirectory: string,
  candidate: PreparedInvestigationCandidateCreateOptions,
  relationSummaries: readonly InvestigationRelationSummaryInput[]
): Promise<InvestigationCandidateCreateResult> {
  let completed: InvestigationCandidateCreateResult | undefined;
  try {
    return await withInvestigationCollectionMutationLock(
      path.join(investigationsDirectory, investigationIndexFileName),
      async () => {
        completed = await createCandidateWithinLock(
          investigationsDirectory,
          candidate,
          relationSummaries
        );
        return completed;
      }
    );
  } catch (error) {
    if (
      error instanceof InvestigationCollectionMutationLockError &&
      error.operationCompleted &&
      completed?.changed === true
    )
      return completedCandidateLockFailure(completed, error);
    return createCandidateFailure(
      "error",
      ["investigation candidate could not be created"],
      [candidateOperationDiagnostic(error, investigationsDirectory)]
    );
  }
}
async function createCandidateWithinLock(
  investigationsDirectory: string,
  initialCandidate: PreparedInvestigationCandidateCreateOptions,
  relationSummaries: readonly InvestigationRelationSummaryInput[]
): Promise<InvestigationCandidateCreateResult> {
  return await createRecordCandidate<
    CandidateCollectionLayout,
    PreparedInvestigationCandidateCreateOptions,
    InvestigationCandidateCreateResult
  >({
    discover: async () => {
      const layout = await safeCandidateLayout(investigationsDirectory);
      return layout.status === "error"
        ? {
            status: "error",
            result: createCandidateFailure(
              "error",
              layout.errors,
              layout.diagnostics
            )
          }
        : { status: "ok", value: layout.value };
    },
    resolve: (layout) => {
      const resolved = resolveCandidateRelationSelectors(
        initialCandidate,
        [...layout.reportIds, ...layout.candidateIds],
        relationSummaries
      );
      return resolved.status === "error"
        ? {
            status: "error",
            result: createCandidateFailure("error", resolved.errors)
          }
        : { status: "ok", value: resolved.candidate };
    },
    conflict: (layout, candidate) =>
      duplicateCandidateError(candidate, layout.reportIds, layout.candidateIds),
    allocate: async (_layout, candidate) =>
      await allocateCandidatePath(investigationsDirectory, candidate.id),
    writeAndReadiness: async (layout, candidate, target) =>
      await writePreparedCandidate(
        investigationsDirectory,
        candidate,
        layout,
        target
      )
  });
}

function duplicateCandidateError(
  candidate: PreparedInvestigationCandidateCreateOptions,
  reportIds: readonly string[],
  candidateIds: readonly string[]
): InvestigationCandidateCreateResult | null {
  if (reportIds.includes(candidate.id))
    return createCandidateFailure("error", [
      `${candidate.id} already exists as a formal investigation report`
    ]);
  if (candidateIds.includes(candidate.id))
    return createCandidateFailure("error", [
      `${candidate.id} investigation candidate already exists`
    ]);
  const legacy = [...reportIds, ...candidateIds].find(
    (id) =>
      parseDatedInvestigationId(id) === null &&
      investigationNameFromId(id) === investigationNameFromId(candidate.id)
  );
  if (legacy === undefined) return null;
  return createCandidateFailure(
    "error",
    [
      `migration-required: creating ${candidate.id} would make legacy Investigation ${legacy} ambiguous by name; run rename/preflight for ${legacy}, then retry new`
    ],
    [
      genericInvestigationDiagnostic({
        code: "investigation-report.migration-required",
        reason:
          "a legacy Investigation must be explicitly renamed before creating a same-name dated record",
        recovery: `run rename/preflight for ${legacy}, complete the dated rename, then retry new for ${candidate.id}`,
        target: legacy
      })
    ]
  );
}

function completedCandidateLockFailure(
  completed: Extract<InvestigationCandidateCreateResult, { changed: true }>,
  error: InvestigationCollectionMutationLockError
): InvestigationCandidateCreateResult {
  return {
    ...completed,
    diagnostics: [
      ...completed.diagnostics,
      {
        ...error.diagnostic,
        mutation: {
          scope: "investigation candidate creation",
          outcome: completed.diagnostics.some(
            (diagnostic) =>
              diagnostic.mutation?.outcome === "partial-or-unknown"
          )
            ? "partial-or-unknown"
            : "committed-cleanup-pending"
        }
      }
    ],
    errors: [
      ...completed.errors,
      "investigation candidate was created but collection lock release failed; inspect the candidate and lock before further mutation"
    ],
    status: "error"
  };
}

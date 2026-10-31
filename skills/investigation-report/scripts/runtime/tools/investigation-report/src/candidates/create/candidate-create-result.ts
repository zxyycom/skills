/*
 * Synced TypeScript runtime; repository maintenance edits tools/investigation-report/src/candidates/create/candidate-create-result.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/investigation-report/src/candidates/create/candidate-create-result.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/investigation-report/src/candidates/create/candidate-create-result.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/investigation-report
 * Rebuild: bun run sync:investigation-report-check
 */
import path from "node:path";
import type { RecordTransactionResult } from "../../../../record-operations/src/transactions/transaction.ts";
import { diagnosticFromError } from "../../diagnostics.ts";
import type { PreparedInvestigationCandidateCreateOptions } from "./candidate-creation-input.ts";
import type { CandidateCreationContext } from "./candidate-create-transaction.ts";
import type { CandidateCollectionLayout } from "../candidate-discovery.ts";
import {
  candidateOperationDiagnostic,
  createCandidateFailure,
  uniqueSorted
} from "../candidate-support.ts";
import {
  readInvestigationCandidate,
  prepareCandidateReadContext
} from "../candidate-document.ts";
import type {
  InvestigationCandidate,
  InvestigationCandidateCreateResult
} from "../../types.ts";
type CreationResult =
  RecordTransactionResult<PreparedInvestigationCandidateCreateOptions>;

export async function candidateCreationResult(
  context: CandidateCreationContext,
  transaction: CreationResult
): Promise<InvestigationCandidateCreateResult> {
  if (!transaction.changed)
    return createCandidateFailure(
      "error",
      transaction.errors.map(errorText),
      transaction.errors.map((error) =>
        diagnosticFromError({
          code: "investigation-report.candidate-create-failed",
          error,
          reason: "the candidate was not created",
          recovery:
            "correct the reported precondition and observe the collection before retrying",
          target: context.target
        })
      )
    );
  if (transaction.status !== "ok")
    return failedCreatedCandidate(context, transaction);
  const { directory, candidate, target, markdown, verifiedLayout } = context;
  return createdCandidateResult(
    candidate.id,
    target,
    markdown,
    [...(verifiedLayout.candidateCollection?.warnings ?? [])],
    await readCreatedCandidate(
      directory,
      candidate.id,
      target,
      markdown,
      verifiedLayout
    )
  );
}
function failedCreatedCandidate(
  context: CandidateCreationContext,
  transaction: CreationResult
): InvestigationCandidateCreateResult {
  const errors = [...transaction.errors, ...transaction.cleanupErrors];
  return {
    candidate: {
      id: context.candidate.id,
      path: context.target,
      markdown: context.markdown,
      readiness: {
        scaffoldValid: false,
        bodyReady: false,
        resourceReady: false
      },
      diagnostics: [],
      errors: [
        "Created candidate verification or cleanup failed; readiness is not established"
      ],
      warnings: []
    },
    changed: true,
    status: "error",
    warnings: [],
    errors: errors.map(errorText),
    diagnostics: errors.map((error) =>
      creationFailureDiagnostic(context, transaction, error)
    )
  };
}
function creationFailureDiagnostic(
  context: CandidateCreationContext,
  transaction: CreationResult,
  error: unknown
) {
  let reason = "candidate creation left a partial or unknown write";
  if (transaction.committed)
    reason =
      transaction.verification === "passed"
        ? "candidate was created, but cleanup is incomplete"
        : "candidate was created, but verification failed or is unknown";
  return diagnosticFromError({
    code: "investigation-report.candidate-create-failed",
    error,
    mutation: {
      outcome: transaction.outcome,
      scope: "investigation candidate creation"
    },
    reason,
    recovery:
      "inspect the actual candidate path and cleanup state; do not repeat new before reconciliation",
    target: context.target
  });
}
function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
async function readCreatedCandidate(
  directory: string,
  id: string,
  target: string,
  markdown: string,
  layout: CandidateCollectionLayout
) {
  try {
    const source = { id, sourcePath: path.basename(target), text: markdown };
    const createdLayout = {
      ...layout,
      candidateIds: [id],
      candidateSources: [...layout.candidateSources, source],
      ...(layout.candidateCollection === undefined
        ? {}
        : {
            candidateCollection: {
              ...layout.candidateCollection,
              candidates: [...layout.candidateCollection.candidates, source],
              identityById: new Map([
                ...layout.candidateCollection.identityById,
                [id, source]
              ]),
              candidateById: new Map([
                ...layout.candidateCollection.candidateById,
                [id, source]
              ])
            }
          })
    };
    const context = await prepareCandidateReadContext(
      directory,
      createdLayout,
      [id]
    );
    return await readInvestigationCandidate(directory, id, context);
  } catch (error) {
    return {
      status: "error" as const,
      kind: "operation" as const,
      diagnostics: [candidateOperationDiagnostic(error, directory)],
      errors: [
        error instanceof Error
          ? error.message
          : "created candidate readiness unavailable"
      ]
    };
  }
}
function createdCandidateResult(
  id: string,
  target: string,
  markdown: string,
  writeWarnings: readonly string[],
  read: Awaited<ReturnType<typeof readInvestigationCandidate>>
): InvestigationCandidateCreateResult {
  if (read.status === "error") {
    const candidate: InvestigationCandidate = {
      diagnostics: read.diagnostics,
      errors: read.errors,
      id,
      markdown,
      path: target,
      readiness: {
        bodyReady: false,
        resourceReady: false,
        scaffoldValid: read.kind !== "scaffold-invalid"
      },
      warnings: []
    };
    return {
      candidate,
      changed: true,
      diagnostics: [],
      errors: [],
      status: "ok",
      warnings: uniqueSorted([...writeWarnings, ...read.errors])
    };
  }
  return {
    candidate: read.value,
    changed: true,
    diagnostics: [],
    errors: [],
    status: "ok",
    warnings: uniqueSorted([...writeWarnings, ...read.value.errors])
  };
}

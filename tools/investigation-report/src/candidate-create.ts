import fs from "node:fs/promises";
import path from "node:path";
import {
  canonicalizeInvestigationsDirectory,
  investigationIndexFileName,
  investigationNameFromId,
  parseDatedInvestigationId
} from "./report-path.ts";
import { withInvestigationCollectionMutationLock } from "./collection-mutation-lock.ts";
import {
  diagnosticFromError,
  genericInvestigationDiagnostic
} from "./diagnostics.ts";
import {
  prepareCandidateCreate,
  resolveCandidateRelationSelectors,
  allocateCandidatePath
} from "./candidate-creation-input.ts";
import {
  candidateOperationDiagnostic,
  createCandidateFailure,
  safeCandidateLayout,
  uniqueSorted,
  writeCandidateAtomically
} from "./candidate-support.ts";
import { readInvestigationCandidate } from "./candidate-document.ts";
import { serializeInvestigationCandidate } from "./candidate-format.ts";
import type {
  InvestigationCandidate,
  InvestigationCandidateCreateOptions,
  InvestigationCandidateCreateResult
} from "./types.ts";
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
  candidate: InvestigationCandidateCreateOptions,
  relationSummaries: readonly InvestigationRelationSummaryInput[]
): Promise<InvestigationCandidateCreateResult> {
  try {
    return await withInvestigationCollectionMutationLock(
      path.join(investigationsDirectory, investigationIndexFileName),
      async () =>
        await createCandidateWithinLock(
          investigationsDirectory,
          candidate,
          relationSummaries
        )
    );
  } catch (error) {
    return createCandidateFailure(
      "error",
      ["investigation candidate could not be created"],
      [candidateOperationDiagnostic(error, investigationsDirectory)]
    );
  }
}
async function createCandidateWithinLock(
  investigationsDirectory: string,
  initialCandidate: InvestigationCandidateCreateOptions,
  relationSummaries: readonly InvestigationRelationSummaryInput[]
): Promise<InvestigationCandidateCreateResult> {
  const layout = await safeCandidateLayout(investigationsDirectory);
  if (layout.status === "error")
    return createCandidateFailure("error", layout.errors, layout.diagnostics);
  const resolved = resolveCandidateRelationSelectors(
    initialCandidate,
    [...layout.value.reportIds, ...layout.value.candidateIds],
    relationSummaries
  );
  if (resolved.status === "error")
    return createCandidateFailure("error", resolved.errors);
  const candidate = resolved.candidate;
  const duplicate = duplicateCandidateError(
    candidate,
    layout.value.reportIds,
    layout.value.candidateIds
  );
  if (duplicate !== null) return duplicate;
  return await writePreparedCandidate(investigationsDirectory, candidate);
}

async function writePreparedCandidate(
  investigationsDirectory: string,
  candidate: InvestigationCandidateCreateOptions
): Promise<InvestigationCandidateCreateResult> {
  const target = await allocateCandidatePath(
    investigationsDirectory,
    candidate.id
  );
  const markdown = serializeInvestigationCandidate(candidate);
  const written = await writeCandidateAtomically(target, markdown);
  if (written.isErr())
    return createCandidateFailure(
      "error",
      [`${candidate.id} investigation candidate was not created`],
      [
        diagnosticFromError({
          code: "investigation-report.candidate-create-failed",
          error: written.error,
          reason: "the investigation candidate could not be atomically created",
          recovery:
            "resolve the reported candidate-path problem, then create the candidate again",
          target
        })
      ]
    );
  return createdCandidateResult(
    candidate.id,
    target,
    markdown,
    written.value.warnings,
    await readInvestigationCandidate(investigationsDirectory, candidate.id)
  );
}
function duplicateCandidateError(
  candidate: InvestigationCandidateCreateOptions,
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
        scaffoldValid: false
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

import { err, ok, ResultAsync, type Result } from "neverthrow";
import {
  diagnosticFromError,
  type InvestigationDiagnostic
} from "./diagnostics.ts";
import type { InvestigationCollectionLayout } from "./investigation-index-source.ts";
import {
  canonicalizeInvestigationsDirectory,
  resolveInvestigationsDirectory,
  type ResolvedInvestigationsDirectory
} from "./report-path.ts";
import {
  parseInvestigationCandidateListOptions,
  parseInvestigationCandidateShowOptions
} from "./options.ts";
import {
  investigationSelectorEntries,
  resolveInvestigationSelector
} from "./investigation-selector.ts";
import {
  candidateListFailure,
  candidateShowFailure,
  safeCandidateLayout,
  uniqueSorted
} from "./candidate-support.ts";
import {
  readInvestigationCandidate,
  prepareCandidateReadContext,
  type CandidateReadContext
} from "./candidate-document.ts";
import type {
  InvestigationCandidate,
  InvestigationCandidateListResult,
  InvestigationCandidateShowResult
} from "./types.ts";

type PreparedCandidateLocation = Readonly<{
  id?: string;
  resolved: ResolvedInvestigationsDirectory;
}>;
type PreparedCandidateAccess = Readonly<{
  directory: string;
  id?: string;
  layout: InvestigationCollectionLayout;
}>;
type CandidatePreparationFailure = Readonly<{
  diagnostics: readonly InvestigationDiagnostic[];
  errors: readonly string[];
}>;
export async function listInvestigationCandidates(
  input: unknown
): Promise<InvestigationCandidateListResult> {
  const access = await prepareCandidateAccess(input, false);
  if (access.isErr())
    return candidateListFailure(access.error.errors, access.error.diagnostics);
  const { directory, layout } = access.value;
  const context = await prepareReadContext(directory, layout);
  if (context.isErr())
    return candidateListFailure(
      context.error.errors,
      context.error.diagnostics
    );
  const candidates: InvestigationCandidate[] = [];
  const errors: string[] = [];
  const diagnostics: InvestigationDiagnostic[] = [];
  for (const id of layout.candidateIds) {
    const read = await readInvestigationCandidate(directory, id, context.value);
    if (read.status === "ok") candidates.push(read.value);
    else {
      errors.push(...read.errors);
      diagnostics.push(...read.diagnostics);
    }
  }
  const result = {
    candidates,
    warnings: candidates.flatMap((candidate) => candidate.errors)
  };
  return errors.length === 0
    ? { ...result, diagnostics: [], errors: [], status: "ok" }
    : { ...result, diagnostics, errors: uniqueSorted(errors), status: "error" };
}
export async function showInvestigationCandidate(
  input: unknown
): Promise<InvestigationCandidateShowResult> {
  const access = await prepareCandidateAccess(input, true);
  if (access.isErr())
    return candidateShowFailure(access.error.errors, access.error.diagnostics);
  const { directory, layout } = access.value;
  const selected = resolveInvestigationSelector(
    investigationSelectorEntries(layout.candidateIds),
    access.value.id!,
    "investigation candidate"
  );
  if (selected.status === "error") return candidateShowFailure(selected.errors);
  const context = await prepareReadContext(directory, layout, [selected.id]);
  if (context.isErr())
    return candidateShowFailure(
      context.error.errors,
      context.error.diagnostics
    );
  const candidate = await readInvestigationCandidate(
    directory,
    selected.id,
    context.value
  );
  return candidate.status === "ok"
    ? {
        candidate: candidate.value,
        diagnostics: [],
        errors: [],
        status: "ok",
        warnings: candidate.value.errors
      }
    : candidateShowFailure(candidate.errors, candidate.diagnostics);
}

async function prepareCandidateAccess(
  input: unknown,
  requiresId: boolean
): Promise<Result<PreparedCandidateAccess, CandidatePreparationFailure>> {
  const prepared = prepareCandidateLocation(input, requiresId);
  if (prepared.isErr()) return err({ errors: prepared.error, diagnostics: [] });
  const canonical = await canonicalizeInvestigationsDirectory(
    prepared.value.resolved
  );
  if (canonical.isErr())
    return err({ errors: canonical.error, diagnostics: [] });
  const directory = canonical.value.investigationsDirectory;
  const layout = await safeCandidateLayout(directory, {
    readFormalSources: false
  });
  if (layout.status === "error") return err(layout);
  return ok({ directory, layout: layout.value, id: prepared.value.id });
}

function prepareReadContext(
  investigationsDirectory: string,
  layout: InvestigationCollectionLayout,
  ids: readonly string[] = layout.candidateIds
): ResultAsync<CandidateReadContext, CandidatePreparationFailure> {
  return ResultAsync.fromPromise(
    prepareCandidateReadContext(investigationsDirectory, layout, ids),
    (error) => ({
      errors: ["candidate preparation could not be completed"],
      diagnostics: [
        diagnosticFromError({
          code: "investigation-report.candidate-read-failed",
          error,
          reason: "the investigation candidate read preparation failed",
          recovery:
            "restore access to the candidates and their required owners, then retry the read",
          target: investigationsDirectory
        })
      ]
    })
  );
}

function prepareCandidateLocation(
  input: unknown,
  requiresId: boolean
): Result<PreparedCandidateLocation, string[]> {
  const parsed = requiresId
    ? parseInvestigationCandidateShowOptions(input).map((options) => ({
        options,
        id: options.id
      }))
    : parseInvestigationCandidateListOptions(input).map((options) => ({
        options,
        id: undefined
      }));
  if (parsed.isErr()) return err(parsed.error);
  const resolved = resolveInvestigationsDirectory(
    parsed.value.options.workspaceRoot,
    parsed.value.options.investigationsDir
  );
  return resolved.isErr()
    ? err(resolved.error)
    : ok({
        ...(parsed.value.id !== undefined ? { id: parsed.value.id } : {}),
        resolved: resolved.value
      });
}

import { err, ok, type Result } from "neverthrow";
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
import { readInvestigationCandidate } from "./candidate-document.ts";
import type {
  InvestigationCandidate,
  InvestigationCandidateListResult,
  InvestigationCandidateShowOptions,
  InvestigationCandidateShowResult
} from "./types.ts";

type PreparedCandidateLocation = Readonly<{
  id?: string;
  resolved: ResolvedInvestigationsDirectory;
}>;
export async function listInvestigationCandidates(
  input: unknown
): Promise<InvestigationCandidateListResult> {
  const prepared = prepareCandidateLocation(input, false);
  if (prepared.isErr()) return candidateListFailure(prepared.error);
  const canonical = await canonicalizeInvestigationsDirectory(
    prepared.value.resolved
  );
  if (canonical.isErr()) return candidateListFailure(canonical.error);
  const layout = await safeCandidateLayout(
    canonical.value.investigationsDirectory
  );
  if (layout.status === "error")
    return candidateListFailure(layout.errors, layout.diagnostics);
  const candidates: InvestigationCandidate[] = [];
  const errors: string[] = [];
  const diagnostics =
    [] as import("./diagnostics.ts").InvestigationDiagnostic[];
  for (const id of layout.value.candidateIds) {
    const read = await readInvestigationCandidate(
      canonical.value.investigationsDirectory,
      id
    );
    if (read.status === "ok") candidates.push(read.value);
    else {
      errors.push(...read.errors);
      diagnostics.push(...read.diagnostics);
    }
  }
  return errors.length === 0
    ? {
        candidates,
        diagnostics: [],
        errors: [],
        status: "ok",
        warnings: candidates.flatMap((candidate) => candidate.errors)
      }
    : {
        candidates,
        diagnostics,
        errors: uniqueSorted(errors),
        status: "error",
        warnings: candidates.flatMap((candidate) => candidate.errors)
      };
}
export async function showInvestigationCandidate(
  input: unknown
): Promise<InvestigationCandidateShowResult> {
  const prepared = prepareCandidateLocation(input, true);
  if (prepared.isErr()) return candidateShowFailure(prepared.error);
  const canonical = await canonicalizeInvestigationsDirectory(
    prepared.value.resolved
  );
  if (canonical.isErr()) return candidateShowFailure(canonical.error);
  const layout = await safeCandidateLayout(
    canonical.value.investigationsDirectory
  );
  if (layout.status === "error")
    return candidateShowFailure(layout.errors, layout.diagnostics);
  const selected = resolveInvestigationSelector(
    investigationSelectorEntries(layout.value.candidateIds),
    prepared.value.id!,
    "investigation candidate"
  );
  if (selected.status === "error") return candidateShowFailure(selected.errors);
  const candidate = await readInvestigationCandidate(
    canonical.value.investigationsDirectory,
    selected.id
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
function prepareCandidateLocation(
  input: unknown,
  requiresId: boolean
): Result<PreparedCandidateLocation, string[]> {
  const parsed = requiresId
    ? parseInvestigationCandidateShowOptions(input)
    : parseInvestigationCandidateListOptions(input);
  if (parsed.isErr()) return err(parsed.error);
  const resolved = resolveInvestigationsDirectory(
    parsed.value.workspaceRoot,
    parsed.value.investigationsDir
  );
  return resolved.isErr()
    ? err(resolved.error)
    : ok({
        ...(requiresId
          ? { id: (parsed.value as InvestigationCandidateShowOptions).id }
          : {}),
        resolved: resolved.value
      });
}

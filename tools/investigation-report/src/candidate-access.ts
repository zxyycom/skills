import { err, ok, ResultAsync, type Result } from "neverthrow";
import {
  diagnosticFromError,
  type InvestigationDiagnostic
} from "./diagnostics.ts";
import type { CandidateCollectionLayout } from "./candidate-discovery.ts";
import { readRecordCandidates } from "../../record-operations/src/candidate.ts";
import {
  investigationNameFromId,
  normalizeInvestigationSelectorInput,
  parseDatedInvestigationId
} from "./report-path.ts";
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
  candidateListFailure,
  candidateShowFailure,
  safeCandidateLayout
} from "./candidate-support.ts";
import {
  readInvestigationCandidate,
  prepareCandidateReadContext
} from "./candidate-document.ts";
import type {
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
  layout: CandidateCollectionLayout;
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
  const read = await readCandidateAccess(access.value);
  return read.isErr()
    ? candidateListFailure(read.error.errors, read.error.diagnostics)
    : {
        candidates: read.value.values,
        warnings: read.value.warnings,
        diagnostics: [],
        errors: [],
        status: "ok"
      };
}
export async function showInvestigationCandidate(
  input: unknown
): Promise<InvestigationCandidateShowResult> {
  const access = await prepareCandidateAccess(input, true);
  if (access.isErr())
    return candidateShowFailure(access.error.errors, access.error.diagnostics);
  const read = await readCandidateAccess(access.value);
  return read.isErr()
    ? candidateShowFailure(read.error.errors, read.error.diagnostics)
    : {
        candidate: read.value.values[0]!,
        warnings: read.value.warnings,
        diagnostics: [],
        errors: [],
        status: "ok"
      };
}

function readCandidateAccess(access: PreparedCandidateAccess) {
  const { directory, layout } = access;
  const selector =
    access.id === undefined
      ? undefined
      : normalizeInvestigationSelectorInput(access.id);
  return ResultAsync.fromPromise(
    readRecordCandidates({
      collection: layout.candidateCollection!,
      ...(selector === undefined
        ? {}
        : {
            selection: {
              selector,
              exactId: parseDatedInvestigationId(selector) !== null,
              name: investigationNameFromId
            }
          }),
      prepare: async (sources) =>
        await prepareCandidateReadContext(
          directory,
          layout,
          sources.map(({ id }) => id)
        ),
      read: async (source, context) => {
        const read = await readInvestigationCandidate(
          directory,
          source.id,
          context
        );
        if (read.status === "ok")
          return {
            status: "ok" as const,
            value: read.value,
            warnings: read.value.errors
          };
        if (read.kind === "scaffold-invalid")
          return { status: "invalid" as const, errors: read.errors };
        throw new Error(read.errors.join("; "));
      }
    }),
    (error): CandidatePreparationFailure => ({
      errors: [
        error instanceof Error
          ? error.message
          : "candidate preparation could not be completed"
      ],
      diagnostics: [
        diagnosticFromError({
          code: "investigation-report.candidate-read-failed",
          error,
          reason: "the investigation candidate read preparation failed",
          recovery:
            "restore access to the candidates and their required owners, then retry the read",
          target: directory
        })
      ]
    })
  );
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
  const layout = await safeCandidateLayout(directory);
  if (layout.status === "error") return err(layout);
  return ok({ directory, layout: layout.value, id: prepared.value.id });
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

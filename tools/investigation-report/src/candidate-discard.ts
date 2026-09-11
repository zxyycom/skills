import fs from "node:fs/promises";
import path from "node:path";
import { withInvestigationCollectionMutationLock } from "./collection-mutation-lock.ts";
import {
  diagnosticFromError,
  type InvestigationDiagnostic
} from "./diagnostics.ts";
import { inspectInvestigationCollectionLayout } from "./investigation-index-source.ts";
import {
  investigationSelectorEntries,
  resolveInvestigationSelector
} from "./investigation-selector.ts";
import {
  investigationIndexFileName,
  resolveInvestigationsDirectory,
  canonicalizeInvestigationsDirectory
} from "./report-path.ts";
import { findCandidatePathForInvestigationId } from "./candidate-path.ts";
import { readCandidateAuthoringResourceReferences } from "./candidate.ts";
import { investigationResourcesDirectoryName } from "./resource-reference.ts";
import { parseInvestigationCandidateDiscardOptions } from "./options.ts";
import { discardPreparedCandidate } from "./candidate-discard-tombstone.ts";
import {
  candidateDiscardEligibility,
  candidateDiscardHistoryGate
} from "./candidate-discard-eligibility.ts";
import {
  discardMutation,
  invalidResult,
  lockFailure,
  result,
  sameCandidateDiscardPreparation,
  validateOptions
} from "./candidate-discard-support.ts";
import {
  scanCandidateOwnerResources,
  type CandidateResourceTree
} from "./candidate-discard-resources.ts";
import type {
  InvestigationCandidateDiscardOptions,
  InvestigationCandidateDiscardResult
} from "./types.ts";

type BeforeCandidateDiscard = () => Promise<void>;

export async function discardInvestigationCandidate(
  input: unknown
): Promise<InvestigationCandidateDiscardResult> {
  return await discardInvestigationCandidateWithHook(input);
}

export async function discardInvestigationCandidateWithHook(
  input: unknown,
  beforeCommit: BeforeCandidateDiscard = async () => {}
): Promise<InvestigationCandidateDiscardResult> {
  const parsed = parseInvestigationCandidateDiscardOptions(input);
  if (parsed.isErr()) return invalidResult(input, parsed.error);
  const options = parsed.value;
  const errors = validateOptions(options);
  if (errors.length > 0) return result(options, false, [], errors);
  const resolved = resolveInvestigationsDirectory(
    options.workspaceRoot,
    options.investigationsDir
  );
  if (resolved.isErr()) return result(options, false, [], resolved.error);
  const canonical = await canonicalizeInvestigationsDirectory(resolved.value);
  if (canonical.isErr()) return result(options, false, [], canonical.error);
  const root = canonical.value.investigationsDirectory;
  const indexPath = path.join(root, investigationIndexFileName);
  try {
    return await withInvestigationCollectionMutationLock(indexPath, async () =>
      discardCandidateWithinLock({ beforeCommit, input: options, root })
    );
  } catch (error) {
    return lockFailure(options, error);
  }
}

async function discardCandidateWithinLock(options: {
  beforeCommit: BeforeCandidateDiscard;
  input: InvestigationCandidateDiscardOptions;
  root: string;
}): Promise<InvestigationCandidateDiscardResult> {
  const layout = await inspectInvestigationCollectionLayout(options.root);
  if (layout.errors.length > 0) {
    return result(options.input, false, [], layout.errors, {
      mutation: discardMutation("no-change")
    });
  }
  const selected = resolveInvestigationSelector(
    investigationSelectorEntries(layout.candidateIds),
    options.input.id,
    "investigation candidate"
  );
  if (selected.status === "error") {
    return result(options.input, false, [], selected.errors, {
      mutation: discardMutation("no-change")
    });
  }
  options = { ...options, input: { ...options.input, id: selected.id } };
  const prepared = await prepareCandidateDiscard(
    options.root,
    options.input.id
  );
  if (prepared.status === "error") {
    return result(options.input, false, [], prepared.errors, {
      diagnostics: prepared.diagnostics,
      mutation: discardMutation("no-change")
    });
  }
  return await discardValidatedCandidate(options, prepared.value);
}

async function discardValidatedCandidate(
  options: {
    beforeCommit: BeforeCandidateDiscard;
    input: InvestigationCandidateDiscardOptions;
    root: string;
  },
  preparation: CandidateDiscardPreparation
): Promise<InvestigationCandidateDiscardResult> {
  const eligibility = candidateDiscardEligibility(options.input, preparation);
  if (eligibility !== null) return eligibility;
  const historyGate = await candidateDiscardHistoryGate(
    options.root,
    options.input,
    preparation,
    false
  );
  if (historyGate !== null) return historyGate;
  const beforeCommitFailure =
    await candidateDiscardBeforeCommitFailure(options);
  if (beforeCommitFailure !== null) return beforeCommitFailure;
  return await discardProtectedCandidate(options, preparation);
}

async function discardProtectedCandidate(
  options: {
    input: InvestigationCandidateDiscardOptions;
    root: string;
  },
  initialPreparation: CandidateDiscardPreparation
): Promise<InvestigationCandidateDiscardResult> {
  const protectedPreparation = await prepareCandidateDiscard(
    options.root,
    options.input.id
  );
  if (
    !sameProtectedCandidatePreparation(initialPreparation, protectedPreparation)
  )
    return protectedCandidatePreparationFailure(
      options.input,
      protectedPreparation
    );
  const protectedHistoryGate = await candidateDiscardHistoryGate(
    options.root,
    options.input,
    protectedPreparation.value,
    true
  );
  if (protectedHistoryGate !== null) return protectedHistoryGate;
  return await discardPreparedCandidate(
    options.input,
    options.root,
    protectedPreparation.value
  );
}

function protectedCandidatePreparationFailure(
  input: InvestigationCandidateDiscardOptions,
  protectedPreparation: CandidateDiscardPreparationResult
): InvestigationCandidateDiscardResult {
  return result(
    input,
    false,
    [],
    [
      "candidate or owner resources changed after discard preparation; no files were written",
      ...(protectedPreparation.status === "error"
        ? protectedPreparation.errors
        : [])
    ],
    {
      diagnostics:
        protectedPreparation.status === "error"
          ? protectedPreparation.diagnostics
          : [],
      mutation: discardMutation("no-change")
    }
  );
}

function sameProtectedCandidatePreparation(
  initial: CandidateDiscardPreparation,
  protectedPreparation: CandidateDiscardPreparationResult
): protectedPreparation is Extract<
  CandidateDiscardPreparationResult,
  { status: "ok" }
> {
  return (
    protectedPreparation.status === "ok" &&
    sameCandidateDiscardPreparation(initial, protectedPreparation.value)
  );
}

async function candidateDiscardBeforeCommitFailure(options: {
  beforeCommit: BeforeCandidateDiscard;
  input: InvestigationCandidateDiscardOptions;
}): Promise<InvestigationCandidateDiscardResult | null> {
  try {
    await options.beforeCommit();
    return null;
  } catch (error) {
    return result(
      options.input,
      false,
      [],
      ["candidate discard could not continue before files were moved"],
      {
        diagnostics: [
          diagnosticFromError({
            code: "investigation-report.discard-candidate-before-commit-failed",
            error,
            mutation: discardMutation("no-change"),
            reason:
              "the candidate discard transaction stopped before moving files",
            recovery:
              "resolve the reported failure, then retry from the current collection state",
            target: options.input.id
          })
        ],
        mutation: discardMutation("no-change")
      }
    );
  }
}

export type CandidateDiscardPreparation = Readonly<{
  candidatePath: string;
  candidateText: string;
  resources: CandidateResourceTree;
  sharedReferences: string[];
}>;

type CandidateDiscardPreparationResult =
  | Readonly<{ status: "ok"; value: CandidateDiscardPreparation }>
  | Readonly<{
      diagnostics: InvestigationDiagnostic[];
      errors: string[];
      status: "error";
    }>;

async function prepareCandidateDiscard(
  root: string,
  id: string
): Promise<CandidateDiscardPreparationResult> {
  try {
    return await buildCandidateDiscardPreparation(root, id);
  } catch (error) {
    return {
      diagnostics: [
        diagnosticFromError({
          code: "investigation-report.discard-candidate-prepare-failed",
          error,
          reason:
            "the candidate and owner resources could not be prepared for discard",
          recovery:
            "restore a readable candidate collection and owner resource tree, then retry discard-candidate",
          target: id
        })
      ],
      errors: ["candidate discard preparation could not be completed"],
      status: "error"
    };
  }
}

async function buildCandidateDiscardPreparation(
  root: string,
  id: string
): Promise<CandidateDiscardPreparationResult> {
  const candidate = await preparedCandidateFile(root, id);
  if (candidate.status === "error") return candidate;
  const resources = await scanCandidateOwnerResources(
    root,
    path.join(root, investigationResourcesDirectoryName, id)
  );
  if (resources.errors.length > 0)
    return { diagnostics: [], errors: resources.errors, status: "error" };
  const sharedReferences = await sharedCandidateResourceReferences(root, id);
  return {
    status: "ok",
    value: { ...candidate.value, resources, sharedReferences }
  };
}

type PreparedCandidateFile = Readonly<{
  candidatePath: string;
  candidateText: string;
}>;

async function preparedCandidateFile(
  root: string,
  id: string
): Promise<
  | Readonly<{ status: "ok"; value: PreparedCandidateFile }>
  | Readonly<{
      diagnostics: InvestigationDiagnostic[];
      errors: string[];
      status: "error";
    }>
> {
  const layout = await inspectInvestigationCollectionLayout(root);
  if (layout.errors.length > 0)
    return { diagnostics: [], errors: layout.errors, status: "error" };
  if (!layout.candidateIds.includes(id)) return missingCandidatePreparation(id);
  const candidatePath = await findCandidatePathForInvestigationId(root, id);
  if (candidatePath === null) return missingCandidatePreparation(id);
  const entry = await fs.lstat(candidatePath);
  if (entry.isSymbolicLink() || !entry.isFile())
    return {
      diagnostics: [],
      errors: [
        `${id} investigation candidate must be a regular non-symbolic-link file`
      ],
      status: "error"
    };
  return {
    status: "ok",
    value: {
      candidatePath,
      candidateText: await fs.readFile(candidatePath, "utf8")
    }
  };
}

function missingCandidatePreparation(id: string): Readonly<{
  diagnostics: InvestigationDiagnostic[];
  errors: string[];
  status: "error";
}> {
  return {
    diagnostics: [],
    errors: [`${id} investigation candidate does not exist`],
    status: "error"
  };
}

async function sharedCandidateResourceReferences(
  root: string,
  id: string
): Promise<string[]> {
  const references = await readCandidateAuthoringResourceReferences(root, {
    failOnInvalidSources: true
  });
  const ownerPrefix = `${id}/`;
  return [...references]
    .filter(
      ([source, ids]) =>
        source !== id &&
        [...ids].some((resourceId) => resourceId.startsWith(ownerPrefix))
    )
    .map(
      ([source]) =>
        `${id} owns resources still referenced by ${source}; remove or replace those resource links before discard-candidate`
    )
    .sort(compareText);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

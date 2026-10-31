import { discoverInvestigationCandidates } from "../candidate-discovery.ts";
import {
  prepareCandidateDiscard,
  type CandidateDiscardPreparation,
  type CandidateDiscardPreparationResult
} from "./candidate-discard-preparation.ts";

import path from "node:path";
import { withInvestigationCollectionMutationLock } from "../../collection-mutation-lock.ts";
import { diagnosticFromError } from "../../diagnostics.ts";
import { type InvestigationCollectionLayout } from "../../index/investigation-index-source.ts";
import {
  investigationSelectorEntries,
  resolveInvestigationSelector
} from "../../collection/investigation-selector.ts";
import {
  investigationIndexFileName,
  resolveInvestigationsDirectory,
  canonicalizeInvestigationsDirectory
} from "../../collection/report-path.ts";

import { parseInvestigationCandidateDiscardOptions } from "../../options.ts";
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

import type {
  InvestigationCandidateDiscardOptions,
  InvestigationCandidateDiscardResult
} from "../../types.ts";

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

export async function discardCandidateWithinLock(options: {
  beforeCommit: BeforeCandidateDiscard;
  input: InvestigationCandidateDiscardOptions;
  root: string;
  layout?: InvestigationCollectionLayout;
}): Promise<InvestigationCandidateDiscardResult> {
  const layout =
    options.layout ?? (await discoverInvestigationCandidates(options.root));
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

export type { CandidateDiscardPreparation } from "./candidate-discard-preparation.ts";

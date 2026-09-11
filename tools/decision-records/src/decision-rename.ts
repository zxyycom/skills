import {
  decisionAttention,
  decisionDiagnostic,
  decisionFailure
} from "./application-result.ts";
import { loadDecisionHistoryBaseline } from "./decision-history-baseline.ts";
import {
  DecisionCollectionLockError,
  withDecisionCollectionMutationLock
} from "./decision-collection-mutation-lock.ts";
import { applyLockedDecisionChanges } from "./decision-transaction.ts";
import { loadDecisionValidationContext } from "./index.ts";
import { scanDecisionRecords } from "./scan.ts";
import { type DecisionScanOptions } from "./types.ts";
import {
  prepareDecisionRename,
  type PreparedRenameStep
} from "./decision-rename-planning.ts";
import { pendingDecisionRenameFailure } from "./decision-rename-pending.ts";

export type DecisionRenameOptions = DecisionScanOptions &
  Readonly<{
    preflight?: boolean;
    renameRecordedDecision?: boolean;
    source: string;
    target: string;
  }>;

export type DecisionRenamePlan = Readonly<{
  affectedCandidateRelationCount: number;
  affectedEstablishedRelationCount: number;
  newId: string;
  newName: string;
  newSourcePath: string;
  oldId: string;
  oldName: string;
  oldSourcePath: string;
  outcome: "preflight" | "ready";
}>;

/** Public rename diagnostics stay portable with the generated SDK bundle. */
export type DecisionRenameDiagnostic = Readonly<{
  causeCategory?:
    | "access-denied"
    | "busy"
    | "command-failed"
    | "not-found"
    | "not-repository"
    | "revision-unavailable"
    | "tool-unavailable"
    | "unknown";
  code: string;
  detail?: string | null;
  outcome?:
    | "committed-cleanup-pending"
    | "no-change"
    | "partial-or-unknown"
    | "rolled-back";
  reason: string;
  recovery: string;
  scope?: string;
  target: string;
}>;

export type DecisionRenameFailure = Readonly<{
  diagnostics: DecisionRenameDiagnostic[];
  errors: string[];
  exitCode: 1 | 2;
  plan: null;
  presentation: "command" | "plain";
  status: "error";
}>;

export type DecisionRenameAttention = Readonly<{
  diagnostics: DecisionRenameDiagnostic[];
  exitCode: 1;
  plan: DecisionRenamePlan;
  status: "attention";
  warnings: string[];
}>;

export type DecisionRenameCommittedCleanup = Readonly<{
  changed: true;
  diagnostics: DecisionRenameDiagnostic[];
  errors: [];
  exitCode: 1;
  outcome: "committed-cleanup-pending";
  plan: DecisionRenamePlan;
  status: "attention";
  warnings: string[];
}>;

export type DecisionRenameResult =
  | DecisionRenameFailure
  | DecisionRenameAttention
  | DecisionRenameCommittedCleanup
  | Readonly<{
      changed: boolean;
      diagnostics: [];
      errors: [];
      outcome: "committed" | "preflight";
      plan: DecisionRenamePlan;
      status: "ok";
    }>;

const decisionRenameScope =
  "Decision Markdown files and derived decision index";

/** Renames one Decision identity and every managed relation that targets it. */
export async function renameDecisionRecord(
  options: DecisionRenameOptions
): Promise<DecisionRenameResult> {
  if (options.preflight === true) {
    const prepared = await prepareDecisionRenameAtCurrentState(options, false);
    if (prepared.status !== "ready") return prepared;
    return {
      changed: false,
      diagnostics: [],
      errors: [],
      outcome: "preflight",
      plan: { ...prepared.value.plan, outcome: "preflight" },
      status: "ok"
    };
  }
  const initial = await scanDecisionRecords(options);
  try {
    return await withDecisionCollectionMutationLock(
      initial.indexPath,
      async () => await applyDecisionRenameWithinLock(options)
    );
  } catch (error) {
    const completed = completedDecisionRenameWithLockCleanup(error);
    if (completed !== null) return completed;
    return {
      ...decisionFailure([
        decisionDiagnostic({
          code: "decision-records.rename-lock-failed",
          outcome: "no-change",
          reason: "Decision rename could not acquire its collection lock.",
          recovery:
            "Wait for the active transaction or inspect the collection lock before retrying rename.",
          scope: decisionRenameScope,
          target: "Decision collection mutation lock"
        })
      ]),
      plan: null
    };
  }
}

function completedDecisionRenameWithLockCleanup(
  error: unknown
): DecisionRenameCommittedCleanup | null {
  const plan = releasedRenamePlan(error);
  if (plan === null) return null;
  const diagnostic = renameLockCleanupDiagnostic();
  return {
    changed: true,
    diagnostics: [diagnostic],
    errors: [],
    exitCode: 1,
    outcome: "committed-cleanup-pending",
    plan,
    status: "attention",
    warnings: [diagnostic.reason]
  };
}

function releasedRenamePlan(error: unknown): DecisionRenamePlan | null {
  if (!(error instanceof DecisionCollectionLockError)) return null;
  if (error.kind !== "release-failed") return null;
  return committedRenamePlan(error.operationResult);
}

function committedRenamePlan(value: unknown): DecisionRenamePlan | null {
  if (!isCommittedRenameResult(value)) return null;
  return hasRenamePlanIdentity(value.plan)
    ? (value.plan as DecisionRenamePlan)
    : null;
}

function isCommittedRenameResult(value: unknown): value is {
  changed: true;
  outcome: "committed";
  plan: unknown;
  status: "ok";
} {
  return (
    isObjectRecord(value) &&
    propertyEquals(value, "status", "ok") &&
    propertyEquals(value, "changed", true) &&
    propertyEquals(value, "outcome", "committed") &&
    "plan" in value
  );
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function propertyEquals(
  value: Record<string, unknown>,
  key: string,
  expected: unknown
): boolean {
  return value[key] === expected;
}

function hasRenamePlanIdentity(
  value: unknown
): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    "oldId" in value &&
    "newId" in value
  );
}

function renameLockCleanupDiagnostic() {
  return decisionDiagnostic({
    code: "decision-records.collection-lock-release-failed",
    outcome: "committed-cleanup-pending",
    reason:
      "Decision rename committed, but its collection lock could not be released.",
    recovery:
      "Verify the renamed Decision collection, then inspect the remaining lock before running another mutation.",
    scope: decisionRenameScope,
    target: "Decision collection mutation lock"
  });
}

async function applyDecisionRenameWithinLock(
  options: DecisionRenameOptions
): Promise<DecisionRenameResult> {
  const prepared = await prepareDecisionRenameAtCurrentState(options, true);
  if (prepared.status !== "ready") return prepared;
  const current = await scanDecisionRecords(options);
  const transaction = await applyLockedDecisionChanges({
    changes: prepared.value.changes,
    originalScan: current,
    scanOptions: options
  });
  if (transaction.status === "error") {
    return { ...decisionFailure(transaction.diagnostics), plan: null };
  }
  return {
    changed: transaction.changed,
    diagnostics: [],
    errors: [],
    outcome: "committed",
    plan: prepared.value.plan,
    status: "ok"
  };
}

async function prepareDecisionRenameAtCurrentState(
  options: DecisionRenameOptions,
  requireConfirmation: boolean
): Promise<
  DecisionRenameResult | Extract<PreparedRenameStep, { status: "ready" }>
> {
  const { result } = await loadDecisionValidationContext(options, {
    allowEmptyDecisionSet: true
  });
  if (result.errors.length > 0) {
    return {
      ...decisionFailure(
        result.errors.map((reason) =>
          decisionDiagnostic({
            code: "decision-records.rename-collection-invalid",
            outcome: "no-change",
            reason,
            recovery:
              "Correct the Decision collection and derived index before retrying rename.",
            scope: decisionRenameScope,
            target: "Decision rename"
          })
        )
      ),
      plan: null
    };
  }
  const prepared = prepareDecisionRename(result.scan, options);
  if (prepared.status !== "ready") return { ...prepared, plan: null };
  const history = await loadDecisionHistoryBaseline(result.scan);
  if (history.status === "error") return { ...history, plan: null };
  const pending = await pendingDecisionRenameFailure(result.scan);
  if (pending !== null) return { ...pending, plan: null };
  const recorded =
    history.baseline.kind === "git-head" &&
    history.baseline.recordedDecisionIds.has(prepared.value.source.decisionId);
  if (
    requireConfirmation &&
    recorded &&
    options.renameRecordedDecision !== true
  ) {
    return {
      ...decisionAttention([
        decisionDiagnostic({
          code: "decision-records.rename-recorded-decision-confirmation-required",
          outcome: "no-change",
          reason:
            "Decision " +
            prepared.value.plan.oldId +
            " has entered Git HEAD; confirm that its recorded identity should be renamed.",
          recovery:
            "Re-run with --rename-recorded-decision only after confirming this working-tree rename; Git history is not rewritten.",
          scope: decisionRenameScope,
          target: prepared.value.plan.oldId
        })
      ]),
      plan: prepared.value.plan
    };
  }
  return prepared;
}

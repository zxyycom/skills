import type { DecisionSourceCapture } from "./decision-strict-preparation.ts";
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
import path from "node:path";
import { canonicalRecordCollection } from "../../record-operations/src/source.ts";
import { tryNoopDecisionRename } from "./decision-rename-noop.ts";
import { decisionTransactionLockFailure } from "./decision-transaction-outcome.ts";
import type { DecisionMutationOutcome } from "./application-result.ts";
import { applyLockedDecisionChanges } from "./decision-transaction.ts";
import { loadDecisionTransactionValidationContext } from "./scan-snapshot.ts";
import { type DecisionScan, type DecisionScanOptions } from "./types.ts";
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
  plan: DecisionRenamePlan | null;
  changed?: boolean;
  committed?: boolean;
  verification?: "passed" | "failed-or-unknown" | "not-run";
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
  let operation: DecisionRenameResult | null = null;
  try {
    if (options.preflight === true) {
      const noop = await tryNoopDecisionRename(options);
      if (noop !== null) return noop;
      const prepared = await prepareDecisionRenameAtCurrentState(
        options,
        false
      );
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
    const canonical = await canonicalRecordCollection(
      options.workspaceRoot ?? process.cwd(),
      options.decisionsDir ?? "docs/decisions"
    );
    return await withDecisionCollectionMutationLock(
      path.join(canonical.collectionRoot, "decision-index.json"),
      async () => {
        operation = await applyDecisionRenameWithinLock(options);
        return operation;
      }
    );
  } catch (error) {
    return renameLockFailure(error, operation);
  }
}

function renameLockFailure(
  error: unknown,
  operation: DecisionRenameResult | null
): DecisionRenameResult {
  if (
    !(error instanceof DecisionCollectionLockError) ||
    error.kind !== "release-failed" ||
    operation === null
  ) {
    const failed = decisionTransactionLockFailure(error);
    return { ...decisionFailure(failed.diagnostics), plan: null };
  }
  const diagnostic = renameReleaseDiagnostic(operation);
  if (operation.status === "error")
    return {
      ...operation,
      diagnostics: [...operation.diagnostics, diagnostic],
      errors: [...operation.errors, diagnostic.reason]
    };
  if (operation.status === "attention")
    return {
      ...operation,
      diagnostics: [...operation.diagnostics, diagnostic],
      warnings: [...operation.warnings, diagnostic.reason]
    };
  if (operation.changed)
    return {
      changed: true,
      diagnostics: [diagnostic],
      errors: [],
      exitCode: 1,
      outcome: "committed-cleanup-pending",
      plan: operation.plan,
      status: "attention",
      warnings: [diagnostic.reason]
    };
  return {
    ...decisionFailure([diagnostic]),
    changed: false,
    committed: false,
    plan: operation.plan
  };
}

/** 完成结果的 mutation 事实优先于随后发生的解锁失败。 */
function renameReleaseDiagnostic(
  operation: DecisionRenameResult
): ReturnType<typeof decisionDiagnostic> {
  const outcome: DecisionMutationOutcome =
    operation.status === "ok"
      ? operation.changed
        ? "committed-cleanup-pending"
        : "no-change"
      : (operation.diagnostics.find(
          (diagnostic) => diagnostic.outcome !== undefined
        )?.outcome ?? "no-change");
  return decisionDiagnostic({
    code: "decision-records.collection-lock-release-failed",
    outcome,
    reason:
      "Decision rename finished but its collection lock could not be released.",
    recovery:
      "Inspect the actual rename result and remaining lock before running another mutation.",
    scope: decisionRenameScope,
    target: "Decision collection mutation lock"
  });
}

async function applyDecisionRenameWithinLock(
  options: DecisionRenameOptions
): Promise<DecisionRenameResult> {
  const noop = await tryNoopDecisionRename(options);
  if (noop !== null) return noop;
  const prepared = await prepareDecisionRenameAtCurrentState(options, true);
  if (prepared.status !== "ready") return prepared;
  if (prepared.value.changes.length === 0) {
    return {
      changed: false,
      diagnostics: [],
      errors: [],
      outcome: "committed",
      plan: prepared.value.plan,
      status: "ok"
    };
  }
  const transaction = await applyLockedDecisionChanges({
    changes: prepared.value.changes,
    originalScan: prepared.scan,
    sourceCapture: prepared.sourceCapture
  });
  if (transaction.status === "error") {
    return {
      ...decisionFailure(transaction.diagnostics),
      changed: transaction.changed,
      committed: transaction.committed,
      verification: transaction.verification,
      plan: transaction.changed === true ? prepared.value.plan : null
    };
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

type LockedRenamePreparation = Extract<
  PreparedRenameStep,
  { status: "ready" }
> & {
  scan: DecisionScan;
  sourceCapture?: DecisionSourceCapture;
};

async function prepareDecisionRenameAtCurrentState(
  options: DecisionRenameOptions,
  requireConfirmation: boolean
): Promise<DecisionRenameResult | LockedRenamePreparation> {
  const { result, sourceCapture } =
    await loadDecisionTransactionValidationContext(options, {
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
  const ready = { ...prepared, scan: result.scan, sourceCapture };
  if (prepared.value.changes.length === 0) return ready;
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
  return ready;
}

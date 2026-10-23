/*
 * Synced TypeScript runtime; repository maintenance edits tools/record-operations/src/transaction.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/record-operations/src/transaction.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/record-operations/src/transaction.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
import { RecordVerificationPhase } from "./transaction-verification.ts";
import { RecordWriteJournal } from "./transaction-journal.ts";
import {
  readRecordFileSnapshot,
  validateRecordWritePermissions,
  restoreRecordDirectories,
  restoreRecordWrites,
  sameRecordFile,
  verifyRecordFile,
  type RecordFileSnapshot,
  type RecordFileWrite,
  type RecordWrittenFile
} from "./transaction-files.ts";

export type RecordMutationOutcome =
  | "no-change"
  | "rolled-back"
  | "partial-or-unknown"
  | "committed-cleanup-pending";
export type RecordTransactionPlan<Value> = Readonly<{
  value: Value;
  root: string;
  writes: readonly RecordFileWrite[];
  /** Null for candidate-only actions: never fabricate an index publication. */
  index: RecordFileWrite | null;
  guards?: readonly Readonly<{
    path: string;
    before: RecordFileSnapshot | null;
  }>[];
}>;
export type RecordTransactionResult<Value> = Readonly<{
  value: Value | null;
  status: "ok" | "error";
  preflight: boolean;
  changed: boolean;
  committed: boolean;
  verification: "passed" | "failed-or-unknown" | "not-run";
  outcome: RecordMutationOutcome;
  errors: readonly unknown[];
  cleanupErrors: readonly unknown[];
  writtenPaths: readonly string[];
}>;

/** One owner for prepare → independent fresh → writes → commit/readback → cleanup/recovery. */
export async function runRecordTransaction<Value>(
  options: Readonly<{
    preflight?: boolean;
    prepare: () => Promise<RecordTransactionPlan<Value>>;
    withLock?: (
      operation: () => Promise<RecordTransactionResult<Value>>
    ) => Promise<RecordTransactionResult<Value>>;
    fresh: (value: Value) => Promise<void>;
    verify: (value: Value) => Promise<void>;
    verifyRecovered: (value: Value) => Promise<void>;
    cleanup?: (
      value: Value,
      writes: readonly RecordWrittenFile[]
    ) => Promise<void>;
    /** IR resource lifecycle remains domain-owned, at the same shared transaction boundary. */
    resources?: Readonly<{
      apply: (value: Value) => Promise<void>;
      recover: (value: Value) => Promise<void>;
      changed: () => boolean;
    }>;
  }>
): Promise<RecordTransactionResult<Value>> {
  if (options.preflight === true) {
    try {
      const plan = await options.prepare();
      return { ...emptyResult(plan.value), status: "ok", preflight: true };
    } catch (error) {
      return { ...emptyResult<Value>(null), errors: [error] };
    }
  }
  const execute = async () => {
    let plan: RecordTransactionPlan<Value>;
    try {
      plan = await options.prepare();
      await options.fresh(plan.value);
      await verifyPlan(plan);
    } catch (error) {
      return { ...emptyResult<Value>(null), errors: [error] };
    }
    return await executePreparedRecordTransaction(plan, options);
  };
  return options.withLock === undefined
    ? await execute()
    : await options.withLock(execute);
}

async function executePreparedRecordTransaction<Value>(
  plan: RecordTransactionPlan<Value>,
  options: Readonly<{
    verify: (value: Value) => Promise<void>;
    verifyRecovered: (value: Value) => Promise<void>;
    cleanup?: (
      value: Value,
      writes: readonly RecordWrittenFile[]
    ) => Promise<void>;
    resources?: Readonly<{
      apply: (value: Value) => Promise<void>;
      recover: (value: Value) => Promise<void>;
      changed: () => boolean;
    }>;
  }>
): Promise<RecordTransactionResult<Value>> {
  const journal = new RecordWriteJournal(plan.root);
  const { writes, createdDirectories, writtenPaths, cleanupErrors } = journal;
  let resourcesStarted = false;
  let verification: RecordTransactionResult<Value>["verification"] = "not-run";
  const errors: unknown[] = [];
  try {
    // Candidate resource work precedes the final source action: no index is invented
    // and a completed create/rename/exit is never mistaken for a precommit failure.
    if (plan.index === null && options.resources !== undefined) {
      for (const change of plan.writes) await journal.prepareParents(change);
      resourcesStarted = true;
      await options.resources.apply(plan.value);
    }
    for (const [index, change] of plan.writes.entries())
      await journal.apply(
        change,
        plan.index === null && index === plan.writes.length - 1
      );
    if (plan.index !== null && options.resources !== undefined) {
      resourcesStarted = true;
      await options.resources.apply(plan.value);
    }
    if (plan.index !== null) await journal.apply(plan.index, true);
    else
      journal.committed =
        writtenPaths.length > 0 || (options.resources?.changed() ?? false);
    await verifyWritten(plan, writes);
    await options.verify(plan.value);
    verification = "passed";
  } catch (error) {
    errors.push(error);
    if (journal.committed || journal.uncertainCommit)
      verification = "failed-or-unknown";
    else {
      if (resourcesStarted && options.resources !== undefined) {
        try {
          await options.resources.recover(plan.value);
        } catch (recovery) {
          errors.push(recovery);
        }
      }
      const recovery = await restoreRecordWrites(plan.root, writes);
      errors.push(...recovery);
      const directoryRecovery =
        await restoreRecordDirectories(createdDirectories);
      errors.push(...directoryRecovery);
      let recovered =
        !journal.uncertainWrite && recovery.length === 0 && errors.length === 1;
      try {
        await verifyRecoveredFiles(plan, writes);
      } catch (recovery) {
        errors.push(recovery);
        recovered = false;
      }
      try {
        await options.verifyRecovered(plan.value);
      } catch (recovery) {
        errors.push(recovery);
        recovered = false;
      }
      return {
        ...emptyResult(plan.value),
        changed:
          !recovered &&
          (writtenPaths.length > 0 ||
            (options.resources?.changed() ?? false) ||
            journal.uncertainWrite),
        errors,
        writtenPaths,
        outcome: recovered
          ? writtenPaths.length > 0 || (options.resources?.changed() ?? false)
            ? "rolled-back"
            : "no-change"
          : "partial-or-unknown"
      };
    }
  }
  if (options.cleanup !== undefined) {
    try {
      await options.cleanup(plan.value, writes);
    } catch (error) {
      cleanupErrors.push(error);
    }
  }
  return {
    ...emptyResult(plan.value),
    changed: writtenPaths.length > 0 || (options.resources?.changed() ?? false),
    committed: journal.committed,
    verification,
    writtenPaths,
    errors,
    cleanupErrors,
    status: errors.length === 0 && cleanupErrors.length === 0 ? "ok" : "error",
    outcome:
      errors.length > 0
        ? "partial-or-unknown"
        : cleanupErrors.length > 0 && journal.committed
          ? "committed-cleanup-pending"
          : "no-change"
  };
}

async function verifyRecoveredFiles<Value>(
  plan: RecordTransactionPlan<Value>,
  writes: readonly RecordWrittenFile[]
): Promise<void> {
  const restored = new Set(writes.map((item) => item.change.path));
  for (const change of [
    ...plan.writes,
    ...(plan.index === null ? [] : [plan.index])
  ]) {
    if (
      !sameRecordFile(
        await readRecordFileSnapshot(plan.root, change.path),
        change.before,
        !restored.has(change.path)
      )
    )
      throw new Error(
        "Transaction old range could not be verified: " + change.path
      );
  }
  for (const guard of plan.guards ?? [])
    if (!restored.has(guard.path))
      await verifyRecordFile(plan.root, guard.path, guard.before);
}

async function verifyPlan<Value>(
  plan: RecordTransactionPlan<Value>
): Promise<void> {
  const paths = new Set<string>();
  const phase = new RecordVerificationPhase(plan.root);
  for (const change of [
    ...plan.writes,
    ...(plan.index === null ? [] : [plan.index])
  ]) {
    if (paths.has(change.path))
      throw new Error(
        "Transaction contains duplicate write path: " + change.path
      );
    validateRecordWritePermissions(change);
    paths.add(change.path);
    await phase.verify(change.path, change.before);
  }
  for (const guard of plan.guards ?? [])
    await phase.verify(guard.path, guard.before);
}

async function verifyWritten<Value>(
  plan: RecordTransactionPlan<Value>,
  writes: readonly RecordWrittenFile[]
): Promise<void> {
  const phase = new RecordVerificationPhase(plan.root);
  const written = new Map(
    writes.map((item) => [item.change.path, item.written])
  );
  for (const change of [
    ...plan.writes,
    ...(plan.index === null ? [] : [plan.index])
  ])
    await phase.verify(
      change.path,
      written.has(change.path) ? written.get(change.path)! : change.before
    );
  for (const guard of plan.guards ?? [])
    if (!written.has(guard.path)) await phase.verify(guard.path, guard.before);
}

function emptyResult<Value>(
  value: Value | null
): RecordTransactionResult<Value> {
  return {
    value,
    status: "error",
    preflight: false,
    changed: false,
    committed: false,
    verification: "not-run",
    outcome: "no-change",
    errors: [],
    cleanupErrors: [],
    writtenPaths: []
  };
}

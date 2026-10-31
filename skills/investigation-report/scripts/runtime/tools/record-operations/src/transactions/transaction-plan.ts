/*
 * Synced TypeScript runtime; repository maintenance edits tools/record-operations/src/transactions/transaction-plan.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/record-operations/src/transactions/transaction-plan.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/record-operations/src/transactions/transaction-plan.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/investigation-report
 * Rebuild: bun run sync:investigation-report-check
 */
import path from "node:path";
import {
  sameRecordBytes,
  validateRecordWritePermissions,
  type RecordFileWrite
} from "./transaction-files.ts";
import type { RecordTransactionPlan } from "./transaction.ts";

/** Validate every proposal before skipping unchanged work; index keeps its commit role. */
export function normalizeRecordTransactionPlan<Value>(
  plan: RecordTransactionPlan<Value>
): RecordTransactionPlan<Value> {
  validateRecordTransactionWrites(plan);
  const writes: RecordFileWrite[] = [];
  const guards = [...(plan.guards ?? [])];
  for (const change of plan.writes) {
    if (unchangedRecordWrite(change))
      guards.push({ path: change.path, before: change.before });
    else writes.push(change);
  }
  return { ...plan, writes, guards };
}

export function validateRecordTransactionWrites<Value>(
  plan: RecordTransactionPlan<Value>
): void {
  const paths = new Set<string>();
  for (const change of [
    ...plan.writes,
    ...(plan.index === null ? [] : [plan.index])
  ]) {
    const resolved = path.resolve(change.path);
    if (paths.has(resolved))
      throw new Error(
        "Transaction contains duplicate write path: " + change.path
      );
    validateRecordWritePermissions(change);
    paths.add(resolved);
  }
}

/** The plan and actual-write journal use the same representation-preserving no-op. */
export function unchangedRecordWrite(change: RecordFileWrite): boolean {
  return (
    change.before !== null &&
    change.next !== null &&
    sameRecordBytes(change.before.bytes, change.next) &&
    (change.mode === undefined || change.mode === change.before.mode)
  );
}

/*
 * Synced TypeScript runtime; repository maintenance edits tools/record-operations/src/transaction-verification.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/record-operations/src/transaction-verification.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/record-operations/src/transaction-verification.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
import path from "node:path";
import {
  readRecordFileSnapshot,
  sameRecordFile,
  type RecordFileSnapshot
} from "./transaction-snapshot.ts";

/** One namespace and one verification phase; observations never cross fresh/postwrite. */
export class RecordVerificationPhase {
  private readonly root: string;
  private readonly observed = new Map<string, RecordFileSnapshot | null>();

  constructor(root: string) {
    this.root = path.resolve(root);
  }

  async verify(
    target: string,
    expected: RecordFileSnapshot | null
  ): Promise<void> {
    const resolved = path.resolve(target);
    if (
      this.observed.has(resolved) &&
      sameRecordFile(this.observed.get(resolved)!, expected)
    ) {
      return;
    }
    const actual = await readRecordFileSnapshot(this.root, resolved);
    if (!sameRecordFile(actual, expected)) {
      throw new Error("Transaction member changed: " + target);
    }
    // Retain the actual acquired bytes, not the caller's mutable expected bytes.
    this.observed.set(resolved, actual);
  }
}

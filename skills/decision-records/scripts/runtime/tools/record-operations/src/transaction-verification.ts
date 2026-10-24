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
  forEachRecordFileSnapshot,
  recordReaderWorkerThreshold,
  type RecordReadResult
} from "./reader-batch.ts";
import {
  readRecordFileSnapshot,
  sameRecordFile,
  type RecordFileSnapshot,
  type RecordTextSnapshot
} from "./transaction-snapshot.ts";

export type RecordGuard = Readonly<{
  path: string;
  before: RecordFileSnapshot | null;
}>;
export type RecordVerificationFailure = Readonly<{
  kind: "changed" | "unreadable";
  error: unknown;
}>;
type ReportFailure = (
  failure: RecordVerificationFailure,
  index: number
) => void;
type GuardRequest = Readonly<{ entryIndex: number; path: string }>;

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
    await this.verifyEntry({ path: target, before: expected }, 0);
  }

  assertRoot(root: string): void {
    if (path.resolve(root) !== this.root)
      throw new Error(
        "Verification source root does not match its phase: " + root
      );
  }

  /** Acquire this phase's domain text facts; never accept an earlier phase's proof. */
  async captureTextSnapshots(
    root: string,
    targets: readonly string[],
    consume: (
      result: RecordReadResult<RecordTextSnapshot>,
      index: number
    ) => void
  ): Promise<void> {
    this.assertRoot(root);
    await forEachRecordFileSnapshot(this.root, targets, (result, index) => {
      if (!result.ok) return consume(result, index);
      const target = path.resolve(targets[index]!);
      const captured = textObservation(this.root, target, result.value);
      if (captured.ok) this.observed.set(target, result.value);
      consume(captured, index);
    });
  }

  /** One phase's ordered guards; an equivalent overlap still uses its actual observation. */
  async verifyMany(
    entries: readonly RecordGuard[],
    report?: ReportFailure
  ): Promise<void> {
    if (entries.length < recordReaderWorkerThreshold) {
      for (const [index, entry] of entries.entries())
        await this.verifyEntry(entry, index, report);
      return;
    }
    const requests = this.scheduleGuards(entries);
    let cursor = 0;
    await forEachRecordFileSnapshot(
      this.root,
      requests.map((request) => request.path),
      async (result, index) => {
        const request = requests[index]!;
        // Recheck aliases against actual acquired bytes, never against expected references.
        while (cursor < request.entryIndex) {
          await this.verifyEntry(entries[cursor]!, cursor++, report);
        }
        const entryIndex = cursor++;
        const entry = entries[entryIndex]!;
        if (!result.ok)
          return this.fail(
            { kind: "unreadable", error: result.error },
            entryIndex,
            report
          );
        if (!this.accept(entry, result.value))
          this.fail(
            {
              kind: "changed",
              error: new Error("Transaction member changed: " + entry.path)
            },
            entryIndex,
            report
          );
      }
    );
    while (cursor < entries.length) {
      await this.verifyEntry(entries[cursor]!, cursor++, report);
    }
  }
  private accept(
    entry: RecordGuard,
    actual: RecordFileSnapshot | null
  ): boolean {
    if (!sameRecordFile(actual, entry.before)) return false;
    // Actual bytes stay private; callers only provide expectations or receive copies.
    this.observed.set(path.resolve(entry.path), actual);
    return true;
  }

  private async verifyEntry(
    entry: RecordGuard,
    index: number,
    report?: ReportFailure
  ): Promise<void> {
    const resolved = path.resolve(entry.path);
    if (
      this.observed.has(resolved) &&
      sameRecordFile(this.observed.get(resolved)!, entry.before)
    )
      return;
    let actual: RecordFileSnapshot | null;
    try {
      actual = await readRecordFileSnapshot(this.root, resolved);
    } catch (error) {
      return this.fail({ kind: "unreadable", error }, index, report);
    }
    if (!this.accept(entry, actual))
      this.fail(
        {
          kind: "changed",
          error: new Error("Transaction member changed: " + entry.path)
        },
        index,
        report
      );
  }

  private fail(
    failure: RecordVerificationFailure,
    index: number,
    report?: ReportFailure
  ): void {
    if (report === undefined) throw failure.error;
    report(failure, index);
  }

  /** Schedule only changed expectations; aliases are still rechecked against actual bytes. */
  private scheduleGuards(
    entries: readonly RecordGuard[]
  ): readonly GuardRequest[] {
    const scheduled = new Map(this.observed);
    const requests: GuardRequest[] = [];
    for (const [entryIndex, entry] of entries.entries()) {
      const resolved = path.resolve(entry.path);
      if (
        !scheduled.has(resolved) ||
        !sameRecordFile(scheduled.get(resolved)!, entry.before)
      )
        requests.push({ entryIndex, path: resolved });
      scheduled.set(resolved, entry.before);
    }
    return requests;
  }
}

/** Domain consumers receive copies; mutable bytes cannot rewrite the phase's actual proof. */
function textObservation(
  root: string,
  target: string,
  actual: RecordFileSnapshot | null
): RecordReadResult<RecordTextSnapshot> {
  if (actual === null)
    return {
      ok: false,
      error: Object.assign(new Error("Record source is missing: " + target), {
        code: "ENOENT"
      })
    };
  try {
    const text = new TextDecoder("utf-8", {
      fatal: true,
      ignoreBOM: true
    }).decode(actual.bytes);
    return {
      ok: true,
      value: {
        root,
        path: target,
        text,
        snapshot: {
          ...actual,
          bytes: Buffer.from(actual.bytes),
          parents: actual.parents.map((parent) => ({ ...parent }))
        }
      }
    };
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    return { ok: false, error };
  }
}

import path from "node:path";
import {
  forEachRecordFileSnapshot,
  recordReaderWorkerThreshold
} from "./reader-batch.ts";
import {
  readRecordFileSnapshot,
  sameRecordFile,
  type RecordFileSnapshot
} from "./transaction-snapshot.ts";

type RecordGuard = Readonly<{
  path: string;
  before: RecordFileSnapshot | null;
}>;
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

  /** One phase's ordered guards; an equivalent overlap still uses its actual observation. */
  async verifyMany(entries: readonly RecordGuard[]): Promise<void> {
    if (entries.length < recordReaderWorkerThreshold) {
      for (const entry of entries) await this.verify(entry.path, entry.before);
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
          const entry = entries[cursor++]!;
          await this.verify(entry.path, entry.before);
        }
        const entry = entries[cursor++]!;
        if (!result.ok) throw result.error;
        if (!sameRecordFile(result.value, entry.before))
          throw new Error("Transaction member changed: " + entry.path);
        this.observed.set(request.path, result.value);
      }
    );
    while (cursor < entries.length) {
      const entry = entries[cursor++]!;
      await this.verify(entry.path, entry.before);
    }
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

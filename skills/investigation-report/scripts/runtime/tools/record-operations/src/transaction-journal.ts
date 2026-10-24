/*
 * Synced TypeScript runtime; repository maintenance edits tools/record-operations/src/transaction-journal.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/record-operations/src/transaction-journal.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/record-operations/src/transaction-journal.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/investigation-report
 * Rebuild: bun run sync:investigation-report-check
 */
import { unchangedRecordWrite } from "./transaction-plan.ts";
import {
  RecordAtomicCleanupError,
  validateRecordWritePermissions,
  captureRecordWrite,
  createRecordWriteParents,
  readRecordFileSnapshot,
  recordWriteMatches,
  sameRecordFile,
  writeRecordFile,
  type RecordCreatedDirectory,
  type RecordFileWrite,
  type RecordWriteIdentity,
  type RecordWrittenFile
} from "./transaction-files.ts";

/** 单次事务实际文件写入的归属与提交观察；领域资源与阶段顺序仍由事务脚本维护。 */
export class RecordWriteJournal {
  readonly #root: string;
  readonly #writes: RecordWrittenFile[] = [];
  readonly #createdDirectories: RecordCreatedDirectory[] = [];
  readonly #writtenPaths: string[] = [];
  readonly #cleanupErrors: unknown[] = [];
  #committed = false;
  #uncertainWrite = false;
  #uncertainCommit = false;

  constructor(root: string) {
    this.#root = root;
  }

  get writes(): readonly RecordWrittenFile[] {
    return this.#writes;
  }

  get createdDirectories(): readonly RecordCreatedDirectory[] {
    return this.#createdDirectories;
  }

  get writtenPaths(): readonly string[] {
    return this.#writtenPaths;
  }

  get cleanupErrors(): readonly unknown[] {
    return this.#cleanupErrors;
  }

  get committed(): boolean {
    return this.#committed;
  }

  get uncertainWrite(): boolean {
    return this.#uncertainWrite;
  }

  get uncertainCommit(): boolean {
    return this.#uncertainCommit;
  }

  /** Candidate source actions commit once their final write or resource action completes. */
  completeSourceActions(resourcesChanged: boolean): void {
    this.#committed = this.#writtenPaths.length > 0 || resourcesChanged;
  }

  recordCleanupFailure(error: unknown): void {
    this.#cleanupErrors.push(error);
  }

  async prepareParents(change: RecordFileWrite): Promise<void> {
    if (change.before === null && change.next !== null)
      await createRecordWriteParents(
        this.#root,
        change.path,
        this.#createdDirectories
      );
  }

  async apply(change: RecordFileWrite, commitPoint: boolean): Promise<void> {
    validateRecordWritePermissions(change);
    if (unchangedRecordWrite(change)) return;
    await this.prepareParents(change);
    let identity: RecordWriteIdentity | null | undefined;
    try {
      identity = await writeRecordFile(this.#root, change);
    } catch (error) {
      if (commitPoint && error instanceof RecordAtomicCleanupError) {
        await this.capturePublishedCleanup(change, error);
        return;
      }
      await this.observeRejectedWrite(change, commitPoint);
      throw error;
    }
    this.#writtenPaths.push(change.path);
    if (commitPoint) this.#committed = true;
    await this.captureCompletedWrite(change, identity);
  }

  private async capturePublishedCleanup(
    change: RecordFileWrite,
    error: RecordAtomicCleanupError
  ): Promise<void> {
    this.#committed = true;
    this.#writtenPaths.push(change.path);
    this.#cleanupErrors.push(error);
    this.#writes.push({
      change,
      written: await captureRecordWrite(this.#root, change, error.identity),
      owned: error.identity !== undefined
    });
  }

  private async captureCompletedWrite(
    change: RecordFileWrite,
    identity: RecordWriteIdentity | null | undefined
  ): Promise<void> {
    const written = await captureRecordWrite(
      this.#root,
      change,
      identity
    ).catch((error: unknown) => {
      this.#uncertainWrite = true;
      throw error;
    });
    const owned =
      identity !== undefined ||
      (change.before !== null &&
        written !== null &&
        change.before.dev === written.dev &&
        change.before.ino === written.ino);
    this.#writes.push({ change, written, owned });
  }

  /** writer 拒绝仍可能已经写入；无实际 handle 归属证明时不自动覆盖当前路径。 */
  private async observeRejectedWrite(
    change: RecordFileWrite,
    commitPoint: boolean
  ): Promise<void> {
    try {
      const current = await readRecordFileSnapshot(this.#root, change.path);
      const changed = !sameRecordFile(current, change.before);
      this.#uncertainWrite ||= changed;
      if (commitPoint && changed) {
        this.#uncertainCommit = true;
        this.#committed = recordWriteMatches(change, current);
      }
    } catch {
      this.#uncertainWrite = true;
      if (commitPoint) this.#uncertainCommit = true;
    }
    if (this.#uncertainWrite) this.#writtenPaths.push(change.path);
  }
}

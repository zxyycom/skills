import type { RecordVerificationPhase } from "../../../record-operations/src/transactions/transaction-verification.ts";
import {
  forEachRecordTextSnapshot,
  type RecordReadResult
} from "../../../record-operations/src/reader/reader-batch.ts";
import path from "node:path";
import {
  readRecordTextSnapshot,
  requireRecordTextSnapshot,
  type RecordTextSnapshot
} from "../../../record-operations/src/transactions/transaction-snapshot.ts";
import { parseInvestigationReport } from "../records/markdown.ts";
import type {
  InvestigationSource,
  ParsedInvestigationReport
} from "../types.ts";

/** One validation phase's facts only; a new phase creates its own acquisition. */
export class InvestigationPreparation {
  readonly root: string;
  readonly directory: string;
  private readonly verification: RecordVerificationPhase | undefined;
  private readonly snapshots = new Map<string, RecordTextSnapshot>();
  private readonly documents = new Map<
    string,
    Readonly<{ id: string; parsed: ParsedInvestigationReport }>
  >();

  constructor(
    root: string,
    directory = root,
    verification?: RecordVerificationPhase
  ) {
    this.root = path.resolve(root);
    this.directory = path.resolve(directory);
    this.verification = verification;
  }

  async readOrCaptured(target: string): Promise<string> {
    return (
      this.snapshots.get(path.resolve(target))?.text ??
      (await this.read(target))
    );
  }

  async read(target: string): Promise<string> {
    if (this.snapshots.has(path.resolve(target)))
      throw new Error(
        "Strict Investigation source was already captured: " + target
      );
    if (this.verification !== undefined) {
      let captured: RecordTextSnapshot | undefined;
      await this.verification.captureTextSnapshots(
        this.root,
        [target],
        (result) => {
          if (!result.ok) throw result.error;
          captured = result.value;
        }
      );
      if (captured === undefined)
        throw new Error("Verification source was not acquired: " + target);
      this.snapshots.set(captured.path, captured);
      return captured.text;
    }
    const captured = await readRecordTextSnapshot(this.root, target);
    this.snapshots.set(captured.path, captured);
    return captured.text;
  }

  async readMany(
    targets: readonly string[],
    consume: (result: RecordReadResult<string>, index: number) => void
  ): Promise<void> {
    for (const target of targets)
      if (this.snapshots.has(path.resolve(target)))
        throw new Error(
          "Strict Investigation source was already captured: " + target
        );
    const consumeSnapshot = (
      result: RecordReadResult<RecordTextSnapshot>,
      index: number
    ) => {
      if (result.ok) {
        this.snapshots.set(result.value.path, result.value);
        consume({ ok: true, value: result.value.text }, index);
      } else consume(result, index);
    };
    if (this.verification !== undefined)
      await this.verification.captureTextSnapshots(
        this.root,
        targets,
        consumeSnapshot
      );
    else await forEachRecordTextSnapshot(this.root, targets, consumeSnapshot);
  }

  captured(target: string, text: string): RecordTextSnapshot {
    const captured = this.snapshots.get(path.resolve(target));
    if (captured === undefined)
      throw new Error(
        "Strict Investigation preparation has no source proof: " + target
      );
    requireRecordTextSnapshot(captured, this.root, target, text);
    return captured;
  }

  parsed(
    source: InvestigationSource,
    candidate = false
  ): ParsedInvestigationReport {
    const target = path.resolve(this.directory, source.sourcePath);
    this.captured(target, source.text);
    const key = source.sourcePath;
    const previous = this.documents.get(key);
    if (previous !== undefined) {
      if (previous.id !== source.id)
        throw new Error(
          "Strict Investigation document identity changed: " + target
        );
      return previous.parsed;
    }
    const parsed = parseInvestigationReport(
      source.text,
      source.id,
      candidate ? { allowEmptyCoreSections: true } : {}
    );
    this.documents.set(key, { id: source.id, parsed });
    return parsed;
  }
}

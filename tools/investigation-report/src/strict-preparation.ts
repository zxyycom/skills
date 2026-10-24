import {
  forEachRecordTextSnapshot,
  type RecordReadResult
} from "../../record-operations/src/reader-batch.ts";
import path from "node:path";
import {
  readRecordTextSnapshot,
  requireRecordTextSnapshot,
  type RecordTextSnapshot
} from "../../record-operations/src/transaction-snapshot.ts";
import { parseInvestigationReport } from "./markdown.ts";
import type {
  InvestigationSource,
  ParsedInvestigationReport
} from "./types.ts";

/** One validation phase's facts only; a new phase creates its own acquisition. */
export class InvestigationPreparation {
  readonly root: string;
  readonly directory: string;
  private readonly snapshots = new Map<string, RecordTextSnapshot>();
  private readonly documents = new Map<
    string,
    Readonly<{ id: string; parsed: ParsedInvestigationReport }>
  >();

  constructor(root: string, directory = root) {
    this.root = path.resolve(root);
    this.directory = path.resolve(directory);
  }

  async read(target: string): Promise<string> {
    if (this.snapshots.has(path.resolve(target)))
      throw new Error(
        "Strict Investigation source was already captured: " + target
      );
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
    await forEachRecordTextSnapshot(this.root, targets, (result, index) => {
      if (result.ok) {
        this.snapshots.set(result.value.path, result.value);
        consume({ ok: true, value: result.value.text }, index);
      } else consume(result, index);
    });
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

import {
  readRecordTextSnapshot,
  type RecordTextSnapshot
} from "../../record-operations/src/transaction-snapshot.ts";
import { errorText } from "./scan-support.ts";
import type { SourceFile } from "./scan-contracts.ts";

/** Acquisition sidecar belongs only to the current strict preparation, never the SDK DTOs. */
export type DecisionSourceCapture = Readonly<{
  root: string;
  sources: Map<string, RecordTextSnapshot>;
}>;

/** Populate the existing same-call text/failed slots before normal identity and body parsing. */
export async function captureDecisionSourceFiles(
  sourceFiles: readonly SourceFile[],
  sourceErrors: string[],
  capture: DecisionSourceCapture
): Promise<void> {
  for (const source of sourceFiles) {
    try {
      const captured = await readRecordTextSnapshot(
        capture.root,
        source.decisionPath
      );
      capture.sources.set(captured.path, captured);
      source.sourceText = captured.text;
    } catch (error) {
      source.sourceReadFailed = true;
      sourceErrors.push(
        source.sourcePath + " could not be read: " + errorText(error)
      );
    }
  }
}

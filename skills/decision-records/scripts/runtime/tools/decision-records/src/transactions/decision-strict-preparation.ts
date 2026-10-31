/*
 * Synced TypeScript runtime; repository maintenance edits tools/decision-records/src/transactions/decision-strict-preparation.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/decision-records/src/transactions/decision-strict-preparation.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/decision-records/src/transactions/decision-strict-preparation.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
import { forEachRecordTextSnapshot } from "../../../record-operations/src/reader/reader-batch.ts";
import { type RecordTextSnapshot } from "../../../record-operations/src/transactions/transaction-snapshot.ts";
import { errorText } from "../scan/scan-support.ts";
import type { SourceFile } from "../scan/scan-contracts.ts";

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
  await forEachRecordTextSnapshot(
    capture.root,
    sourceFiles.map((source) => source.decisionPath),
    (result, index) => {
      const source = sourceFiles[index]!;
      if (result.ok) {
        capture.sources.set(result.value.path, result.value);
        source.sourceText = result.value.text;
      } else {
        source.sourceReadFailed = true;
        sourceErrors.push(
          source.sourcePath + " could not be read: " + errorText(result.error)
        );
      }
    }
  );
}

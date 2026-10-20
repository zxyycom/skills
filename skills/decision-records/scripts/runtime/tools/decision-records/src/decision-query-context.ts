/*
 * Synced TypeScript runtime; repository maintenance edits tools/decision-records/src/decision-query-context.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/decision-records/src/decision-query-context.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/decision-records/src/decision-query-context.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
import path from "node:path";
import {
  createStateIndexReader,
  type StateIndexReader
} from "../../index-runtime/src/index.ts";
import {
  decisionFailure,
  type DecisionApplicationFailure
} from "./application-result.ts";
import {
  createDecisionStateIndexDefinition,
  decisionIndexFileName,
  decisionIndexDiagnostics,
  decisionIndexRecovery,
  loadDecisionIndex
} from "./decision-state-index.ts";
import { displayDecisionPath } from "./decision-path.ts";
import type {
  DecisionIndex,
  DecisionIndexMetadata,
  DecisionIndexState,
  DecisionScanOptions
} from "./types.ts";

export type DecisionLocation = Readonly<{
  decisionsDir: string;
  workspaceRoot: string;
}>;

export type DecisionQueryContext = Readonly<{
  decisionsDirectory: string;
  index: DecisionIndex;
  indexRelativePath: string;
  reader: StateIndexReader<DecisionIndexState, DecisionIndexMetadata>;
  status: "ok";
  warnings: string[];
}>;

type ResolvedDecisionLocation = Readonly<{
  decisionsDirectory: string;
  workspaceRoot: string;
}>;

export async function loadDecisionQueryContext(
  location: DecisionLocation
): Promise<DecisionApplicationFailure | DecisionQueryContext> {
  const { decisionsDirectory, workspaceRoot } =
    resolveDecisionLocation(location);
  const indexPath = path.join(decisionsDirectory, decisionIndexFileName);
  const indexRelativePath = displayDecisionPath(workspaceRoot, indexPath);
  const currentIndex = await loadDecisionIndex({
    decisionsDirectory
  });
  if (currentIndex.status === "error") {
    return decisionFailure(
      decisionIndexDiagnostics(currentIndex.diagnostics, {
        code: "decision-records.index-query-failed",
        recovery: decisionIndexRecovery(
          currentIndex.diagnostics,
          "Run sync-index after correcting the decision Markdown or index problem."
        ),
        target: indexRelativePath
      })
    );
  }
  return {
    decisionsDirectory,
    index: currentIndex.value,
    indexRelativePath,
    reader: createStateIndexReader({
      definition: createDecisionStateIndexDefinition(),
      index: currentIndex.value,
      indexPath: indexRelativePath
    }),
    status: "ok",
    warnings: []
  };
}

export const persistedSnapshotBodyWarning =
  "The selected Decision metadata differs from its current source; the metadata reflects the last published index snapshot while the body is read from the current decision Markdown. Run sync-index to publish the current projection.";

/**
 * The decisions directory is a workspace-relative path by location contract;
 * callers received it from the CLI boundary or the scan location API.
 */
export function resolveDecisionLocation(
  location: DecisionLocation
): ResolvedDecisionLocation {
  const workspaceRoot = path.resolve(location.workspaceRoot);
  return {
    decisionsDirectory: path.resolve(workspaceRoot, location.decisionsDir),
    workspaceRoot
  };
}

export function decisionScanOptions(
  location: DecisionLocation
): DecisionScanOptions {
  return {
    decisionsDir: location.decisionsDir,
    workspaceRoot: location.workspaceRoot
  };
}

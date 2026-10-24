/*
 * Synced TypeScript runtime; repository maintenance edits tools/decision-records/src/decision-query-context.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/decision-records/src/decision-query-context.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/decision-records/src/decision-query-context.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
import {
  loadDecisionIndexSnapshot,
  type DecisionIndexSnapshot
} from "./decision-index-snapshot.ts";
import path from "node:path";
import { canonicalRecordCollection } from "../../record-operations/src/source.ts";
import {
  decisionFailure,
  type DecisionApplicationFailure
} from "./application-result.ts";
import {
  decisionIndexFileName,
  decisionIndexDiagnostics,
  decisionIndexRecovery
} from "./decision-state-index.ts";
import { displayDecisionPath } from "./decision-path.ts";
import type { DecisionScanOptions } from "./types.ts";

export type DecisionLocation = Readonly<{
  decisionsDir: string;
  workspaceRoot: string;
}>;

export type DecisionQueryContext = DecisionIndexSnapshot &
  Readonly<{
    decisionsDirectory: string;
    indexRelativePath: string;
    status: "ok";
    warnings: string[];
  }>;

type ResolvedDecisionLocation = Readonly<{
  decisionsDirectory: string;
  workspaceRoot: string;
}>;

export async function loadDecisionQueryContext(
  location: DecisionLocation,
  requiresRelations = false
): Promise<DecisionApplicationFailure | DecisionQueryContext> {
  let decisionsDirectory: string;
  let workspaceRoot: string;
  try {
    const canonical = await canonicalRecordCollection(
      location.workspaceRoot,
      location.decisionsDir
    );
    decisionsDirectory = canonical.collectionRoot;
    workspaceRoot = canonical.workspaceRoot;
  } catch (error) {
    return decisionFailure([
      error instanceof Error
        ? error.message
        : "Decision collection could not be safely resolved"
    ]);
  }
  const indexPath = path.join(decisionsDirectory, decisionIndexFileName);
  const indexRelativePath = displayDecisionPath(workspaceRoot, indexPath);
  const currentIndex = await loadDecisionIndexSnapshot({
    decisionsDirectory,
    queryOnly: !requiresRelations
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
    index: currentIndex.value.index,
    getRelationGraph: currentIndex.value.getRelationGraph,
    relationErrors: currentIndex.value.relationErrors,
    indexRelativePath,
    entries: currentIndex.value.entries,
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

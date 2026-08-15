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
  decisionIndexDiagnosticMessages,
  loadDecisionIndex
} from "./decision-state-index.ts";
import { displayDecisionPath } from "./decision-path.ts";
import type {
  DecisionIndex,
  DecisionIndexMetadata,
  DecisionIndexState,
  DecisionScanOptions
} from "./types.ts";

export type DecisionLocation = {
  decisionsDir: string;
  workspaceRoot: string;
};

export type DecisionQueryContext = {
  decisionsDirectory: string;
  index: DecisionIndex;
  indexRelativePath: string;
  reader: StateIndexReader<DecisionIndexState, DecisionIndexMetadata>;
  status: "ok";
};

type ResolvedDecisionLocation = {
  decisionsDirectory: string;
  workspaceRoot: string;
};

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
      decisionIndexDiagnosticMessages(
        currentIndex.diagnostics,
        indexRelativePath
      )
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
    status: "ok"
  };
}

export function resolveDecisionLocation(
  location: DecisionLocation
): ResolvedDecisionLocation {
  const workspaceRoot = path.resolve(location.workspaceRoot);
  return {
    decisionsDirectory: path.isAbsolute(location.decisionsDir)
      ? path.resolve(location.decisionsDir)
      : path.resolve(workspaceRoot, location.decisionsDir),
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

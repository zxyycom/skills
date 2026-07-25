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
  decisionIndexDiagnosticMessages,
  loadCurrentDecisionIndex
} from "./decision-state-index.ts";
import { selectDecisionIndexSourcePaths } from "./index.ts";
import { scanDecisionRecords } from "./scan.ts";
import type {
  DecisionIndex,
  DecisionIndexMetadata,
  DecisionIndexState,
  DecisionScan,
  DecisionScanOptions
} from "./types.ts";

export type DecisionLocation = {
  decisionsDir: string;
  workspaceRoot: string;
};

export type DecisionQueryContext = {
  index: DecisionIndex;
  reader: StateIndexReader<DecisionIndexState, DecisionIndexMetadata>;
  scan: DecisionScan;
  status: "ok";
  warnings: string[];
};

export async function loadDecisionQueryContext(
  location: DecisionLocation
): Promise<DecisionApplicationFailure | DecisionQueryContext> {
  const scan = await scanDecisionRecords(decisionScanOptions(location));
  if (scan.index === null) {
    return decisionFailure(scan.errors);
  }
  if (scan.domainErrors.length > 0) {
    return decisionFailure(scan.domainErrors);
  }
  const selection = selectDecisionIndexSourcePaths(scan);
  if (selection.errors.length > 0) {
    return decisionFailure(selection.errors);
  }
  const currentIndex = await loadCurrentDecisionIndex({
    decisionsDirectory: scan.decisionsDirectory,
    relativePaths: selection.relativePaths
  });
  if (currentIndex.status === "error") {
    return decisionFailure(decisionIndexDiagnosticMessages(
      currentIndex.diagnostics,
      scan.indexRelativePath
    ));
  }
  if (!sameDecisionIndexSnapshot(scan.index, currentIndex.value)) {
    return decisionFailure([
      scan.indexRelativePath + " changed while preparing the query; retry"
    ]);
  }
  return {
    index: currentIndex.value,
    reader: createStateIndexReader({
      definition: createDecisionStateIndexDefinition(),
      index: currentIndex.value,
      indexPath: scan.indexRelativePath
    }),
    scan,
    status: "ok",
    warnings: [...new Set(scan.errors)]
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

function sameDecisionIndexSnapshot(
  left: DecisionIndex,
  right: DecisionIndex
): boolean {
  return left.sourceRevision === right.sourceRevision
    && left.entries.length === right.entries.length
    && left.entries.every((entry, index) => entry.id === right.entries[index]?.id);
}

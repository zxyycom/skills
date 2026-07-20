import type { DecisionIndex } from "./decision-index.ts";

export const decisionRelationTypes = [
  "修订",
  "替代",
  "判定无效",
  "归并"
] as const;

export type DecisionRelationType = typeof decisionRelationTypes[number];

export type DecisionTraceDirection = "both" | "predecessors" | "successors";

export type DecisionRelation = {
  target: string;
  type: DecisionRelationType;
};

export type { DecisionIndex, DecisionIndexEntry } from "./decision-index.ts";

export type DecisionRecord = {
  archived: boolean;
  areaId: string;
  background: string;
  bodyValid: boolean;
  current: boolean;
  datePrefix: string;
  decision: string;
  decisionPath: string;
  fileName: string;
  fullDate: string | null;
  purpose: string;
  relations: DecisionRelation[];
  relativePath: string;
  title: string;
};

export function compareDecisionRecords(left: DecisionRecord, right: DecisionRecord): number {
  const areaOrder = left.areaId.localeCompare(right.areaId);
  if (areaOrder !== 0) {
    return areaOrder;
  }

  const dateOrder = right.datePrefix.localeCompare(left.datePrefix);
  return dateOrder !== 0 ? dateOrder : left.fileName.localeCompare(right.fileName);
}

export type DecisionScanOptions = {
  decisionsDir?: string;
  workspaceRoot?: string;
};

export type DecisionScan = {
  areaIds: Set<string>;
  currentPaths: Set<string>;
  decisionsDirectoryAvailable: boolean;
  decisionsDirectory: string;
  errors: string[];
  index: DecisionIndex | null;
  indexExists: boolean;
  indexPath: string;
  indexRelativePath: string;
  indexText: string;
  records: DecisionRecord[];
  workspaceRoot: string;
};

export type DecisionValidationResult = {
  archivedCount: number;
  areaCount: number;
  currentCount: number;
  decisionCount: number;
  errors: string[];
  scan: DecisionScan;
};

export type ExpectedIndex = {
  errors: string[];
  text: string | null;
};

export type MarkdownSection = {
  content: string;
  heading: string;
  index: number;
};

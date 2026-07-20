import type { DecisionIndex } from "./decision-index.ts";

export const decisionRelationTypes = [
  "修订",
  "替代",
  "判定无效",
  "归并"
] as const;

export type DecisionRelationType = typeof decisionRelationTypes[number];

export type DecisionTraceDirection = "both" | "predecessors" | "successors";

export const decisionStatuses = ["active", "archived"] as const;

export type DecisionStatus = typeof decisionStatuses[number];
export type DecisionListStatus = DecisionStatus | "all";

export type DecisionRelation = {
  target: string;
  type: DecisionRelationType;
};

export type { DecisionIndex, DecisionIndexEntry } from "./decision-index.ts";

export type DecisionProjection = {
  background: string;
  decision: string;
  purpose: string;
  relations: DecisionRelation[];
  title: string;
};

export type DecisionDocument = DecisionProjection;

export type DecisionRecord = {
  areaId: string;
  bodyValid: boolean;
  createdAt: string | null;
  decisionPath: string;
  document: DecisionDocument | null;
  fileName: string;
  indexed: boolean;
  markdownExists: boolean;
  projection: DecisionProjection;
  relativePath: string;
  status: DecisionStatus | null;
};

export function compareDecisionRecords(left: DecisionRecord, right: DecisionRecord): number {
  return left.relativePath.localeCompare(right.relativePath);
}

export type DecisionScanOptions = {
  decisionsDir?: string;
  workspaceRoot?: string;
};

export type DecisionScan = {
  areaIds: Set<string>;
  decisionsDirectoryAvailable: boolean;
  decisionsDirectory: string;
  errors: string[];
  index: DecisionIndex | null;
  indexExists: boolean;
  indexPath: string;
  indexRelativePath: string;
  indexText: string;
  records: DecisionRecord[];
  unindexedPaths: Set<string>;
  workspaceRoot: string;
};

export type DecisionValidationResult = {
  activeCount: number;
  archivedCount: number;
  areaCount: number;
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

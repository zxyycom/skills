import type {
  StateIndex,
  StateIndexEntry
} from "../../index-runtime/src/index.ts";

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

export const decisionAlignments = ["aligned", "unaligned"] as const;

export type DecisionAlignment = typeof decisionAlignments[number];
export type DecisionListAlignment = DecisionAlignment | "all";

export type DecisionRelation = {
  target: string;
  type: DecisionRelationType;
};

export type DecisionProjection = {
  background: string;
  decision: string;
  purpose: string;
  relations: DecisionRelation[];
  title: string;
};

export type DecisionMetadata =
  | {
    alignment: "aligned";
    createdAt: string;
    status: "active";
  }
  | {
    alignment: "unaligned";
    createdAt: string;
    status: "active";
  }
  | {
    alignment: null;
    createdAt: string;
    status: "archived";
  };

export type DecisionDocument = DecisionProjection & DecisionMetadata;

export type DecisionIndexState = DecisionDocument & {
  path: string;
};

export type DecisionIndexEntry = StateIndexEntry<DecisionIndexState>;

export type DecisionIndex = Omit<
  StateIndex,
  "definitionVersion" | "entries" | "namespace"
> & {
  definitionVersion: 1;
  entries: DecisionIndexEntry[];
  namespace: "decisions";
};

export type DecisionRecord = {
  activationCandidate: boolean;
  alignment: DecisionAlignment | null;
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
  activationCandidateErrors: string[];
  areaIds: Set<string>;
  decisionsDirectoryAvailable: boolean;
  decisionsDirectory: string;
  errors: string[];
  indexErrors: string[];
  index: DecisionIndex | null;
  indexExists: boolean;
  indexPath: string;
  indexRelativePath: string;
  indexText: string;
  records: DecisionRecord[];
  sourceErrors: string[];
  workspaceRoot: string;
};

export type DecisionValidationResult = {
  activationCandidateCount: number;
  activeCount: number;
  alignedCount: number;
  archivedCount: number;
  areaCount: number;
  decisionCount: number;
  errors: string[];
  scan: DecisionScan;
  unalignedCount: number;
};

export type MarkdownSection = {
  content: string;
  heading: string;
  index: number;
};

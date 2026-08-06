export type DecisionRelationType =
  | "修订"
  | "替代"
  | "判定无效"
  | "归并"
  | "拆分";

export type DecisionStatus = "active" | "archived";

export type DecisionListStatus = DecisionStatus | "all";

export type DecisionAlignment = "aligned" | "unaligned";

export type DecisionListAlignment = DecisionAlignment | "all";

export type DecisionRelation = {
  type: DecisionRelationType;
  target: string;
};

export type DecisionDomainDefinition = {
  id: string;
  description: string;
};

export type DecisionProjection = {
  title: string;
  purpose: string;
  background: string;
  decision: string;
  relations: DecisionRelation[];
};

export type DecisionMetadata =
  | {
    status: "active";
    alignment: "aligned";
    createdAt: string;
  }
  | {
    status: "active";
    alignment: "unaligned";
    createdAt: string;
  }
  | {
    status: "archived";
    alignment: DecisionAlignment | null;
    createdAt: string;
  };

export type DecisionDocument = DecisionProjection & DecisionMetadata;

export type DecisionIndexState = DecisionDocument & {
  path: string;
};

export type DecisionIndexEntry = {
  id: string;
  keys: Record<string, Array<boolean | number | string>>;
  state: DecisionIndexState;
};

export type DecisionIndexMetadata = {
  domains: DecisionDomainDefinition[];
};

export type DecisionIndex = {
  schemaVersion: 2;
  namespace: "decisions";
  definitionVersion: 5;
  metadata: DecisionIndexMetadata;
  sourceRevision: string;
  keyDefinitions: Array<{
    name: string;
    mode: "exact" | "range" | "text";
  }>;
  entries: DecisionIndexEntry[];
};

export type DecisionRecord = {
  activationCandidate: boolean;
  alignment: DecisionAlignment | null;
  bodyValid: boolean;
  createdAt: string | null;
  decisionPath: string;
  document: DecisionDocument | null;
  domain: string;
  fileName: string;
  indexed: boolean;
  markdownExists: boolean;
  projection: DecisionProjection;
  relativePath: string;
  relationshipErrors: string[];
  status: DecisionStatus | null;
};

export type DecisionScanOptions = {
  decisionsDir?: string;
  workspaceRoot?: string;
};

export type DecisionScan = {
  activationCandidateErrors: string[];
  decisionsDirectoryAvailable: boolean;
  decisionsDirectory: string;
  domainErrors: string[];
  domainIds: Set<string>;
  errors: string[];
  index: DecisionIndex | null;
  indexErrors: string[];
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
  decisionCount: number;
  domainCount: number;
  errors: string[];
  scan: DecisionScan;
  unalignedCount: number;
};

export declare function runDecisionRecordsCli(
  argv?: readonly string[]
): Promise<number>;

export declare function scanDecisionRecords(
  options?: DecisionScanOptions
): Promise<DecisionScan>;

export declare function validateDecisionRecords(
  options?: DecisionScanOptions
): Promise<DecisionValidationResult>;

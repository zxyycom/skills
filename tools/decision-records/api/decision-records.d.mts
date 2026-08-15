export type DecisionRelationType =
  | "修订"
  | "替代"
  | "判定无效"
  | "归并"
  | "拆分";

export type DecisionStatus = "candidate" | "active" | "archived";

export type EstablishedDecisionStatus = "active" | "archived";

export type DecisionListStatus = EstablishedDecisionStatus | "all";

export type DecisionAlignment = "aligned" | "unaligned";

export type DecisionListAlignment = DecisionAlignment | "all";

/** A stable Markdown basename such as `use-stable-ids.md`. */
export type DecisionId = string;

export type DecisionRelation = {
  type: DecisionRelationType;
  target: DecisionId;
};

export type DecisionSuccessor = {
  alignment: DecisionAlignment;
  decisionId: DecisionId;
};

export type DecisionRelationOverride =
  | { kind: "source" }
  | {
      kind: "replace";
      relations: DecisionRelation[];
    };

export type DecisionProjection = {
  title: string;
  purpose: string;
  background: string;
  decision: string;
  relations: DecisionRelation[];
};

export type DecisionTags = {
  tags: string[];
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

export type DecisionDocument = DecisionProjection & DecisionTags & DecisionMetadata;

export type DecisionCandidateDocument = DecisionProjection & DecisionTags & {
  status: "candidate";
  alignment: null;
  createdAt: null;
};

export type DecisionRecordSource =
  | {
      body: string;
      document: DecisionCandidateDocument;
      kind: "candidate";
      text: string;
    }
  | {
      body: string;
      document: DecisionDocument;
      kind: "established";
      text: string;
    }
  | {
      kind: "invalid";
      text: string;
    }
  | {
      kind: "missing";
    };

export type DecisionIndexState = DecisionDocument & {
  sourcePath: string;
};

export type DecisionIndexStoredEntry = {
  keys: Record<string, Array<boolean | number | string>>;
  state: DecisionIndexState;
};

export type DecisionIndexEntry = DecisionIndexStoredEntry & {
  id: DecisionId;
};

/** The index has no independently maintained metadata. */
export type DecisionIndexMetadata = Record<string, never>;

export type DecisionSourceRevision = {
  metadata: string;
  entries: Record<DecisionId, string>;
};

export type DecisionIndex = {
  schemaVersion: 3;
  namespace: "decisions";
  definitionVersion: 6;
  metadata: DecisionIndexMetadata;
  sourceRevision: DecisionSourceRevision;
  keyDefinitions: Array<{
    name: string;
    mode: "exact" | "range" | "text";
  }>;
  entries: Record<DecisionId, DecisionIndexStoredEntry>;
};

export type DecisionRecord = {
  /** Whether the source is a complete candidate eligible for activation. */
  activationCandidate: boolean;
  alignment: DecisionAlignment | null;
  bodyValid: boolean;
  createdAt: string | null;
  decisionId: DecisionId;
  decisionPath: string;
  document: DecisionDocument | null;
  indexed: boolean;
  markdownExists: boolean;
  projection: DecisionProjection;
  relationshipErrors: string[];
  source: DecisionRecordSource;
  sourcePath: string;
  status: DecisionStatus | null;
  tags: string[];
};

export type DecisionScanOptions = {
  decisionsDir?: string;
  workspaceRoot?: string;
};

export type DecisionScan = {
  /** @deprecated Candidates no longer produce validation errors; always empty. */
  activationCandidateErrors: string[];
  /** Source collection errors that prevent returning a partial candidate query. */
  collectionErrors: string[];
  decisionsDirectoryAvailable: boolean;
  decisionsDirectory: string;
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
  /** Number of complete candidates eligible for activation. */
  activationCandidateCount: number;
  activeCount: number;
  alignedCount: number;
  archivedCount: number;
  decisionCount: number;
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

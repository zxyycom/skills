import type {
  StateIndex,
  StateIndexEntry
} from "../../index-runtime/src/index.ts";

export const decisionRelationTypes = [
  "修订",
  "替代",
  "判定无效",
  "归并",
  "拆分"
] as const;

export type DecisionRelationType = typeof decisionRelationTypes[number];

export type DecisionTraceDirection = "both" | "predecessors" | "successors";

export const decisionStatuses = ["candidate", "active", "archived"] as const;

export type DecisionStatus = typeof decisionStatuses[number];

export const establishedDecisionStatuses = ["active", "archived"] as const;

export type EstablishedDecisionStatus =
  typeof establishedDecisionStatuses[number];
export type DecisionListStatus = EstablishedDecisionStatus | "all";

export const decisionAlignments = ["aligned", "unaligned"] as const;

export type DecisionAlignment = typeof decisionAlignments[number];
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

export type DecisionSource = Readonly<{
  decisionId: DecisionId;
  sourcePath: string;
  text: string;
}>;

export type DecisionIndexEntry = StateIndexEntry<DecisionIndexState>;

export type DecisionIndexMetadata = Record<string, never>;

export type DecisionIndex = Omit<
  StateIndex<DecisionIndexState, DecisionIndexMetadata>,
  "definitionVersion" | "namespace"
> & {
  definitionVersion: 6;
  namespace: "decisions";
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

type DecisionRecordWithSource<
  Kind extends DecisionRecordSource["kind"]
> = Omit<DecisionRecord, "source"> & {
  source: Extract<DecisionRecordSource, { kind: Kind }>;
};

export type DecisionCandidateRecord = DecisionRecordWithSource<"candidate">;
export type EstablishedDecisionRecord = DecisionRecordWithSource<"established">;

export function isDecisionCandidateRecord(
  record: DecisionRecord
): record is DecisionCandidateRecord {
  return record.source.kind === "candidate";
}

export function isEstablishedDecisionRecord(
  record: DecisionRecord
): record is EstablishedDecisionRecord {
  return record.source.kind === "established";
}

export function compareDecisionRecords(
  left: Pick<DecisionRecord, "sourcePath">,
  right: Pick<DecisionRecord, "sourcePath">
): number {
  return left.sourcePath.localeCompare(right.sourcePath);
}

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

export type MarkdownSection = {
  content: string;
  heading: string;
  index: number;
};

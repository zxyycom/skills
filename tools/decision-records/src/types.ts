import type {
  StateIndex,
  StateIndexEntry
} from "../../index-runtime/src/index.ts";
import {
  isDecisionId,
  isDecisionSourcePath
} from "./decision-path.ts";

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

declare const decisionIdBrand: unique symbol;
declare const decisionSourcePathBrand: unique symbol;
declare const decisionTagBrand: unique symbol;

/** A validated stable Markdown basename such as `use-stable-ids.md`. */
export type DecisionId = string & {
  readonly [decisionIdBrand]: "DecisionId";
};

/** A validated root or archive path for one decision Markdown source. */
export type DecisionSourcePath = string & {
  readonly [decisionSourcePathBrand]: "DecisionSourcePath";
};

/** A validated kebab-case decision tag. */
export type DecisionTag = string & {
  readonly [decisionTagBrand]: "DecisionTag";
};

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
  tags: DecisionTag[];
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
  sourcePath: DecisionSourcePath;
};

export type DecisionSource = Readonly<{
  decisionId: DecisionId;
  sourcePath: DecisionSourcePath;
  text: string;
}>;

/** Raw in-memory source input that must be validated before domain use. */
export type DecisionSourceInput = Readonly<{
  decisionId: string;
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
  createdAt: string | null;
  /** Raw basename for invalid sources; validated on candidate/established records. */
  decisionId: string;
  decisionPath: string;
  document: DecisionDocument | null;
  markdownExists: boolean;
  projection: DecisionProjection;
  relationshipErrors: string[];
  source: DecisionRecordSource;
  sourcePath: string;
  status: DecisionStatus | null;
  tags: DecisionTag[];
};

type DecisionRecordWithSource<
  Kind extends DecisionRecordSource["kind"]
> = Omit<DecisionRecord, "source"> & {
  decisionId: DecisionId;
  sourcePath: DecisionSourcePath;
  source: Extract<DecisionRecordSource, { kind: Kind }>;
};

export type DecisionCandidateRecord = DecisionRecordWithSource<"candidate">;
export type EstablishedDecisionRecord = DecisionRecordWithSource<"established">;

export function isActivationCandidateRecord(
  record: DecisionRecord
): record is DecisionCandidateRecord {
  return record.activationCandidate && isDecisionCandidateRecord(record);
}

export function isDecisionCandidateRecord(
  record: DecisionRecord
): record is DecisionCandidateRecord {
  return record.source.kind === "candidate"
    && isDecisionId(record.decisionId)
    && isDecisionSourcePath(record.sourcePath);
}

export function isEstablishedDecisionRecord(
  record: DecisionRecord
): record is EstablishedDecisionRecord {
  return record.source.kind === "established"
    && isDecisionId(record.decisionId)
    && isDecisionSourcePath(record.sourcePath);
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

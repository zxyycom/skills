import type {
  StateIndex,
  StateIndexEntry
} from "../../index-runtime/src/index.ts";
import type { DecisionDomainDefinition } from "./decision-domain-catalog.ts";

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

export type DecisionRelation = {
  type: DecisionRelationType;
  target: string;
};

export type DecisionSuccessor = {
  alignment: DecisionAlignment;
  recordPath: string;
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

export type DecisionSource = Readonly<{
  path: string;
  text: string;
}>;

export type DecisionIndexEntry = StateIndexEntry<DecisionIndexState>;

export type DecisionIndexMetadata = {
  domains: DecisionDomainDefinition[];
};

export type DecisionIndex = Omit<
  StateIndex<DecisionIndexState, DecisionIndexMetadata>,
  "definitionVersion" | "namespace"
> & {
  definitionVersion: 5;
  namespace: "decisions";
};

export type DecisionRecord = {
  /** Whether the source is a complete candidate eligible for activation. */
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

export function compareDecisionRecords(
  left: Pick<DecisionRecord, "relativePath">,
  right: Pick<DecisionRecord, "relativePath">
): number {
  return left.relativePath.localeCompare(right.relativePath);
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
  /** Validated domain catalog definitions from the same source scan. */
  domainDefinitions: DecisionDomainDefinition[];
  domainErrors: string[];
  domainIds: Set<string>;
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
  domainCount: number;
  errors: string[];
  scan: DecisionScan;
  unalignedCount: number;
};

export type MarkdownSection = {
  content: string;
  heading: string;
  index: number;
};

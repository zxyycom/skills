import type {
  FileTextSearchMode,
  FileTextSearchPreview,
  FileTextSearchTruncation
} from "../../shared/src/file-text-search/index.ts";
import type { DecisionApplicationFailure } from "./application-result.ts";
import type { DecisionLocation } from "./decision-query-context.ts";
import type { DecisionRelationEdge } from "./relation-graph.ts";
import type {
  DecisionAlignment,
  DecisionId,
  DecisionIndexEntry,
  DecisionListAlignment,
  DecisionListFacets,
  DecisionListStatus,
  DecisionProjection,
  DecisionRelationType,
  DecisionSourcePath,
  DecisionTag,
  DecisionTraceDirection,
  DecisionValidationResult,
  EstablishedDecisionStatus
} from "./types.ts";

export type { DecisionLocation } from "./decision-query-context.ts";

export type DecisionListAppliedFilters = Readonly<{
  alignment: DecisionListAlignment;
  createdAtFrom?: string;
  createdAtTo?: string;
  direction?: DecisionTraceDirection;
  relatedTo?: string;
  relationType?: DecisionRelationType;
  status: DecisionListStatus;
  tags: readonly DecisionTag[];
}>;

export type DecisionQueryRequest =
  | { command: "candidates" | "check"; location: DecisionLocation }
  | {
      alignment: DecisionListAlignment;
      command: "list";
      createdAtFrom?: string;
      createdAtTo?: string;
      direction?: DecisionTraceDirection;
      limit: number;
      location: DecisionLocation;
      offset: number;
      relatedTo?: string;
      relationType?: DecisionRelationType;
      status: DecisionListStatus;
      tags: readonly DecisionTag[];
    }
  | {
      alignment: DecisionListAlignment;
      command: "search";
      direction?: DecisionTraceDirection;
      in?: "content" | "metadata";
      location: DecisionLocation;
      match: FileTextSearchMode;
      relatedTo?: string;
      relationType?: DecisionRelationType;
      status: DecisionListStatus;
      tags: readonly DecisionTag[];
      text: string;
    }
  | {
      command: "show-candidate";
      decisionId: string;
      location: DecisionLocation;
    }
  | { command: "show"; decisionId: string; location: DecisionLocation }
  | {
      command: "sync-index";
      location: DecisionLocation;
      selectors?: readonly string[];
      write: boolean;
    }
  | {
      command: "trace";
      decisionId: string;
      direction: DecisionTraceDirection;
      location: DecisionLocation;
      maxDepth: number | null;
    };

type QuerySuccessBase = { status: "ok"; warnings: string[] };

export type IndexedDecisionRecord = {
  alignment: DecisionAlignment;
  createdAt: string;
  decisionId: DecisionId;
  projection: DecisionProjection;
  sourcePath: DecisionSourcePath;
  status: EstablishedDecisionStatus;
  tags: DecisionTag[];
};

export type CandidateDecisionRecord = {
  alignment: null;
  bodyReady: boolean;
  createdAt: null;
  decisionId: DecisionId;
  projection: DecisionProjection;
  sourcePath: DecisionSourcePath;
  scaffoldValid: true;
  status: "candidate";
  tags: DecisionTag[];
};

export type DecisionContentSearchRecord = IndexedDecisionRecord & {
  previews: readonly FileTextSearchPreview[];
};

export const decisionMetadataSearchFields = [
  "id",
  "name",
  "title",
  "purpose",
  "background",
  "decision",
  "tags"
] as const;
export type DecisionMetadataSearchField =
  (typeof decisionMetadataSearchFields)[number];
export type DecisionMetadataMatchedRelation = Readonly<{
  summary: string;
  target: DecisionId;
  type: DecisionRelationEdge["type"];
}>;
export type DecisionMetadataSearchRecord = IndexedDecisionRecord & {
  matchedFields: readonly DecisionMetadataSearchField[];
  matchedRelations: readonly DecisionMetadataMatchedRelation[];
};

export type DecisionSearchSnapshot = {
  entries: readonly IndexedDecisionRecord[];
  sourcePathToRecord: ReadonlyMap<DecisionSourcePath, IndexedDecisionRecord>;
  warnings: string[];
};

export type DecisionQuerySuccess =
  | (QuerySuccessBase & {
      command: "candidates";
      records: CandidateDecisionRecord[];
    })
  | (QuerySuccessBase & {
      command: "check";
      summary: Pick<
        DecisionValidationResult,
        | "activeCount"
        | "activationCandidateCount"
        | "bodyReadyCandidateCount"
        | "alignedCount"
        | "archivedCount"
        | "decisionCount"
        | "scaffoldCandidateCount"
        | "unalignedCount"
      >;
    })
  | (QuerySuccessBase & {
      appliedFilters: DecisionListAppliedFilters;
      command: "list";
      facets: DecisionListFacets;
      limit: number;
      offset: number;
      records: IndexedDecisionRecord[];
      total: number;
    })
  | (QuerySuccessBase & {
      command: "search";
      in: "content";
      records: DecisionContentSearchRecord[];
      truncation: FileTextSearchTruncation;
    })
  | (QuerySuccessBase & {
      command: "search";
      in: "metadata";
      records: DecisionMetadataSearchRecord[];
    })
  | (QuerySuccessBase & {
      body: string;
      command: "show-candidate";
      record: CandidateDecisionRecord;
    })
  | (QuerySuccessBase & {
      body: string;
      command: "show";
      record: IndexedDecisionRecord;
    })
  | (QuerySuccessBase & {
      changedIds: string[];
      command: "sync-index";
      indexRelativePath: string;
      scope: "all" | "selected";
      selectedIds: string[];
      selectors: string[];
      state: "current" | "unchanged" | "written";
      unactivatedPaths: string[];
    })
  | (QuerySuccessBase & {
      command: "trace";
      edges: DecisionRelationEdge[];
      records: IndexedDecisionRecord[];
    });

export type DecisionQueryResult =
  | DecisionApplicationFailure
  | DecisionQuerySuccess;
export type IndexedDecisionState = Pick<DecisionIndexEntry, "state"> & {
  id: string;
};

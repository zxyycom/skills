import type {
  DecisionAlignment,
  DecisionId,
  DecisionListAlignment,
  DecisionListStatus,
  DecisionRelation,
  DecisionRelationSummary,
  DecisionRelationType,
  DecisionSuccessor,
  DecisionTag,
  DecisionTraceDirection
} from "./types.ts";

export type ParsedOptions = {
  alignment?: DecisionListAlignment;
  background?: string;
  clearRelations?: boolean;
  createdFrom?: string;
  createdTo?: string;
  detail?: boolean;
  discard?: DecisionId;
  deleteRecordedDecision?: boolean;
  decisionsDir?: string;
  depth?: number;
  decision?: string;
  direction?: DecisionTraceDirection;
  fullTime?: boolean;
  in?: "content" | "metadata";
  keepUnrecordedHistory?: boolean;
  preflight?: boolean;
  renameRecordedDecision?: boolean;
  preflightAlignment?: DecisionAlignment;
  match?: "all" | "any" | "phrase";
  limit?: number;
  offset?: number;
  purpose?: string;
  relation?: DecisionRelation[];
  relatedTo?: string;
  relationType?: DecisionRelationType;
  relationSummary?: DecisionRelationSummary[];
  root?: string;
  status?: DecisionListStatus;
  successor?: DecisionSuccessor[];
  select?: string[];
  tag?: DecisionTag[];
  title?: string;
  write?: boolean;
};

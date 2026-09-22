import type { DecisionStageScope } from "./decision-stage-contracts.ts";
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
  deleteRecorded?: boolean;
  decisionsDir?: string;
  depth?: number | "all";
  decision?: string;
  direction?: DecisionTraceDirection;
  fullTime?: boolean;
  in?: "content" | "metadata";
  json?: boolean;
  keepUnrecordedHistory?: boolean;
  preflight?: boolean;
  renameRecordedDecision?: boolean;
  preflightAlignment?: DecisionAlignment;
  match?: "all" | "any" | "phrase";
  maxRecords?: number;
  limit?: number;
  offset?: number;
  purpose?: string;
  relation?: DecisionRelation[];
  relatedTo?: string;
  relationType?: DecisionRelationType;
  relationSummary?: DecisionRelationSummary[];
  root?: string;
  status?: DecisionListStatus;
  scope?: DecisionStageScope;
  successor?: DecisionSuccessor[];
  select?: string[];
  tag?: DecisionTag[];
  title?: string;
};

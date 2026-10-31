/*
 * Synced TypeScript runtime; repository maintenance edits tools/decision-records/src/cli/arguments/cli-command-options.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/decision-records/src/cli/arguments/cli-command-options.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/decision-records/src/cli/arguments/cli-command-options.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
import type { DecisionStageScope } from "../../staging/decision-stage-contracts.ts";
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
} from "../../types.ts";

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

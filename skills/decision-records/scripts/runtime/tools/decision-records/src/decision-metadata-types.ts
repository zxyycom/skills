/*
 * Synced TypeScript runtime; repository maintenance edits tools/decision-records/src/decision-metadata-types.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/decision-records/src/decision-metadata-types.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/decision-records/src/decision-metadata-types.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
import type {
  DecisionId,
  DecisionMetadata,
  DecisionProjection,
  DecisionTag
} from "./types.ts";

export type DecisionSourceMetadata =
  | DecisionMetadata
  | {
      status: "candidate";
      alignment: null;
      createdAt: null;
    };

export type ParsedDecisionMarkdown = {
  body: string;
  id: DecisionId;
  metadata: DecisionSourceMetadata;
  projection: DecisionProjection;
  tags: DecisionTag[];
};

export type ParsedDecisionFields = Omit<ParsedDecisionMarkdown, "body">;

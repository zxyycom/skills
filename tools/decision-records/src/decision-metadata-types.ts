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

import {
  decisionFailure,
  type DecisionApplicationFailure
} from "./application-result.ts";
import { serializeDecisionFrontmatter } from "./decision-metadata.ts";
import { sourcePathForDecision } from "./decision-path.ts";
import type { DecisionFileChange } from "./decision-transaction.ts";
import type { EstablishedDecisionRecord } from "./types.ts";

export type PreparedDecisionChange =
  | DecisionApplicationFailure
  | {
      change: DecisionFileChange;
      status: "ok";
    };

export function prepareArchivedDecisionChange(
  record: EstablishedDecisionRecord
): PreparedDecisionChange {
  const source = record.source;
  if (source.document.alignment === null) {
    return decisionFailure(
      ["Active decision alignment is unavailable: " + record.sourcePath],
      { presentation: "plain" }
    );
  }
  const nextText =
    serializeDecisionFrontmatter(source.document, source.document.tags, {
      alignment: source.document.alignment,
      createdAt: source.document.createdAt,
      status: "archived"
    }) + source.body;
  return {
    change: {
      decisionPath: record.decisionPath,
      expectedText: source.text,
      nextText,
      targetPath: record.decisionPath.replace(
        /[^/\\]+$/u,
        sourcePathForDecision(record.decisionId, "archived")
      )
    },
    status: "ok"
  };
}

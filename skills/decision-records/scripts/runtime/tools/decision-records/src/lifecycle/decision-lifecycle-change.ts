/*
 * Synced TypeScript runtime; repository maintenance edits tools/decision-records/src/lifecycle/decision-lifecycle-change.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/decision-records/src/lifecycle/decision-lifecycle-change.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/decision-records/src/lifecycle/decision-lifecycle-change.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
import {
  decisionDiagnostic,
  decisionFailure,
  type DecisionApplicationFailure
} from "../application-result.ts";
import { serializeDecisionFrontmatter } from "../records/decision-metadata.ts";
import { sourcePathForDecisionStatus } from "../collection/decision-path.ts";
import type { DecisionFileChange } from "../transactions/decision-transaction.ts";
import type { EstablishedDecisionRecord } from "../types.ts";

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
      [
        decisionDiagnostic({
          code: "decision-records.lifecycle-invalid",
          reason:
            "Active decision alignment is unavailable: " + record.sourcePath,
          recovery:
            "Restore a valid active decision alignment before retrying the lifecycle command.",
          target: record.sourcePath
        })
      ],
      { presentation: "plain" }
    );
  }
  const nextText =
    serializeDecisionFrontmatter(
      record.decisionId,
      source.document,
      source.document.tags,
      {
        alignment: source.document.alignment,
        createdAt: source.document.createdAt,
        status: "archived"
      }
    ) + source.body;
  return {
    change: {
      decisionPath: record.decisionPath,
      expectedText: source.text,
      nextText,
      targetPath: pathFromSourcePath(
        record.decisionPath,
        record.sourcePath,
        sourcePathForDecisionStatus(record.sourcePath, "archived")
      )
    },
    status: "ok"
  };
}

function pathFromSourcePath(
  decisionPath: string,
  sourcePath: string,
  nextSourcePath: string | null
): string {
  if (nextSourcePath === null) {
    throw new Error("cannot archive an invalid Decision source path");
  }
  const root = sourcePath.startsWith("archive/")
    ? path.dirname(path.dirname(decisionPath))
    : path.dirname(decisionPath);
  return path.join(root, ...nextSourcePath.split("/"));
}
import path from "node:path";

/*
 * Synced TypeScript runtime; repository maintenance edits tools/decision-records/src/cli/output/cli-output-relation-evidence.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/decision-records/src/cli/output/cli-output-relation-evidence.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/decision-records/src/cli/output/cli-output-relation-evidence.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
import type { DecisionRelationFilterContext } from "../../query/decision-query-contract.ts";
import type { DecisionRecordsCliIo } from "../cli-io.ts";
import { writeCliLine } from "./cli-output-writer.ts";

const relationPreviewLimit = 3;

export function printRelationFilterEvidence(
  record: DecisionRelationFilterContext,
  detail: boolean,
  indent: string,
  io: DecisionRecordsCliIo
): void {
  const relations = record.filterRelations;
  if (relations === undefined) return;
  writeCliLine(io.stdout, indent + "relation-filter evidence:");
  const displayed = relations.slice(
    0,
    detail ? relations.length : relationPreviewLimit
  );
  displayed.forEach((relation) =>
    writeCliLine(io.stdout, indent + "  - " + filterRelationText(relation))
  );
  const omitted = relations.length - displayed.length;
  if (omitted > 0)
    writeCliLine(io.stdout, indent + `  +${omitted} more matching relations`);
}

export function filterRelationText(
  relation: NonNullable<
    DecisionRelationFilterContext["filterRelations"]
  >[number]
): string {
  return (
    relation.sourceId +
    " --" +
    relation.type +
    "--> " +
    relation.target +
    ": " +
    relationSummaryText(relation.summary)
  );
}

export function relationSummaryText(summary: string | undefined): string {
  return summary === undefined ? "[无摘要]" : JSON.stringify(summary);
}

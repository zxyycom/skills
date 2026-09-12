import type { DecisionRelationFilterContext } from "./decision-query-contract.ts";
import type { DecisionRecordsCliIo } from "./cli-io.ts";
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

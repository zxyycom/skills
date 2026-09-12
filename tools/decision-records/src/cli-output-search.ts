import type { DecisionQuerySuccess } from "./decision-query-service.ts";
import type { DecisionRecordsCliIo } from "./cli-io.ts";
import { writeCliLine } from "./cli-output-writer.ts";
import { printRelationFilterEvidence } from "./cli-output-relation-evidence.ts";

export function printSearch(
  result: Extract<DecisionQuerySuccess, { command: "search" }>,
  io: DecisionRecordsCliIo
): void {
  writeCliLine(io.stdout, "Decision search results:");
  if (result.records.length === 0) {
    writeCliLine(io.stdout, "- none");
    return;
  }
  for (const record of result.records) {
    printSearchRecord(record, io);
  }
}

function printSearchRecord(
  record: Extract<
    DecisionQuerySuccess,
    { command: "search" }
  >["records"][number],
  io: DecisionRecordsCliIo
): void {
  writeCliLine(
    io.stdout,
    `- ${record.status} ${record.alignment} ${record.createdAt.slice(0, 10)} ${record.decisionId}`
  );
  writeCliLine(io.stdout, "  sourcePath: " + record.sourcePath);
  writeCliLine(io.stdout, "  tags: " + record.tags.join(", "));
  writeCliLine(io.stdout, "  title: " + record.projection.title);
  writeCliLine(io.stdout, "  purpose: " + record.projection.purpose);
  printRelationFilterEvidence(record, false, "  ", io);
  if ("matchedFields" in record) {
    printMetadataSearchMatch(record, io);
    return;
  }
  printContentSearchPreviews(record.previews, io);
}

function printMetadataSearchMatch(
  record: Extract<
    Extract<DecisionQuerySuccess, { command: "search" }>["records"][number],
    { matchedFields: readonly string[] }
  >,
  io: DecisionRecordsCliIo
): void {
  writeCliLine(
    io.stdout,
    "  matchedFields: " + record.matchedFields.join(", ")
  );
  writeCliLine(io.stdout, "  matchedRelations:");
  if (record.matchedRelations.length === 0) {
    writeCliLine(io.stdout, "    - none");
    return;
  }
  for (const relation of record.matchedRelations) {
    writeCliLine(
      io.stdout,
      `    - ${relation.type} ${relation.target}: ${relation.summary}`
    );
  }
}

function printContentSearchPreviews(
  previews: Extract<
    Extract<DecisionQuerySuccess, { command: "search" }>["records"][number],
    { previews: readonly unknown[] }
  >["previews"],
  io: DecisionRecordsCliIo
): void {
  writeCliLine(io.stdout, "  previews:");
  for (const preview of previews) {
    writeCliLine(
      io.stdout,
      `    ${preview.line}${preview.column === null ? ":" : ":" + preview.column + ":"} ${preview.preview}`
    );
  }
}

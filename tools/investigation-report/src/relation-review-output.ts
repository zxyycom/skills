import { writeLine } from "./cli-io.ts";
import type { InvestigationReportCliIo } from "./cli-contract.ts";
import type {
  InvestigationRelation,
  InvestigationRelationReview
} from "./types.ts";

/** Renders a completed relation review while preserving each edge's source. */
export function printInvestigationRelationReview(
  review: InvestigationRelationReview,
  io: InvestigationReportCliIo
): void {
  writeLine(io.stdout, `relation review (${review.phase}):`);
  for (const source of review.sources) {
    writeLine(io.stdout, `  ${source.sourceId}: ${source.action}`);
    printRelationList("before", source.sourceId, source.before, io);
    printRelationList("after", source.sourceId, source.after, io);
    printRelationChanges(source.sourceId, source.before, source.after, io);
  }
}

function printRelationList(
  label: "before" | "after",
  sourceId: string,
  relations: readonly InvestigationRelation[],
  io: InvestigationReportCliIo
): void {
  if (relations.length === 0) {
    writeLine(io.stdout, `    ${label}: []`);
    return;
  }
  writeLine(io.stdout, `    ${label}:`);
  for (const relation of relations)
    writeLine(io.stdout, `      - ${relationEdge(sourceId, relation)}`);
}

function printRelationChanges(
  sourceId: string,
  before: readonly InvestigationRelation[],
  after: readonly InvestigationRelation[],
  io: InvestigationReportCliIo
): void {
  const beforeByEdge = new Map(
    before.map((relation) => [edgeKey(relation), relation])
  );
  const afterByEdge = new Map(
    after.map((relation) => [edgeKey(relation), relation])
  );
  for (const [key, relation] of beforeByEdge)
    if (!afterByEdge.has(key))
      writeLine(io.stdout, `    removed: ${relationEdge(sourceId, relation)}`);
  for (const [key, relation] of afterByEdge) {
    const prior = beforeByEdge.get(key);
    if (prior === undefined)
      writeLine(io.stdout, `    added: ${relationEdge(sourceId, relation)}`);
    else if (prior.summary !== relation.summary)
      writeLine(
        io.stdout,
        `    summary changed: ${relationEdge(sourceId, prior)} -> ${relationEdge(sourceId, relation)}`
      );
  }
}

function relationEdge(
  sourceId: string,
  relation: InvestigationRelation
): string {
  return `${sourceId} --${relation.type}--> ${relation.target} ${relation.summary === undefined ? "[无摘要]" : JSON.stringify(relation.summary)}`;
}

function edgeKey(relation: InvestigationRelation): string {
  return `${relation.type}\u0000${relation.target}`;
}

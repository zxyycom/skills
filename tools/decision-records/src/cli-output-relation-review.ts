import type { DecisionRelation } from "./types.ts";
import type { DecisionRelationReview } from "./decision-relation-transaction-types.ts";
import type { DecisionRecordsCliIo } from "./cli-io.ts";
import { relationSummaryText } from "./cli-output-relation-evidence.ts";
import { writeCliLine } from "./cli-output-writer.ts";

type RelationChange = Readonly<{
  after?: DecisionRelation;
  before?: DecisionRelation;
  kind: "added" | "removed" | "summary-changed";
}>;

export function printDecisionRelationReview(
  review: DecisionRelationReview,
  io: DecisionRecordsCliIo
): void {
  writeCliLine(io.stdout, `Relation review (${review.phase}):`);
  review.sources.forEach((source) => {
    writeCliLine(io.stdout, `- ${source.sourceId} action=${source.action}`);
    printRelations("before", source.sourceId, source.before, io);
    printRelations("after", source.sourceId, source.after, io);
    printChanges(source.sourceId, source.before, source.after, io);
  });
}

function printRelations(
  label: "before" | "after",
  sourceId: string,
  relations: readonly DecisionRelation[],
  io: DecisionRecordsCliIo
): void {
  if (relations.length === 0) {
    writeCliLine(io.stdout, `  ${label} relations: []`);
    return;
  }
  writeCliLine(io.stdout, `  ${label} relations:`);
  relations.forEach((relation) =>
    writeCliLine(io.stdout, "    - " + relationText(sourceId, relation))
  );
}

function printChanges(
  sourceId: string,
  before: readonly DecisionRelation[],
  after: readonly DecisionRelation[],
  io: DecisionRecordsCliIo
): void {
  const changes = relationChanges(before, after);
  if (changes.length === 0) {
    writeCliLine(io.stdout, "  changes: unchanged");
    return;
  }
  writeCliLine(io.stdout, "  changes:");
  changes.forEach((change) =>
    writeCliLine(io.stdout, "    - " + changeText(sourceId, change))
  );
}

function relationChanges(
  before: readonly DecisionRelation[],
  after: readonly DecisionRelation[]
): readonly RelationChange[] {
  const beforeByKey = relationMap(before);
  const afterByKey = relationMap(after);
  return [...new Set([...beforeByKey.keys(), ...afterByKey.keys()])]
    .sort()
    .flatMap((key) =>
      relationChange(beforeByKey.get(key), afterByKey.get(key))
    );
}

function relationMap(
  relations: readonly DecisionRelation[]
): ReadonlyMap<string, DecisionRelation> {
  return new Map(
    relations.map((relation) => [relationKey(relation), relation])
  );
}

function relationKey(relation: DecisionRelation): string {
  return relation.type + "\u0000" + relation.target;
}

function relationChange(
  before: DecisionRelation | undefined,
  after: DecisionRelation | undefined
): readonly RelationChange[] {
  if (before === undefined && after !== undefined)
    return [{ after, kind: "added" }];
  if (before !== undefined && after === undefined)
    return [{ before, kind: "removed" }];
  if (
    before !== undefined &&
    after !== undefined &&
    before.summary !== after.summary
  )
    return [{ after, before, kind: "summary-changed" }];
  return [];
}

function changeText(sourceId: string, change: RelationChange): string {
  if (change.kind === "added")
    return "added " + relationText(sourceId, change.after!);
  if (change.kind === "removed")
    return "removed " + relationText(sourceId, change.before!);
  return (
    "summary changed " +
    relationIdentity(sourceId, change.after!) +
    ": " +
    relationSummaryText(change.before!.summary) +
    " -> " +
    relationSummaryText(change.after!.summary)
  );
}

function relationText(sourceId: string, relation: DecisionRelation): string {
  return (
    relationIdentity(sourceId, relation) +
    ": " +
    relationSummaryText(relation.summary)
  );
}

function relationIdentity(
  sourceId: string,
  relation: DecisionRelation
): string {
  return `${sourceId} --${relation.type}--> ${relation.target}`;
}

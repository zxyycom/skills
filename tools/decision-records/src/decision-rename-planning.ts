import path from "node:path";
import {
  decisionDiagnostic,
  decisionFailure,
  type DecisionApplicationFailure
} from "./application-result.ts";
import { resolveRenameTarget } from "./decision-rename-target.ts";
export { renameFailure } from "./decision-rename-failure.ts";
import { serializeDecisionFrontmatter } from "./decision-metadata.ts";
import { decisionNameFromId, parseDatedDecisionId } from "./decision-path.ts";
import {
  compareDecisionRecords,
  isDecisionCandidateRecord,
  isEstablishedDecisionRecord,
  type DecisionCandidateRecord,
  type DecisionId,
  type DecisionRecord,
  type DecisionScan,
  type DecisionSourcePath,
  type EstablishedDecisionRecord
} from "./types.ts";
import type { DecisionFileChange } from "./decision-transaction.ts";
import type {
  DecisionRenameOptions,
  DecisionRenamePlan
} from "./decision-rename.ts";

export type RenameableDecisionRecord =
  | DecisionCandidateRecord
  | EstablishedDecisionRecord;
export type PreparedDecisionRename = Readonly<{
  changes: readonly DecisionFileChange[];
  plan: DecisionRenamePlan;
  source: RenameableDecisionRecord;
}>;
export type RenameTarget = Readonly<{
  decisionId: DecisionId;
  name: string;
  sourcePath: DecisionSourcePath;
}>;

export type PreparedRenameStep =
  | DecisionApplicationFailure
  | Readonly<{ status: "ready"; value: PreparedDecisionRename }>;

const decisionRenameScope =
  "Decision Markdown files and derived decision index";

export function prepareDecisionRename(
  scan: DecisionScan,
  options: DecisionRenameOptions
): PreparedRenameStep {
  const source = resolveRenameSource(scan, options.source);
  if (source.status !== "ok") return source;
  const target = resolveRenameTarget(
    source.record,
    scan.records,
    options.target
  );
  if (target.status !== "ok") return target;
  const relations = rewrittenDecisionChanges(
    scan.records,
    source.record,
    target.value
  );
  const sourceChange = relations.find(
    (change) => change.decisionPath === source.record.decisionPath
  );
  if (sourceChange === undefined) {
    throw new Error("Decision rename did not prepare its selected source");
  }
  const candidateRelations = scan.records
    .filter(isDecisionCandidateRecord)
    .flatMap((record) => record.source.document.relations)
    .filter((relation) => relation.target === source.record.decisionId).length;
  const establishedRelations = scan.records
    .filter(isEstablishedDecisionRecord)
    .flatMap((record) => record.source.document.relations)
    .filter((relation) => relation.target === source.record.decisionId).length;
  return {
    status: "ready",
    value: {
      changes: relations,
      plan: {
        affectedCandidateRelationCount: candidateRelations,
        affectedEstablishedRelationCount: establishedRelations,
        newId: target.value.decisionId,
        newName: target.value.name,
        newSourcePath: target.value.sourcePath,
        oldId: source.record.decisionId,
        oldName: decisionNameFromId(source.record.decisionId),
        oldSourcePath: source.record.sourcePath,
        outcome: "ready"
      },
      source: source.record
    }
  };
}

function resolveRenameSource(
  scan: DecisionScan,
  rawSource: string
):
  | Readonly<{ record: RenameableDecisionRecord; status: "ok" }>
  | DecisionApplicationFailure {
  const normalized = rawSource.replace(/\.md$/iu, "");
  const dated = parseDatedDecisionId(normalized);
  const records = scan.records.filter(
    (record): record is RenameableDecisionRecord =>
      isDecisionCandidateRecord(record) || isEstablishedDecisionRecord(record)
  );
  const matches =
    dated === null
      ? records.filter(
          (record) => decisionNameFromId(record.decisionId) === normalized
        )
      : records.filter((record) => record.decisionId === dated.id);
  if (matches.length === 1) return { record: matches[0]!, status: "ok" };
  const reason =
    matches.length === 0
      ? "Decision rename source does not exist: " + normalized
      : "Decision rename source is ambiguous: " +
        normalized +
        "; choose one standard ID: " +
        matches
          .map((record) => record.decisionId)
          .sort()
          .join(", ");
  return decisionFailure([
    decisionDiagnostic({
      code:
        matches.length === 0
          ? "decision-records.rename-source-not-found"
          : "decision-records.rename-source-ambiguous",
      outcome: "no-change",
      reason,
      recovery:
        matches.length === 0
          ? "Choose an existing standard Decision ID or unique name."
          : "Retry with one listed calendar-valid YYMMDD-name Decision ID.",
      scope: decisionRenameScope,
      target: normalized
    })
  ]);
}

function rewrittenDecisionChanges(
  records: readonly DecisionRecord[],
  source: RenameableDecisionRecord,
  target: RenameTarget
): DecisionFileChange[] {
  const changes: DecisionFileChange[] = [];
  for (const record of [...records].sort(compareDecisionRecords)) {
    const change = rewrittenDecisionChange(record, source, target);
    if (change !== null) changes.push(change);
  }
  return changes;
}

function rewrittenDecisionChange(
  record: DecisionRecord,
  source: RenameableDecisionRecord,
  target: RenameTarget
): DecisionFileChange | null {
  if (!isRenameableDecisionRecord(record)) return null;
  const isSource = record.decisionPath === source.decisionPath;
  const relations = rewrittenRelations(record, source, target);
  if (
    !isSource &&
    sameRelationTargets(relations, record.source.document.relations)
  )
    return null;
  const decisionId = isSource ? target.decisionId : record.decisionId;
  const nextText =
    serializeDecisionFrontmatter(
      decisionId,
      { ...record.source.document, relations },
      record.source.document.tags,
      record.source.document
    ) + record.source.body;
  const targetPath = rewrittenSourceTargetPath(record, target, isSource);
  return targetPath === undefined
    ? {
        decisionPath: record.decisionPath,
        expectedText: record.source.text,
        nextText
      }
    : {
        decisionPath: record.decisionPath,
        expectedText: record.source.text,
        nextText,
        targetPath
      };
}

function isRenameableDecisionRecord(
  record: DecisionRecord
): record is RenameableDecisionRecord {
  return (
    isDecisionCandidateRecord(record) || isEstablishedDecisionRecord(record)
  );
}

function rewrittenRelations(
  record: RenameableDecisionRecord,
  source: RenameableDecisionRecord,
  target: RenameTarget
) {
  return record.source.document.relations.map((relation) => ({
    ...relation,
    target:
      relation.target === source.decisionId
        ? target.decisionId
        : relation.target
  }));
}

function sameRelationTargets(
  left: readonly { target: DecisionId }[],
  right: readonly { target: DecisionId }[]
): boolean {
  return left.every(
    (relation, index) => relation.target === right[index]?.target
  );
}

function rewrittenSourceTargetPath(
  record: RenameableDecisionRecord,
  target: RenameTarget,
  isSource: boolean
): string | undefined {
  if (!isSource || target.sourcePath === record.sourcePath) return undefined;
  const decisionsDirectory = record.sourcePath.startsWith("archive/")
    ? path.dirname(path.dirname(record.decisionPath))
    : path.dirname(record.decisionPath);
  return path.join(decisionsDirectory, ...target.sourcePath.split("/"));
}

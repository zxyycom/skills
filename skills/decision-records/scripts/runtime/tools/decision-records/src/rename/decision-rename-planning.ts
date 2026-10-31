/*
 * Synced TypeScript runtime; repository maintenance edits tools/decision-records/src/rename/decision-rename-planning.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/decision-records/src/rename/decision-rename-planning.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/decision-records/src/rename/decision-rename-planning.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
import path from "node:path";
import {
  decisionDiagnostic,
  decisionFailure,
  type DecisionApplicationFailure
} from "../application-result.ts";
import { resolveRenameTarget } from "./decision-rename-target.ts";
export { renameFailure } from "./decision-rename-failure.ts";
import { serializeDecisionFrontmatter } from "../records/decision-metadata.ts";
import {
  decisionNameFromId,
  parseDatedDecisionId
} from "../collection/decision-path.ts";
import {
  compareDecisionRecords,
  isDecisionCandidateRecord,
  isEstablishedDecisionRecord,
  type DecisionCandidateRecord,
  type DecisionId,
  type DecisionRecord,
  type DecisionPreparationContext,
  type DecisionSourcePath,
  type EstablishedDecisionRecord
} from "../types.ts";
import type { DecisionFileChange } from "../transactions/decision-transaction.ts";
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
  scan: DecisionPreparationContext,
  options: DecisionRenameOptions
): PreparedRenameStep {
  const source = resolveRenameSource(scan, options.source);
  if (source.status !== "ok") {
    return source;
  }
  const target = resolveRenameTarget(
    source.record,
    scan.records,
    options.target,
    scan.sourceMembers
  );
  if (target.status !== "ok") {
    return target;
  }
  if (
    target.value.decisionId !== source.record.decisionId &&
    scan.publishedBaseline?.entries[target.value.decisionId] !== undefined
  )
    return decisionFailure([
      "Target Decision ID already exists: " + target.value.decisionId
    ]);
  const unchanged =
    source.record.decisionId === target.value.decisionId &&
    source.record.sourcePath === target.value.sourcePath;
  const relations = unchanged
    ? []
    : rewrittenDecisionChanges(scan.records, source.record, target.value);
  const sourceChange = relations.find(
    (change) => change.decisionPath === source.record.decisionPath
  );
  if (!unchanged && sourceChange === undefined) {
    throw new Error("Decision rename did not prepare its selected source");
  }
  return {
    status: "ready",
    value: {
      changes: relations,
      plan: decisionRenamePlan(scan.records, source.record, target.value),
      source: source.record
    }
  };
}

/** 从被更正身份的入边独立生成 review 计数，不重新解析或读取来源。 */
function decisionRenamePlan(
  records: readonly DecisionRecord[],
  source: RenameableDecisionRecord,
  target: RenameTarget
): DecisionRenamePlan {
  let affectedCandidateRelationCount = 0;
  let affectedEstablishedRelationCount = 0;
  for (const record of records) {
    if (!isRenameableDecisionRecord(record)) continue;
    const count = record.source.document.relations.filter(
      (relation) => relation.target === source.decisionId
    ).length;
    if (isDecisionCandidateRecord(record))
      affectedCandidateRelationCount += count;
    else affectedEstablishedRelationCount += count;
  }
  return {
    affectedCandidateRelationCount,
    affectedEstablishedRelationCount,
    newId: target.decisionId,
    newName: target.name,
    newSourcePath: target.sourcePath,
    oldId: source.decisionId,
    oldName: decisionNameFromId(source.decisionId),
    oldSourcePath: source.sourcePath,
    outcome: "ready"
  };
}

function resolveRenameSource(
  scan: DecisionPreparationContext,
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

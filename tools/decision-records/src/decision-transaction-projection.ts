import path from "node:path";
import {
  buildDecisionIndexFromSnapshot,
  buildDecisionStateSnapshotFromSources,
  decisionIndexState
} from "./decision-state-index.ts";
import {
  decisionIdFromMarkdown,
  decisionSourceIdentityFromMarkdown
} from "./decision-metadata.ts";
import { decisionSourceRevision } from "./decision-source-revision.ts";
import { validateDecisionBody } from "./record.ts";
import { isDecisionSourcePath } from "./decision-path.ts";
import { decisionRelationConsistencyIssues } from "./relation-graph.ts";
import type { DecisionFileChange } from "./decision-transaction.ts";
import { isEstablishedDecisionRecord } from "./types.ts";
import type {
  DecisionId,
  DecisionIndex,
  DecisionIndexState,
  DecisionPreparationContext,
  DecisionSourcePath
} from "./types.ts";

export async function projectDecisionTransactionIndex(
  context: DecisionPreparationContext,
  changes: readonly DecisionFileChange[],
  validatedSources = false
): Promise<DecisionIndex> {
  if (context.publishedBaseline !== undefined)
    return await projectedIndex(context, changes);
  if (validatedSources) return await projectValidatedSources(context, changes);
  const byPath = new Map(
    context.records.map((record) => {
      if (record.source.kind === "missing")
        throw new Error(
          "Prepared Decision source is missing: " + record.sourcePath
        );
      return [record.decisionPath, record.source.text] as const;
    })
  );
  for (const change of changes) {
    byPath.delete(change.decisionPath);
    if (change.nextText !== null)
      byPath.set(change.targetPath ?? change.decisionPath, change.nextText);
  }
  const sources = [...byPath].flatMap(([filePath, text]) => {
    const identity = decisionSourceIdentityFromMarkdown(text);
    if (identity.decisionId === null)
      throw new Error("Invalid projected Decision identity: " + filePath);
    return identity.isCandidate
      ? []
      : [
          {
            decisionId: identity.decisionId,
            sourcePath: path
              .relative(context.decisionsDirectory, filePath)
              .split(path.sep)
              .join("/"),
            text
          }
        ];
  });
  const built = await buildDecisionIndexFromSnapshot(
    await buildDecisionStateSnapshotFromSources(sources)
  );
  if (built.status === "error")
    throw new Error(built.diagnostics.map((item) => item.message).join("; "));
  return built.value;
}

type ProjectedSource = Readonly<{ id: DecisionId; text: string }> &
  (
    | Readonly<{ state: DecisionIndexState; change?: never }>
    | Readonly<{ state?: never; change: DecisionFileChange }>
  );

/** 仅同次严格采集可复用已验证正文；改变的正文仍重新解析并校验最终全集关系。 */
async function projectValidatedSources(
  context: DecisionPreparationContext,
  changes: readonly DecisionFileChange[]
): Promise<DecisionIndex> {
  const sources = validatedSourcesAfterChanges(context, changes);
  const ids = new Set([...sources.values()].map((source) => source.id));
  const states: Record<string, DecisionIndexState> = {};
  for (const [filePath, source] of sources) {
    if (states[source.id] !== undefined) {
      throw new Error("Duplicate projected Decision identity: " + filePath);
    }
    states[source.id] =
      source.change === undefined
        ? source.state
        : (
            await projectChangedDecision(
              context,
              source.change,
              source.id,
              source.text,
              ids
            )
          ).state;
  }
  const issues = decisionRelationConsistencyIssues(
    [...sources.values()].map(({ id }) => ({
      decisionId: id,
      projection: states[id]!,
      sourcePath: states[id]!.sourcePath,
      status: states[id]!.status
    }))
  );
  if (issues.length > 0)
    throw new Error(issues.map((issue) => issue.message).join("; "));
  const built = await buildDecisionIndexFromSnapshot({
    metadata: {},
    sourceRevision: decisionSourceRevision(
      [...sources.values()].map((source) => ({
        decisionId: source.id,
        sourcePath: states[source.id]!.sourcePath,
        text: source.text
      }))
    ),
    states
  });
  if (built.status === "error")
    throw new Error(built.diagnostics.map((item) => item.message).join("; "));
  return built.value;
}

function validatedSourcesAfterChanges(
  context: DecisionPreparationContext,
  changes: readonly DecisionFileChange[]
): Map<string, ProjectedSource> {
  const sources = new Map<string, ProjectedSource>();
  for (const record of context.records) {
    if (record.source.kind === "candidate") continue;
    if (!isEstablishedDecisionRecord(record))
      throw new Error(
        "Prepared Decision source is not validated: " + record.sourcePath
      );
    sources.set(record.decisionPath, {
      id: record.decisionId,
      text: record.source.text,
      state: decisionIndexState(
        record.sourcePath,
        record.source.document,
        record.decisionId
      )
    });
  }
  for (const change of changes) {
    sources.delete(change.decisionPath);
    if (change.nextText === null) continue;
    const identity = decisionSourceIdentityFromMarkdown(change.nextText);
    if (identity.decisionId === null)
      throw new Error(
        "Invalid projected Decision identity: " + change.decisionPath
      );
    if (!identity.isCandidate)
      sources.set(change.targetPath ?? change.decisionPath, {
        id: identity.decisionId,
        text: change.nextText,
        change
      });
  }
  return sources;
}

async function projectedIndex(
  context: DecisionPreparationContext,
  changes: readonly DecisionFileChange[]
): Promise<DecisionIndex> {
  const baseline = context.publishedBaseline;
  if (baseline === undefined)
    throw new Error("Published baseline required for local maintenance.");
  const states = { ...baseline.entries };
  const revisions = { ...baseline.sourceRevision.entries };
  const ids = new Set([
    ...Object.keys(states),
    ...context.records.map((record) => record.decisionId)
  ]);
  for (const change of changes) {
    const id = decisionIdFromMarkdown(change.expectedText);
    if (id === null)
      throw new Error("Prepared Decision identity is unavailable.");
    if (change.nextText === null) {
      delete states[id];
      delete revisions[id];
      continue;
    }
    const projected = await projectChangedDecision(
      context,
      change,
      id,
      change.nextText,
      ids
    );
    states[id] = projected.state;
    revisions[id] = projected.revision;
  }
  const built = await buildDecisionIndexFromSnapshot({
    metadata: baseline.metadata,
    sourceRevision: {
      metadata: baseline.sourceRevision.metadata,
      entries: revisions
    },
    states
  });
  if (built.status === "error")
    throw new Error(built.diagnostics.map((item) => item.message).join("; "));
  return built.value;
}

async function projectChangedDecision(
  context: DecisionPreparationContext,
  change: DecisionFileChange,
  id: DecisionId,
  text: string,
  ids: ReadonlySet<string>
): Promise<Readonly<{ state: DecisionIndexState; revision: string }>> {
  const sourcePath = path
    .relative(
      context.decisionsDirectory,
      change.targetPath ?? change.decisionPath
    )
    .split(path.sep)
    .join("/");
  if (!isDecisionSourcePath(sourcePath))
    throw new Error("Invalid target Decision source path: " + sourcePath);
  const body = await validatedChangedDecisionBody(id, sourcePath, text, ids);
  const state = decisionIndexState(sourcePath, body, id);
  const revision = decisionSourceRevision([
    { decisionId: id, sourcePath, text: text }
  ]).entries[id]!;
  return { state, revision };
}

async function validatedChangedDecisionBody(
  id: DecisionId,
  sourcePath: DecisionSourcePath,
  text: string,
  ids: ReadonlySet<string>
) {
  const errors: string[] = [];
  const body = await validateDecisionBody({
    body: text,
    decisionId: id,
    sourcePath,
    errors,
    targetExists: (target) => ids.has(target)
  });
  if (
    body === null ||
    body.status === "candidate" ||
    body.alignment === null ||
    body.createdAt === null ||
    errors.length > 0
  )
    throw new Error(
      errors.join("; ") || "Changed Decision is not established."
    );
  return {
    ...body,
    status: body.status,
    alignment: body.alignment,
    createdAt: body.createdAt
  };
}

import { ensureDecisionDirectoryPath } from "./decision-source-path-safety.ts";
import {
  resolveIndexPath,
  writeTextAtomically
} from "../../index-runtime/src/index-path.ts";
import path from "node:path";
import { withDecisionCollectionMutationLock } from "./decision-collection-mutation-lock.ts";
import {
  applyDecisionChange,
  restoreDecisionChanges
} from "./decision-transaction-files.ts";
import { preflightDecisionChanges } from "./decision-transaction-preflight.ts";
import {
  transactionFailure,
  decisionTransactionLockFailure
} from "./decision-transaction-outcome.ts";
import {
  transactionFileSystemDiagnostic,
  type DecisionFileChange,
  type DecisionTransactionResult
} from "./decision-transaction.ts";
import {
  buildDecisionIndexFromSnapshot,
  decisionIndexState,
  serializeDecisionIndex
} from "./decision-state-index.ts";
import { decisionIdFromMarkdown } from "./decision-metadata.ts";
import { decisionSourceRevision } from "./decision-source-revision.ts";
import { validateDecisionBody } from "./record.ts";
import { isDecisionSourcePath } from "./decision-path.ts";
import { readStageFile } from "./decision-stage-support.ts";
import type {
  DecisionId,
  DecisionSourcePath,
  DecisionIndex,
  DecisionPreparationContext
} from "./types.ts";

type MaintenanceTransaction = Readonly<{
  context: DecisionPreparationContext;
  changes: readonly DecisionFileChange[];
  lockHeld?: boolean;
}>;

export async function applyDecisionMaintenanceChanges(
  options: MaintenanceTransaction
): Promise<DecisionTransactionResult> {
  try {
    return options.lockHeld === true
      ? await applyLockedMaintenance(options)
      : await withDecisionCollectionMutationLock(
          options.context.indexPath,
          () => applyLockedMaintenance(options)
        );
  } catch (error) {
    return decisionTransactionLockFailure(error);
  }
}

async function applyLockedMaintenance({
  context,
  changes
}: MaintenanceTransaction): Promise<DecisionTransactionResult> {
  const preflight = await preflightDecisionChanges(changes, context);
  if (preflight.errors.length > 0)
    return transactionFailure(preflight.errors, "no-change");
  let next: DecisionIndex;
  try {
    await verifyPreparedSources(context);
    next = await projectedIndex(context, changes);
    await verifyPreparedSources(context);
    const refreshed = await preflightDecisionChanges(changes, context);
    if (refreshed.errors.length > 0)
      return transactionFailure(refreshed.errors, "no-change");
  } catch (error) {
    return transactionFailure(
      [
        transactionFileSystemDiagnostic(
          "Decision maintenance preparation failed; no files were written.",
          context.indexRelativePath,
          error
        )
      ],
      "no-change"
    );
  }
  try {
    let changed = false;
    for (const change of changes)
      changed =
        (await applyDecisionChange(change, preflight.createdTargetPaths)) ||
        changed;
    await verifyAppliedMaintenanceSources(context, changes);
    const currentIndexText = (await readStageFile(context.indexPath)).toString(
      "utf8"
    );
    if (currentIndexText !== context.indexText)
      throw new Error("Decision index changed during maintenance.");
    const nextText = serializeDecisionIndex(next);
    if (nextText !== context.indexText) {
      const resolved = await resolveIndexPath(
        "decision-index.json",
        context.decisionsDirectory
      );
      if (resolved.status === "error")
        throw new Error(
          resolved.diagnostics.map((item) => item.message).join("; ")
        );
      await writeTextAtomically(resolved.value, nextText);
      changed = true;
    }
    if ((await readStageFile(context.indexPath)).toString("utf8") !== nextText)
      throw new Error("Decision index changed after publication.");
    return { changed, diagnostics: [], errors: [], status: "ok" };
  } catch (error) {
    const recovery = await restoreDecisionChanges(context, preflight);
    return transactionFailure(
      [
        transactionFileSystemDiagnostic(
          "Failed to update decision files and index.",
          context.indexRelativePath,
          error
        ),
        ...recovery
      ],
      recovery.length === 0 ? "rolled-back" : "partial-or-unknown"
    );
  }
}

function sourceText(
  record: DecisionPreparationContext["records"][number]
): string {
  if (record.source.kind === "missing")
    throw new Error("Prepared source is missing: " + record.sourcePath);
  return record.source.text;
}
async function verifyPreparedSources(
  context: DecisionPreparationContext
): Promise<void> {
  await ensureDecisionDirectoryPath(
    context.workspaceRoot,
    context.decisionsDirectory
  );
  for (const record of context.records) {
    await ensureDecisionDirectoryPath(
      context.decisionsDirectory,
      path.dirname(record.decisionPath)
    );
    if (
      (await readStageFile(record.decisionPath)).toString("utf8") !==
      sourceText(record)
    )
      throw new Error(
        "Relevant Decision source changed after preparation: " +
          record.sourcePath
      );
  }
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

async function verifyAppliedMaintenanceSources(
  context: DecisionPreparationContext,
  changes: readonly DecisionFileChange[]
): Promise<void> {
  // Check every relevant mutable source again; do not inspect unrelated current bodies.
  const changeByPath = new Map(
    changes.map((change) => [change.decisionPath, change])
  );
  for (const record of context.records) {
    const change = changeByPath.get(record.decisionPath);
    if (change?.nextText === null) continue;
    const expected =
      change === undefined ? sourceText(record) : change.nextText;
    const actual = (
      await readStageFile(change?.targetPath ?? record.decisionPath)
    ).toString("utf8");
    if (actual !== expected)
      throw new Error(
        "Relevant Decision source changed during transaction: " +
          record.sourcePath
      );
  }
}

async function projectChangedDecision(
  context: DecisionPreparationContext,
  change: DecisionFileChange,
  id: DecisionId,
  text: string,
  ids: ReadonlySet<string>
) {
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

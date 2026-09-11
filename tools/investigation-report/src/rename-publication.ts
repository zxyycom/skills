import { Buffer } from "node:buffer";
import path from "node:path";
import type {
  InvestigationRenameHooks,
  InvestigationRenameResult,
  PreparedRename,
  RenameSource,
  ReportFileSnapshot,
  ResourceMoveProgress
} from "./rename-contract.ts";
import { moveResourceOwner } from "./rename-resource.ts";
import {
  captureRenameSourceSnapshots,
  captureWrittenReportSnapshot,
  removeReportFileIfUnchanged,
  restoreRename,
  sameReportBytes
} from "./rename-recovery.ts";
import {
  errorText,
  noOp,
  renameFailure,
  renameMutation,
  renameSuccess,
  writeNewText,
  writeTextAtomically
} from "./rename-support.ts";
import {
  verifyCommittedRename,
  verifyPreparedRename
} from "./rename-verification.ts";

type PublicationState = {
  createdSourcePath: boolean;
  originalByPath: Map<string, ReportFileSnapshot>;
  resourceMoveProgress: ResourceMoveProgress;
  sourceNewPath: string;
  sourceOldPath: string;
  writtenByPath: Map<string, ReportFileSnapshot>;
  writtenPaths: Set<string>;
};

export async function publishRename(
  root: string,
  prepared: PreparedRename,
  hooks: InvestigationRenameHooks
): Promise<InvestigationRenameResult> {
  if (prepared.noChange)
    return renameSuccess(false, prepared.indexPath, prepared.plan, "no-change");
  const preflight = await publishPreflight(root, prepared, hooks);
  if ("result" in preflight) return preflight.result;
  const state = createPublicationState(root, prepared, preflight.value);
  try {
    await publishSources(prepared, hooks, state);
    await publishResourceMove(prepared, hooks, state.resourceMoveProgress);
    await publishIndex(prepared, hooks, state.writtenPaths);
    const errors = await verifyCommittedRename(root, prepared);
    if (errors.length > 0) throw new Error(errors.join("; "));
    return renameSuccess(true, prepared.indexPath, prepared.plan, "committed");
  } catch (error) {
    return await rollbackPublication(prepared, state, error);
  }
}

type PublishPreflight =
  | Readonly<{ value: Map<string, ReportFileSnapshot> }>
  | Readonly<{ result: InvestigationRenameResult }>;

async function publishPreflight(
  root: string,
  prepared: PreparedRename,
  hooks: InvestigationRenameHooks
): Promise<PublishPreflight> {
  const hookFailure = await publishHookFailure(prepared, hooks);
  if (hookFailure !== null) return { result: hookFailure };
  const verification = await verifyPreparedRename(root, prepared);
  if (verification.length > 0)
    return {
      result: renameFailure(
        prepared.indexPath,
        prepared.plan,
        verification,
        renameMutation("no-change")
      )
    };
  try {
    return {
      value: await captureRenameSourceSnapshots(prepared.originalSources)
    };
  } catch (error) {
    return {
      result: renameFailure(
        prepared.indexPath,
        prepared.plan,
        [
          "Investigation rename sources could not be snapshotted before publication: " +
            errorText(error)
        ],
        renameMutation("no-change")
      )
    };
  }
}

async function publishHookFailure(
  prepared: PreparedRename,
  hooks: InvestigationRenameHooks
): Promise<InvestigationRenameResult | null> {
  try {
    await (hooks.beforePublish ?? noOp)();
    return null;
  } catch (error) {
    return renameFailure(
      prepared.indexPath,
      prepared.plan,
      ["Investigation rename publish preparation failed: " + errorText(error)],
      renameMutation("no-change")
    );
  }
}

function createPublicationState(
  root: string,
  prepared: PreparedRename,
  originalByPath: Map<string, ReportFileSnapshot>
): PublicationState {
  return {
    createdSourcePath: false,
    originalByPath,
    resourceMoveProgress: {
      sourceRemovalStarted: false,
      sourceRemoved: false,
      targetClaimed: false
    },
    sourceNewPath: path.join(root, prepared.targetSource.sourcePath),
    sourceOldPath: prepared.sourceBefore.filePath,
    writtenByPath: new Map(),
    writtenPaths: new Set()
  };
}

async function publishSources(
  prepared: PreparedRename,
  hooks: InvestigationRenameHooks,
  state: PublicationState
): Promise<void> {
  for (const source of prepared.sources)
    await publishSource(prepared, hooks, state, source);
}

async function publishSource(
  prepared: PreparedRename,
  hooks: InvestigationRenameHooks,
  state: PublicationState,
  source: RenameSource
): Promise<void> {
  if (
    source.id === prepared.plan.newId &&
    state.sourceNewPath !== state.sourceOldPath
  ) {
    await publishMovedSource(hooks, state, source);
    return;
  }
  await publishRewrittenSource(hooks, state, source);
}

async function publishMovedSource(
  hooks: InvestigationRenameHooks,
  state: PublicationState,
  source: RenameSource
): Promise<void> {
  const original = state.originalByPath.get(state.sourceOldPath)!;
  await (hooks.writeNew ?? writeNewText)(state.sourceNewPath, source.text);
  state.createdSourcePath = true;
  state.writtenPaths.add(state.sourceNewPath);
  state.writtenByPath.set(
    state.sourceNewPath,
    await captureWrittenReportSnapshot(state.sourceNewPath, source.text)
  );
  await removeReportFileIfUnchanged(state.sourceOldPath, original);
}

async function publishRewrittenSource(
  hooks: InvestigationRenameHooks,
  state: PublicationState,
  source: RenameSource
): Promise<void> {
  const original = state.originalByPath.get(source.filePath)!;
  if (sameReportBytes(original.bytes, Buffer.from(source.text))) return;
  await (hooks.writeExisting ?? writeTextAtomically)(
    source.filePath,
    source.text
  );
  state.writtenPaths.add(source.filePath);
  state.writtenByPath.set(
    source.filePath,
    await captureWrittenReportSnapshot(source.filePath, source.text)
  );
}

async function publishResourceMove(
  prepared: PreparedRename,
  hooks: InvestigationRenameHooks,
  progress: ResourceMoveProgress
): Promise<void> {
  if (prepared.resourceMove === null) return;
  await (hooks.beforeResourceMove ?? noOp)();
  await moveResourceOwner(
    prepared.resourceMove,
    prepared.plan.oldId,
    prepared.plan.newId,
    progress,
    hooks.beforeSourceOwnerRemoval
  );
}

async function publishIndex(
  prepared: PreparedRename,
  hooks: InvestigationRenameHooks,
  writtenPaths: Set<string>
): Promise<void> {
  if (prepared.nextIndexText === null) return;
  await (hooks.writeExisting ?? writeTextAtomically)(
    prepared.indexPath,
    prepared.nextIndexText
  );
  writtenPaths.add(prepared.indexPath);
}

async function rollbackPublication(
  prepared: PreparedRename,
  state: PublicationState,
  error: unknown
): Promise<InvestigationRenameResult> {
  const restored = await restoreRename({ ...state, prepared });
  const outcome = restored.length === 0 ? "rolled-back" : "partial-or-unknown";
  return renameFailure(
    prepared.indexPath,
    null,
    ["Investigation rename publish failed: " + errorText(error), ...restored],
    renameMutation(outcome)
  );
}

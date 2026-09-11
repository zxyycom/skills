import path from "node:path";
import { withInvestigationCollectionMutationLock } from "./collection-mutation-lock.ts";
import { investigationIndexFileName } from "./investigation-state-index.ts";
import {
  canonicalizeInvestigationsDirectory,
  resolveInvestigationsDirectory
} from "./report-path.ts";
import type {
  InvestigationRenameHooks,
  InvestigationRenameOptions,
  InvestigationRenameResult
} from "./rename-contract.ts";
export type {
  InvestigationRenameHooks,
  InvestigationRenameOptions,
  InvestigationRenamePlan,
  InvestigationRenameResult,
  InvestigationRenameWriter
} from "./rename-contract.ts";
import { publishRename } from "./rename-publication.ts";
import {
  prepareRename,
  recordedRenameConfirmation
} from "./rename-preparation.ts";
import {
  renameFailure,
  renameLockFailure,
  renameSuccess
} from "./rename-support.ts";

/** Renames one Investigation across reports, candidates, resources, and index. */
export async function renameInvestigationRecord(
  options: InvestigationRenameOptions
): Promise<InvestigationRenameResult> {
  return await renameInvestigationRecordWithHooks(options);
}

/** Test seam for the transaction's source-drift and publish-recovery boundaries. */
export async function renameInvestigationRecordWithHooks(
  options: InvestigationRenameOptions,
  hooks: InvestigationRenameHooks = {}
): Promise<InvestigationRenameResult> {
  const resolved = resolveInvestigationsDirectory(
    options.workspaceRoot,
    options.investigationsDir
  );
  if (resolved.isErr()) return renameFailure("", null, resolved.error);
  const canonical = await canonicalizeInvestigationsDirectory(resolved.value);
  if (canonical.isErr()) return renameFailure("", null, canonical.error);
  const root = canonical.value.investigationsDirectory;
  const indexPath = path.join(root, investigationIndexFileName);
  const initial = await prepareRename(root, indexPath, options);
  if ("result" in initial) return initial.result;
  if (options.preflight === true) {
    return renameSuccess(
      false,
      indexPath,
      {
        ...initial.value.plan,
        outcome: "preflight"
      },
      "preflight"
    );
  }
  if (initial.value.noChange) {
    return renameSuccess(false, indexPath, initial.value.plan, "no-change");
  }
  try {
    return await withInvestigationCollectionMutationLock(
      indexPath,
      async () => {
        const prepared = await prepareRename(root, indexPath, options);
        if ("result" in prepared) return prepared.result;
        if (prepared.value.noChange) {
          return renameSuccess(
            false,
            indexPath,
            prepared.value.plan,
            "no-change"
          );
        }
        const confirmation = await recordedRenameConfirmation(
          root,
          prepared.value.sourceBefore,
          prepared.value.resourceMove,
          options
        );
        if (confirmation !== null) return confirmation;
        return await publishRename(root, prepared.value, hooks);
      }
    );
  } catch (error) {
    return renameLockFailure(indexPath, error);
  }
}

/**
 * Claim the target owner before copying its validated members. `rename()` can
 * replace an empty target directory on POSIX, so it is not a no-overwrite move
 * primitive for owner trees that may be created concurrently.
 */

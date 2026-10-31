/*
 * Synced TypeScript runtime; repository maintenance edits tools/decision-records/src/rename/decision-rename-pending.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/decision-records/src/rename/decision-rename-pending.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/decision-records/src/rename/decision-rename-pending.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
import { readPendingSnapshot } from "../../../shared/src/version-control/pending-snapshot.ts";
import path from "node:path";
import {
  openVersionControl,
  VersionControlError,
  type VersionControlRepository
} from "../../../shared/src/version-control/index.ts";
import type { DecisionApplicationFailure } from "../application-result.ts";
import { renameFailure } from "./decision-rename-planning.ts";
import type { DecisionPreparationContext } from "../types.ts";

export async function pendingDecisionRenameFailure(
  scan: DecisionPreparationContext
): Promise<DecisionApplicationFailure | null> {
  try {
    const repository = await openVersionControl(scan.decisionsDirectory);
    const revision = await repository.getCurrentRevision();
    const scope = repositoryRelativeDecisionScope(
      repository.rootDirectory,
      scan.decisionsDirectory
    );
    if (scope === null) return null;
    const changed = await pendingRenamePaths(repository, revision, scope);
    if (changed.length === 0) return null;
    return renameFailure(
      "decision-records.rename-pending-stage-conflict",
      "Decision pending snapshot already contains collection files; rename would leave its old identity in that staged view.",
      "Inspect or resolve the Decision pending snapshot, then retry rename without relying on automatic staging.",
      scan.indexRelativePath
    );
  } catch (error) {
    if (
      error instanceof VersionControlError &&
      error.code === "not-repository"
    ) {
      return null;
    }
    return renameFailure(
      "decision-records.rename-pending-stage-inspection-failed",
      "Decision pending snapshot could not be inspected before rename.",
      "Correct the version-control failure, then retry rename; no files were changed.",
      scan.indexRelativePath
    );
  }
}

async function pendingRenamePaths(
  repository: VersionControlRepository,
  revision: string | null,
  scope: string
) {
  return revision === null
    ? (
        await readPendingSnapshot(repository, {
          pathScope: scope,
          contentPaths: [],
          payloadScope: "content-paths"
        })
      ).members
    : await repository.listPendingChangedPaths({
        from: revision,
        pathScopes: [scope]
      });
}

function repositoryRelativeDecisionScope(
  repositoryRoot: string,
  decisionsDirectory: string
): string | null {
  const relative = path.relative(repositoryRoot, decisionsDirectory);
  if (
    relative.length === 0 ||
    path.isAbsolute(relative) ||
    relative === ".." ||
    relative.startsWith(`..${path.sep}`)
  ) {
    return null;
  }
  return relative.split(path.sep).join("/");
}

import path from "node:path";
import {
  openVersionControl,
  VersionControlError
} from "../../shared/src/version-control/index.ts";
import type { DecisionApplicationFailure } from "./application-result.ts";
import { renameFailure } from "./decision-rename-planning.ts";
import type { DecisionScan } from "./types.ts";

export async function pendingDecisionRenameFailure(
  scan: DecisionScan
): Promise<DecisionApplicationFailure | null> {
  try {
    const repository = await openVersionControl(scan.decisionsDirectory);
    const revision = await repository.getCurrentRevision();
    const scope = repositoryRelativeDecisionScope(
      repository.rootDirectory,
      scan.decisionsDirectory
    );
    if (scope === null) return null;
    const changed =
      revision === null
        ? await repository.readPendingFiles({ pathScopes: [scope] })
        : await repository.listPendingChangedPaths({
            from: revision,
            pathScopes: [scope]
          });
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

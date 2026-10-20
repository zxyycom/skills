/*
 * Synced TypeScript runtime; repository maintenance edits tools/decision-records/src/decision-stage-paths.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/decision-records/src/decision-stage-paths.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/decision-records/src/decision-stage-paths.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
import path from "node:path";
import { decisionIndexFileName } from "./decision-state-index.ts";
import { displayDecisionPath } from "./decision-path.ts";
import type { SelectedFilesystemSource } from "./decision-stage-contracts.ts";
import { decisionRelativePath } from "./decision-stage-support.ts";
import type { resolveDecisionLocation } from "./decision-query-context.ts";

type StageLocation = ReturnType<typeof resolveDecisionLocation>;

export function displayIndexRelativePath(location: StageLocation): string {
  return displayDecisionPath(
    location.workspaceRoot,
    path.join(location.decisionsDirectory, decisionIndexFileName)
  );
}

export function displayRepositoryRelativePath(
  location: StageLocation,
  decisionScope: string,
  repositoryFilePath: string
): string {
  const relativePath = decisionRelativePath(decisionScope, repositoryFilePath);
  return displayDecisionPath(
    location.workspaceRoot,
    path.join(location.decisionsDirectory, ...relativePath.split("/"))
  );
}

export function selectedSourceRelativePaths(
  location: StageLocation,
  selectedSources: readonly SelectedFilesystemSource[]
): string[] {
  return selectedSources.flatMap((selected) =>
    selected.source === null
      ? []
      : [
          displayDecisionPath(
            location.workspaceRoot,
            path.join(
              location.decisionsDirectory,
              ...selected.source.source.sourcePath.split("/")
            )
          )
        ]
  );
}

import path from "node:path";
import { decisionIndexFileName } from "../index/decision-state-index.ts";
import { displayDecisionPath } from "../collection/decision-path.ts";
import { decisionRelativePath } from "./decision-stage-support.ts";
import type { resolveDecisionLocation } from "../query/decision-query-context.ts";

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

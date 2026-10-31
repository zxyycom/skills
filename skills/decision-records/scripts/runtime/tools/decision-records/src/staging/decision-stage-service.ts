/*
 * Synced TypeScript runtime; repository maintenance edits tools/decision-records/src/staging/decision-stage-service.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/decision-records/src/staging/decision-stage-service.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/decision-records/src/staging/decision-stage-service.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
import {
  resolveDecisionLocation,
  type DecisionLocation
} from "../query/decision-query-context.ts";
import {
  isDecisionId,
  normalizeDecisionSelectorInput
} from "../collection/decision-path.ts";
import type { DecisionId } from "../types.ts";
import type { DecisionStageScope } from "./decision-stage-contracts.ts";
import type { DecisionApplicationFailure } from "../application-result.ts";
import { stageInputFailure } from "./decision-stage-support.ts";
import { openStageRepository } from "./decision-stage-repository.ts";
import { refreshDecisionStage } from "./refresh/decision-stage-refresh.ts";
import { decisionStageTargetFailure } from "./decision-stage-prepare.ts";

export type DecisionStageSuccess = Readonly<{
  callerOwnedPaths: readonly string[];
  command: "stage";
  indexRelativePath: string;
  pendingFileCount: number;
  preservedPendingPaths: readonly string[];
  scope: DecisionStageScope;
  selectedIds: readonly DecisionId[];
  status: "ok";
  writtenPaths: readonly string[];
}>;

export type DecisionStageResult =
  | DecisionApplicationFailure
  | DecisionStageSuccess;

export async function stageDecisionRecords(
  options: Readonly<{
    decisionIds: readonly string[];
    location: DecisionLocation;
    scope?: DecisionStageScope;
  }>
): Promise<DecisionStageResult> {
  const selectedSelectors = validateSelectedSelectors(options.decisionIds);
  if (selectedSelectors.status === "error") return selectedSelectors;
  const scope = options.scope ?? "all";
  const location = resolveDecisionLocation(options.location);
  const opened = await openStageRepository(location.decisionsDirectory);
  if (opened.status === "error") return opened;
  try {
    return await refreshDecisionStage({
      decisionsDirectory: location.decisionsDirectory,
      workspaceRoot: location.workspaceRoot,
      opened: opened.value,
      selectors: selectedSelectors.value,
      scope
    });
  } catch (error) {
    return decisionStageTargetFailure(error);
  }
}

function validateSelectedSelectors(
  decisionIds: readonly string[]
): DecisionApplicationFailure | { status: "ok"; value: DecisionId[] } {
  const errors: string[] = [];
  const values: DecisionId[] = [];
  const seen = new Set<DecisionId>();
  if (decisionIds.length === 0) {
    errors.push("stage requires at least one Decision ID");
  }
  for (const value of decisionIds) {
    const decisionId = normalizeDecisionSelectorInput(value);
    if (!isDecisionId(decisionId)) {
      errors.push(
        "Decision selector must be extensionless kebab-case text: " + value
      );
      continue;
    }
    if (seen.has(decisionId)) {
      errors.push("Decision selector must not be repeated: " + decisionId);
      continue;
    }
    seen.add(decisionId);
    values.push(decisionId);
  }
  return errors.length === 0
    ? { status: "ok", value: values }
    : stageInputFailure(errors, 2);
}

/*
 * Synced TypeScript runtime; repository maintenance edits tools/decision-records/src/decision-stage-service.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/decision-records/src/decision-stage-service.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/decision-records/src/decision-stage-service.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
import { sameStateSourceRevision } from "../../index-runtime/src/index.ts";
import {
  decisionIndexDiagnosticMessages,
  decisionIndexFileName,
  loadDecisionIndex,
  readDecisionSourceRevision
} from "./decision-state-index.ts";
import {
  resolveDecisionLocation,
  type DecisionLocation
} from "./decision-query-context.ts";
import {
  isDecisionId,
  normalizeDecisionSelectorInput
} from "./decision-path.ts";
import type { DecisionId } from "./types.ts";
import type { DecisionStageScope } from "./decision-stage-contracts.ts";
import type { DecisionApplicationFailure } from "./application-result.ts";
import {
  stageInputFailure,
  staleStageFailure,
  type StageStep
} from "./decision-stage-support.ts";
import { openStageRepository } from "./decision-stage-repository.ts";
import { stageIndexProjection } from "./decision-stage-index-scope.ts";
import { stageWorkspaceSnapshot } from "./decision-stage-workspace-scope.ts";

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

/**
 * Staging writes a complete pending snapshot, so it requires the persisted
 * index to match the authoritative Markdown. A missing index with no
 * established projection is the supported first-record bootstrap; every other
 * missing, invalid, or stale projection stops staging with the sync-index
 * recovery instead of guessing identities from a drifted snapshot.
 */
async function stageFreshnessGate(
  decisionsDirectory: string
): Promise<StageStep<true>> {
  const persisted = await loadDecisionIndex({ decisionsDirectory });
  if (persisted.status === "error") {
    if (
      persisted.diagnostics.some(
        (diagnostic) => diagnostic.code === "state-index.index-missing"
      )
    ) {
      return { status: "ok", value: true };
    }
    return staleStageFailure(
      decisionIndexDiagnosticMessages(persisted.diagnostics)
    );
  }
  let stale = true;
  try {
    const revision = await readDecisionSourceRevision(
      decisionsDirectory,
      undefined
    );
    stale = !sameStateSourceRevision(persisted.value.sourceRevision, revision);
  } catch {
    // Stage must fail closed when current source evidence cannot be acquired.
  }
  return stale
    ? staleStageFailure([
        `${decisionIndexFileName} is out of sync; run sync-index`
      ])
    : { status: "ok", value: true };
}

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
  const gate = await stageFreshnessGate(location.decisionsDirectory);
  if (gate.status === "error") return gate;
  const opened = await openStageRepository(location.decisionsDirectory);
  if (opened.status === "error") return opened;
  const context = {
    location,
    opened: opened.value,
    selectedSelectors: selectedSelectors.value
  };
  return scope === "index"
    ? await stageIndexProjection(context)
    : await stageWorkspaceSnapshot(context, scope);
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

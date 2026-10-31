/*
 * Synced TypeScript runtime; repository maintenance edits tools/decision-records/src/cli/commands/cli-lifecycle-selection.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/decision-records/src/cli/commands/cli-lifecycle-selection.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/decision-records/src/cli/commands/cli-lifecycle-selection.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
import {
  createDecisionRecordLookup,
  createDecisionNameLookup,
  type DecisionRecordLookup
} from "../../records/decision-record-lookup.ts";
import {
  decisionDiagnosticFromReason,
  decisionFailure,
  type DecisionApplicationFailure
} from "../../application-result.ts";
import {
  resolveRelationOverride,
  resolveRelationOverrideGroups,
  attachSuccessorRelationOverrides
} from "./cli-lifecycle-relations.ts";
import {
  normalizeDecisionSelectorInput,
  parseDatedDecisionId,
  isDecisionId
} from "../../collection/decision-path.ts";
import type { DecisionLifecycleRequest } from "../../lifecycle/decision-lifecycle-service.ts";
import type {
  DecisionId,
  DecisionRelationOverrideGroup,
  DecisionPreparationContext,
  DecisionSuccessor
} from "../../types.ts";

type LifecycleSelectorResolution = {
  failures: DecisionApplicationFailure[];
  one: (selector: string) => DecisionId | null;
};
type LifecycleResolutionResult =
  | { request: DecisionLifecycleRequest; status: "ok" }
  | { failure: DecisionApplicationFailure; status: "error" };

export function resolveDecisionLifecycleRequest(
  scan: DecisionPreparationContext,
  request: DecisionLifecycleRequest
): LifecycleResolutionResult {
  const resolution = lifecycleSelectorResolution(scan);
  if (request.action === "evolve")
    return resolveEvolutionRequest(request, resolution);
  if (request.action === "set-relations")
    return resolveSetRelationsRequest(request, resolution);
  if (request.action === "archive")
    return resolveArchiveRequest(request, resolution);
  return resolveSingleDecisionRequest(request, resolution);
}

function resolveSingleDecisionRequest(
  request: Extract<
    DecisionLifecycleRequest,
    { action: "discard" | "mark-aligned" | "publish" | "reactivate" }
  >,
  resolution: LifecycleSelectorResolution
) {
  const decisionId = resolution.one(request.decisionId);
  if (decisionId === null || resolution.failures.length > 0)
    return selectorResolutionFailure(resolution);
  return { request: { ...request, decisionId }, status: "ok" } as const;
}

function lifecycleSelectorResolution(
  scan: DecisionPreparationContext
): LifecycleSelectorResolution {
  const failures: DecisionApplicationFailure[] = [];
  const records = createDecisionRecordLookup(scan.records);
  const publishedIds = Object.keys(
    scan.publishedBaseline?.entries ?? {}
  ).filter(isDecisionId);
  const publishedIdSet = new Set(publishedIds);
  let names: ReadonlyMap<string, readonly DecisionId[]> | undefined;
  const matches = (normalized: string): readonly DecisionId[] => {
    names ??= createDecisionNameLookup([
      ...new Set([
        ...publishedIds,
        ...scan.records.flatMap((record) =>
          typeof record.decisionId === "string"
            ? [record.decisionId as DecisionId]
            : []
        )
      ])
    ]);
    return names.get(normalized) ?? [];
  };
  const one = (selector: string): DecisionId | null => {
    const normalized = normalizeDecisionSelectorInput(selector);
    const dated = parseDatedDecisionId(normalized);
    const value =
      dated !== null && publishedIdSet.has(dated.id)
        ? dated.id
        : resolveDecisionSelector(records, matches, selector);
    if (typeof value === "object") {
      failures.push(value);
      return null;
    }
    return value;
  };
  return { failures, one };
}

function resolveEvolutionRequest(
  request: Extract<DecisionLifecycleRequest, { action: "evolve" }>,
  resolution: LifecycleSelectorResolution
) {
  const relationOverride = resolveRelationOverride(
    request.relationOverride,
    resolution.one
  );
  if (relationOverride === null) return selectorResolutionFailure(resolution);
  if ("status" in relationOverride)
    return { failure: relationOverride, status: "error" } as const;
  const selection = resolveEvolutionSelection(request, resolution);
  if (selection === null || resolution.failures.length > 0)
    return selectorResolutionFailure(resolution);
  if ("status" in selection)
    return { failure: selection, status: "error" } as const;
  const successorsWithOverrides = attachSuccessorRelationOverrides(
    selection.successors,
    selection.relationOverrideGroups
  );
  if ("status" in successorsWithOverrides)
    return { failure: successorsWithOverrides, status: "error" } as const;
  return {
    request: {
      ...request,
      discardId: selection.discardId,
      relationOverride,
      relationOverrideGroups: selection.relationOverrideGroups,
      successors: successorsWithOverrides
    },
    status: "ok"
  } as const;
}

function resolveEvolutionSelection(
  request: Extract<DecisionLifecycleRequest, { action: "evolve" }>,
  resolution: LifecycleSelectorResolution
):
  | {
      discardId: DecisionId | null;
      relationOverrideGroups: DecisionRelationOverrideGroup[];
      successors: DecisionSuccessor[];
    }
  | DecisionApplicationFailure
  | null {
  const discardId =
    request.discardId === null ? null : resolution.one(request.discardId);
  const successors = resolveSuccessors(request.successors, resolution.one);
  const relationOverrideGroups = resolveRelationOverrideGroups(
    request.relationOverrideGroups,
    resolution.one
  );
  if (successors === null || relationOverrideGroups === null) return null;
  if ("status" in relationOverrideGroups) return relationOverrideGroups;
  if (request.discardId !== null && discardId === null) return null;
  return { discardId, relationOverrideGroups, successors };
}

function resolveSetRelationsRequest(
  request: Extract<DecisionLifecycleRequest, { action: "set-relations" }>,
  resolution: LifecycleSelectorResolution
) {
  const relationOverrideGroups = resolveRelationOverrideGroups(
    request.relationOverrideGroups,
    resolution.one
  );
  if (relationOverrideGroups === null || resolution.failures.length > 0)
    return selectorResolutionFailure(resolution);
  if ("status" in relationOverrideGroups)
    return { failure: relationOverrideGroups, status: "error" } as const;
  const duplicateSource = duplicateSetRelationsSource(relationOverrideGroups);
  if (duplicateSource !== null) {
    return {
      failure: decisionFailure(
        [
          "--source resolves to the same established decision more than once: " +
            duplicateSource
        ],
        { presentation: "plain" }
      ),
      status: "error"
    } as const;
  }
  return {
    request: { ...request, relationOverrideGroups },
    status: "ok"
  } as const;
}

function duplicateSetRelationsSource(
  groups: readonly DecisionRelationOverrideGroup[]
): DecisionId | null {
  const sources = new Set<DecisionId>();
  for (const group of groups) {
    if (sources.has(group.source)) return group.source;
    sources.add(group.source);
  }
  return null;
}

function resolveArchiveRequest(
  request: Extract<DecisionLifecycleRequest, { action: "archive" }>,
  resolution: LifecycleSelectorResolution
) {
  const decisionIds = request.decisionIds.map(resolution.one);
  if (resolution.failures.length > 0 || decisionIds.some((id) => id === null))
    return selectorResolutionFailure(resolution);
  return {
    request: { ...request, decisionIds: decisionIds as DecisionId[] },
    status: "ok"
  } as const;
}

function selectorResolutionFailure(resolution: LifecycleSelectorResolution) {
  return {
    failure: mergeSelectorFailures(resolution.failures),
    status: "error"
  } as const;
}

function resolveSuccessors(
  successors: readonly DecisionSuccessor[],
  resolve: (selector: string) => DecisionId | null
): DecisionSuccessor[] | null {
  const resolved: DecisionSuccessor[] = [];
  for (const successor of successors) {
    const decisionId = resolve(successor.decisionId);
    if (decisionId === null) return null;
    resolved.push({ ...successor, decisionId });
  }
  return resolved;
}

function resolveDecisionSelector(
  records: DecisionRecordLookup,
  names: (name: string) => readonly DecisionId[],
  selector: string
): DecisionId | DecisionApplicationFailure {
  const normalized = normalizeDecisionSelectorInput(selector);
  const dated = parseDatedDecisionId(normalized);
  const matches =
    dated === null
      ? names(normalized)
      : (records.get(dated.id) ?? []).map(
          (record) => record.decisionId as DecisionId
        );
  if (matches.length === 1) return matches[0]!;
  return decisionFailure(
    [
      decisionDiagnosticFromReason(
        {
          code:
            matches.length === 0
              ? "decision-records.decision-not-found"
              : "decision-records.decision-ambiguous",
          recovery:
            matches.length === 0
              ? "Use an existing Decision ID or unique name, then retry the command."
              : "Retry with one listed calendar-valid YYMMDD-name Decision ID.",
          target: normalized
        },
        matches.length === 0
          ? `Decision does not exist: ${normalized}`
          : `Decision name is ambiguous: ${normalized}; choose one standard ID: ${matches.join(", ")}`
      )
    ],
    { presentation: "plain" }
  );
}

function mergeSelectorFailures(
  failures: readonly DecisionApplicationFailure[]
): DecisionApplicationFailure {
  return decisionFailure(
    failures.flatMap((failure) => failure.diagnostics),
    {
      presentation: "plain"
    }
  );
}

import {
  decisionDiagnosticFromReason,
  decisionFailure,
  type DecisionApplicationFailure
} from "./application-result.ts";
import { bindRelationSummaries } from "./relation-summary.ts";
import {
  decisionNameFromId,
  normalizeDecisionSelectorInput,
  parseDatedDecisionId
} from "./decision-path.ts";
import type { DecisionLifecycleRequest } from "./decision-lifecycle-service.ts";
import type {
  DecisionId,
  DecisionRelation,
  DecisionRelationOverride,
  DecisionRelationOverrideGroup,
  DecisionRelationSummary,
  DecisionScan,
  DecisionSuccessor
} from "./types.ts";

type LifecycleSelectorResolution = {
  failures: DecisionApplicationFailure[];
  one: (selector: string) => DecisionId | null;
};
type LifecycleResolutionResult =
  | { request: DecisionLifecycleRequest; status: "ok" }
  | { failure: DecisionApplicationFailure; status: "error" };

export function resolveDecisionLifecycleRequest(
  scan: DecisionScan,
  request: DecisionLifecycleRequest
): LifecycleResolutionResult {
  const resolution = lifecycleSelectorResolution(scan);
  if (request.action === "activate")
    return resolveActivationRequest(request, resolution);
  if (request.action === "evolve")
    return resolveEvolutionRequest(request, resolution);
  if (request.action === "archive")
    return resolveArchiveRequest(request, resolution);
  return resolveSingleDecisionRequest(request, resolution);
}

function resolveSingleDecisionRequest(
  request: Extract<
    DecisionLifecycleRequest,
    { action: "discard" | "mark-aligned" }
  >,
  resolution: LifecycleSelectorResolution
) {
  const decisionId = resolution.one(request.decisionId);
  if (decisionId === null || resolution.failures.length > 0)
    return selectorResolutionFailure(resolution);
  return { request: { ...request, decisionId }, status: "ok" } as const;
}

function lifecycleSelectorResolution(
  scan: DecisionScan
): LifecycleSelectorResolution {
  const failures: DecisionApplicationFailure[] = [];
  const one = (selector: string): DecisionId | null => {
    const value = resolveDecisionSelector(scan, selector);
    if (typeof value === "object") {
      failures.push(value);
      return null;
    }
    return value;
  };
  return { failures, one };
}

function resolveActivationRequest(
  request: Extract<DecisionLifecycleRequest, { action: "activate" }>,
  resolution: LifecycleSelectorResolution
) {
  const relationOverride = resolveRelationOverride(
    request.relationOverride,
    resolution.one
  );
  if (relationOverride === null) return selectorResolutionFailure(resolution);
  if ("status" in relationOverride)
    return { failure: relationOverride, status: "error" } as const;
  const decisionId = resolution.one(request.decisionId);
  if (decisionId === null || resolution.failures.length > 0)
    return selectorResolutionFailure(resolution);
  return {
    request: { ...request, decisionId, relationOverride },
    status: "ok"
  } as const;
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

function resolveRelationOverride(
  override: DecisionRelationOverride,
  resolve: (selector: string) => DecisionId | null
): DecisionRelationOverride | DecisionApplicationFailure | null {
  if (override.kind === "source") return override;
  const relations: DecisionRelation[] = [];
  for (const relation of override.relations) {
    const target = resolve(relation.target);
    if (target === null) return null;
    relations.push({ ...relation, target });
  }
  const summaries: DecisionRelationSummary[] = [];
  for (const summary of override.relationSummaries ?? []) {
    const target = resolve(summary.target);
    if (target === null) return null;
    summaries.push({ ...summary, target });
  }
  const duplicateTarget = duplicateRelationSelectorTarget(relations, summaries);
  if (duplicateTarget !== null) {
    return decisionFailure([
      "Relation selectors resolve to the same direct predecessor target: " +
        duplicateTarget
    ]);
  }
  const bound = bindRelationSummaries(relations, summaries);
  if ("error" in bound) {
    return decisionFailure(
      [
        decisionDiagnosticFromReason(
          {
            code: "decision-records.relation-summary-invalid",
            recovery:
              "Provide each --relation-summary target once in the complete relation set, then retry.",
            target: "--relation-summary"
          },
          bound.error
        )
      ],
      { presentation: "plain" }
    );
  }
  return { kind: "replace", relations: bound.relations };
}

function duplicateRelationSelectorTarget(
  relations: readonly DecisionRelation[],
  summaries: readonly DecisionRelationSummary[]
): DecisionId | null {
  const relationTargets = new Set<DecisionId>();
  for (const relation of relations) {
    if (relationTargets.has(relation.target)) return relation.target;
    relationTargets.add(relation.target);
  }
  const summaryTargets = new Set<DecisionId>();
  for (const summary of summaries) {
    if (summaryTargets.has(summary.target)) return summary.target;
    summaryTargets.add(summary.target);
  }
  return null;
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

function resolveRelationOverrideGroups(
  groups: readonly DecisionRelationOverrideGroup[],
  resolve: (selector: string) => DecisionId | null
): DecisionRelationOverrideGroup[] | DecisionApplicationFailure | null {
  const resolved: DecisionRelationOverrideGroup[] = [];
  for (const group of groups) {
    const source = resolve(group.source);
    if (source === null) return null;
    const relationOverride = resolveRelationOverride(
      group.relationOverride,
      resolve
    );
    if (relationOverride === null) return null;
    if ("status" in relationOverride) return relationOverride;
    resolved.push({ relationOverride, source });
  }
  return resolved;
}

function attachSuccessorRelationOverrides(
  successors: readonly DecisionSuccessor[],
  groups: readonly DecisionRelationOverrideGroup[]
): DecisionSuccessor[] | DecisionApplicationFailure {
  const overrides = new Map<DecisionId, DecisionRelationOverride>();
  const selected = new Set(successors.map((successor) => successor.decisionId));
  for (const group of groups) {
    if (!selected.has(group.source)) {
      return decisionFailure([
        "--relations-for source is not a selected successor: " + group.source
      ]);
    }
    if (overrides.has(group.source)) {
      return decisionFailure([
        "--relations-for resolves to the same selected successor more than once: " +
          group.source
      ]);
    }
    overrides.set(group.source, group.relationOverride);
  }
  return successors.map((successor) => {
    const relationOverride = overrides.get(successor.decisionId);
    return relationOverride === undefined
      ? successor
      : { ...successor, relationOverride };
  });
}

function resolveDecisionSelector(
  scan: DecisionScan,
  selector: string
): DecisionId | DecisionApplicationFailure {
  const normalized = normalizeDecisionSelectorInput(selector);
  const dated = parseDatedDecisionId(normalized);
  const matches =
    dated === null
      ? scan.records
          .filter(
            (record) =>
              typeof record.decisionId === "string" &&
              decisionNameFromId(record.decisionId as DecisionId) === normalized
          )
          .map((record) => record.decisionId as DecisionId)
          .sort()
      : scan.records
          .filter((record) => record.decisionId === dated.id)
          .map((record) => record.decisionId as DecisionId);
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

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
  const discardId =
    request.discardId === null ? null : resolution.one(request.discardId);
  const successors = resolveSuccessors(request.successors, resolution.one);
  if (successors === null || resolution.failures.length > 0)
    return selectorResolutionFailure(resolution);
  if (request.discardId !== null && discardId === null)
    return selectorResolutionFailure(resolution);
  return {
    request: { ...request, discardId, relationOverride, successors },
    status: "ok"
  } as const;
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

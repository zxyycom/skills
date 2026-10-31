import type { RunResult } from "@zxyycom/vibe-check";
import { baseGateImpactContracts } from "../impact/impact-catalog.ts";
import { vibeNativeCheckIds } from "../checks/native.ts";
import {
  gateCodeToolIds,
  gateMetricToolIds,
  type GateToolId
} from "../impact/impact-tools.ts";
import { isQuickGateCheck } from "./profiles.ts";

export type GateSelectedOutcome = Readonly<{
  requestedScopes: readonly GateToolId[];
  eligibleCheckIds: readonly string[];
  executedCheckIds: readonly string[];
  dependencyCheckIds: readonly string[];
}>;

// 只投影原生结算事实用于诊断，不计算执行计划或替代 flag / dependsOn 选择。
export function summarizeSelectedGateOutcome(
  result: RunResult,
  requestedScopes: readonly GateToolId[]
): GateSelectedOutcome | null {
  if (!("snapshot" in result)) return null;
  const directCheckIds = new Set(
    baseGateImpactContracts
      .filter(({ toolIds }) =>
        toolIds.some((toolId) => requestedScopes.includes(toolId))
      )
      .map(({ checkId }) => checkId)
  );
  if (requestedScopes.includes("repository-code")) {
    for (const checkId of vibeNativeCheckIds) directCheckIds.add(checkId);
  }
  if (requestedScopes.some((scope) => gateCodeToolIds.includes(scope))) {
    for (const checkId of [
      "script:typecheck",
      "script:lint",
      "script:format:check"
    ])
      directCheckIds.add(checkId);
  }
  if (requestedScopes.some((scope) => gateMetricToolIds.includes(scope))) {
    directCheckIds.add("file-metrics");
    directCheckIds.add("function-metrics");
  }
  const eligibleCheckIds = result.snapshot.checks
    .filter(
      ({ outcome }) =>
        outcome.status !== "not-applicable" ||
        outcome.reason?.code !== "flag-condition-not-matched"
    )
    .map(({ checkId }) => checkId);
  return {
    requestedScopes,
    eligibleCheckIds,
    executedCheckIds: result.checkDurations
      .filter(({ durationMs }) => durationMs !== null)
      .map(({ checkId }) => checkId),
    dependencyCheckIds: eligibleCheckIds.filter(
      (checkId) => !isQuickGateCheck(checkId) && !directCheckIds.has(checkId)
    )
  };
}

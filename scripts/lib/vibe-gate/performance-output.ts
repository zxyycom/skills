import fs from "node:fs/promises";
import path from "node:path";
import type { RunResult } from "@zxyycom/vibe-check";
import type { GateActivationPlan } from "./impact-activation.ts";
import { gateCheckIds, releaseRequiredCheckIds } from "./definition.ts";
import {
  isQuickGateCheck,
  quickGateCheckIds,
  type GateScope
} from "./profiles.ts";
import {
  evaluateGatePerformance,
  type GatePerformanceReport
} from "./performance.ts";

type GatePerformanceOutputOptions = Readonly<{
  invocationDirectory: string;
  scope: GateScope;
  requestedScope: GateScope;
  activationPlan: GateActivationPlan | null;
  forceFullExecution: boolean;
  result: RunResult;
  startedAt: number;
  nowMilliseconds: () => number;
  reportInfo: (message: string) => void;
  reportError: (message: string) => void;
  writeSummary?: (summaryPath: string, content: string) => Promise<void>;
}>;

// 项目性能收尾只消费原生事实，不修改 aggregate 或把终态 effect 当投票器。
export async function reportGatePerformance(
  options: GatePerformanceOutputOptions
): Promise<GatePerformanceReport | null> {
  const {
    invocationDirectory,
    scope,
    requestedScope,
    activationPlan,
    forceFullExecution,
    result,
    startedAt,
    nowMilliseconds,
    reportInfo,
    reportError
  } = options;
  const performanceInput = {
    enforceBudget: scope === "quick",
    checkDurations: "checkDurations" in result ? result.checkDurations : null
  };
  let performanceReport = evaluateGatePerformance({
    ...performanceInput,
    totalWallClockMs: nowMilliseconds() - startedAt
  });
  const selectedDecisions =
    activationPlan?.decisions.filter(
      ({ checkId }) => scope !== "quick" || isQuickGateCheck(checkId)
    ) ?? [];
  const eligible =
    scope === "quick"
      ? quickGateCheckIds.length
      : scope === "release"
        ? gateCheckIds().length
        : releaseRequiredCheckIds.length;
  const reused = forceFullExecution
    ? 0
    : selectedDecisions.filter(({ action }) => action === "reuse").length;
  const summaryPath = path.join(
    invocationDirectory,
    "machine",
    "gate-performance.json"
  );
  const writePerformanceReport = async (
    samplingPoint: "before-performance-report" | "after-performance-report"
  ) => {
    const content = `${JSON.stringify(
      {
        requestedScope,
        effectiveScope: scope,
        selection: {
          basis: "planned-activation-before-run",
          eligible,
          execute: eligible - reused,
          reuse: reused,
          disabled: gateCheckIds().length - eligible
        },
        nativeResult: {
          kind: result.kind,
          aggregate: "aggregate" in result ? result.aggregate : null
        },
        timingBoundary: {
          start: "runVibeCheck-entry-before-input-collection",
          end: samplingPoint,
          excludes:
            "module-loading-before-entry; final-report-write-and-return-after-last-sample"
        },
        performance: performanceReport
      },
      null,
      2
    )}\n`;
    if (options.writeSummary !== undefined) {
      await options.writeSummary(summaryPath, content);
    } else {
      await fs.mkdir(path.dirname(summaryPath), { recursive: true });
      await fs.writeFile(summaryPath, content);
    }
  };
  try {
    await writePerformanceReport("before-performance-report");
    if (scope === "quick" && performanceReport.passed) {
      performanceReport = evaluateGatePerformance({
        ...performanceInput,
        totalWallClockMs: nowMilliseconds() - startedAt
      });
      if (!performanceReport.passed)
        await writePerformanceReport("after-performance-report");
    }
    reportInfo(`Vibe Check performance summary: ${summaryPath}`);
  } catch {
    reportError(
      "Vibe Check performance summary could not be completed; performance reporting is unavailable."
    );
    return null;
  }
  reportInfo(
    `Vibe Check performance: wall ${performanceReport.totalWallClockMs ?? "N/A"} ms; P90 ${performanceReport.p90Ms ?? "N/A"} ms; mean ${performanceReport.meanMs ?? "N/A"} ms; ${performanceReport.sampleCount} executed samples; budget ${performanceReport.enforceBudget ? (performanceReport.passed ? "passed" : "failed") : "not enforced"}.`
  );
  return performanceReport;
}

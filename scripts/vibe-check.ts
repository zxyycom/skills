import process from "node:process";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { run } from "@zxyycom/vibe-check";
import type {
  ProjectDefinition,
  RunControls,
  RunResult
} from "@zxyycom/vibe-check";
import { isMainModule } from "../tools/shared/src/node/main-module.ts";
import { rootDir } from "./lib/project.ts";
import { gateInputClosureDiagnostic } from "./lib/vibe-gate/diagnostics.ts";
import {
  createGateDefinition,
  commandText,
  semanticGateChecks,
  gateEnvironmentCheckId,
  releaseRequiredPackageScripts,
  gateActivationFlags,
  prepareGateActivation,
  publishGateReceipts,
  type GateActivationPlan,
  type GateCommand,
  type GateDefinitionDependencies,
  type GateReceiptPublication
} from "./lib/vibe-gate.ts";

import {
  createGateInvocationDirectory,
  gateInvocationOutputControls,
  resolveGateInvocation,
  type GateInvocation
} from "./vibe-check-invocation.ts";

export {
  createGateInvocationDirectory,
  gateInvocationOutputControls,
  resolveGateInvocation
} from "./vibe-check-invocation.ts";
export type { GateInvocation } from "./vibe-check-invocation.ts";

import { reportGatePerformance } from "./lib/vibe-gate/performance-output.ts";
import {
  describeActivationPlan,
  reportGateActivationOutcome
} from "./lib/vibe-gate/activation-output.ts";

type GateExitCode = 0 | 1;

export type VibeCheckDependencies = Readonly<{
  continuousIntegration?: boolean;
  nowMilliseconds?: () => number;
  writePerformanceSummary?: (
    summaryPath: string,
    content: string
  ) => Promise<void>;
  createDefinition?: (
    invocation: GateInvocation,
    activationPlan: GateActivationPlan | null,
    definitionDependencies: GateDefinitionDependencies
  ) => ProjectDefinition;
  createInvocationDirectory?: () => string;
  prepareActivation?:
    | false
    | ((invocation: GateInvocation) => Promise<GateActivationPlan>);
  publishReceipts?: (
    plan: GateActivationPlan,
    result: Readonly<{
      runSucceeded: boolean;
      passedCheckIds: ReadonlySet<string>;
    }>
  ) => Promise<GateReceiptPublication>;
  reportError?: (message: string) => void;
  reportInfo?: (message: string) => void;
  runProject?: (
    definition: ProjectDefinition,
    controls: RunControls
  ) => Promise<RunResult>;
}>;

function describeInvocationFailure(
  result: Exclude<RunResult, { readonly kind: "completed" }>
): string {
  switch (result.kind) {
    case "cancelled":
      return `cancelled during ${result.phase}`;
    case "configuration":
      return `${result.diagnostic.kind} at ${result.diagnostic.path}: ${result.diagnostic.reason}`;
    case "execution":
    case "output":
    case "planning":
      return `${result.kind}: ${result.diagnostic.code}`;
  }
}

function passedCheckIds(result: RunResult): ReadonlySet<string> {
  if (!("snapshot" in result)) return new Set();
  return new Set(
    result.snapshot.checks
      .filter(({ outcome }) => outcome.status === "passed")
      .map(({ checkId }) => checkId)
  );
}

function isContinuousIntegrationEnvironment(
  value: string | undefined
): boolean {
  return value !== undefined && value !== "" && value !== "false";
}

export async function runVibeCheck(
  argv: readonly string[] = process.argv.slice(2),
  dependencies: VibeCheckDependencies = {}
): Promise<GateExitCode> {
  const nowMilliseconds =
    dependencies.nowMilliseconds ?? (() => performance.now());
  const startedAt = nowMilliseconds();
  const reportError = dependencies.reportError ?? console.error;
  const reportInfo = dependencies.reportInfo ?? console.log;
  const requestedInvocation = resolveGateInvocation(argv);
  const invocation =
    requestedInvocation === null
      ? null
      : {
          ...requestedInvocation,
          scope:
            (dependencies.continuousIntegration ??
              isContinuousIntegrationEnvironment(process.env.CI)) &&
            requestedInvocation.scope !== "release"
              ? ("full" as const)
              : requestedInvocation.scope
        };
  if (invocation === null) {
    reportError(
      "Usage: bun run check [--scope quick|changed|full] [--tag release] [--baseline-ref <ref>] [--cold] [--diagnostic-log] (compatibility: --full is --tag release)"
    );
    return 1;
  }

  // 嵌套包脚本会重复追加 PATH；实际子进程与输入证明共同使用同一搜索顺序。
  if (process.env.PATH !== undefined) {
    process.env.PATH = [
      ...new Set(process.env.PATH.split(path.delimiter))
    ].join(path.delimiter);
  }

  const forceFullExecution =
    invocation.scope === "full" ||
    invocation.tags.includes("release") ||
    invocation.cold ||
    (dependencies.continuousIntegration ??
      isContinuousIntegrationEnvironment(process.env.CI));
  const activationPlan =
    dependencies.prepareActivation === false
      ? null
      : await (dependencies.prepareActivation?.(invocation) ??
          prepareGateActivation({
            release: forceFullExecution
          }));
  const unclosedInputs =
    activationPlan?.kind === "incremental"
      ? gateInputClosureDiagnostic(activationPlan.snapshot)
      : null;
  if (activationPlan !== null)
    reportInfo(
      describeActivationPlan(activationPlan, unclosedInputs, invocation.scope)
    );
  reportInfo(
    `Vibe Check scope: ${invocation.scope}${invocation.scope === "quick" ? "; quick success does not replace bun run check:changed acceptance" : ""}.`
  );
  const definitionDependencies: GateDefinitionDependencies = {
    scope: invocation.scope,
    ...(!forceFullExecution && activationPlan?.kind === "incremental"
      ? { activeToolIds: activationPlan.activeToolIds }
      : {}),
    ...(invocation.baselineRef === undefined
      ? {}
      : { baselineRef: invocation.baselineRef })
  };
  const definition =
    dependencies.createDefinition?.(
      invocation,
      activationPlan,
      definitionDependencies
    ) ?? createGateDefinition(invocation.tags, definitionDependencies);
  const invocationDirectory =
    dependencies.createInvocationDirectory?.() ??
    createGateInvocationDirectory();
  let result: RunResult;
  try {
    result = await (dependencies.runProject ?? run)(definition, {
      flags: [
        ...invocation.tags,
        ...(!forceFullExecution && activationPlan?.kind === "incremental"
          ? gateActivationFlags(activationPlan)
          : [])
      ],
      ...gateInvocationOutputControls(
        invocationDirectory,
        invocation.diagnosticLog
      ),
      projectRoot: rootDir
    });
  } catch {
    reportError(
      "Vibe Check invocation rejected; no success receipts were published. Rerun the same Gate command and inspect invocation diagnostics."
    );
    return 1;
  }

  if ("outputs" in result) {
    reportInfo(`Vibe Check artifacts: ${invocationDirectory}`);
    if (invocation.diagnosticLog) {
      for (const channel of ["core", "scheduler"] as const) {
        const status = result.outputs.diagnosticLogging.channels[channel];
        if (status.status === "succeeded" && status.file !== null) {
          reportInfo(`Vibe Check diagnostic log (${channel}): ${status.file}`);
        }
      }
    }
  }
  if ("snapshot" in result) {
    for (const check of result.snapshot.checks) {
      if (
        check.outcome.status === "passed" ||
        check.outcome.status === "not-applicable"
      )
        continue;
      let command: GateCommand | undefined;
      if (check.checkId === gateEnvironmentCheckId) {
        command = { command: "node", args: ["scripts/environment.js", "gate"] };
      } else {
        command = semanticGateChecks.find(
          (candidate) => candidate.checkId === check.checkId
        )?.command;
        if (command === undefined) {
          const script = releaseRequiredPackageScripts.find(
            (candidate) => `script:${candidate}` === check.checkId
          );
          if (script !== undefined)
            command = { command: "bun", args: ["run", script] };
        }
      }
      if (command !== undefined)
        reportError(
          `${check.checkId}: rerun ${commandText(command)} from ${rootDir}. Full command transcripts: ${path.join(invocationDirectory, "checks")}/**/process.log.`
        );
    }
  }
  if (activationPlan !== null) {
    const publicationResult = {
      runSucceeded:
        result.kind === "completed" && result.aggregate === "passed",
      passedCheckIds: passedCheckIds(result)
    };
    const publication =
      invocation.scope === "quick"
        ? { published: false as const, reason: "quick-scope" as const }
        : await (dependencies.publishReceipts?.(
            activationPlan,
            publicationResult
          ) ?? publishGateReceipts(activationPlan, publicationResult));
    await reportGateActivationOutcome({
      plan: activationPlan,
      scope: invocation.scope,
      invocationDirectory,
      unclosedInputs,
      publication,
      reportInfo
    });
  }
  const performanceReport = await reportGatePerformance({
    invocationDirectory,
    scope: invocation.scope,
    requestedScope: requestedInvocation?.scope ?? invocation.scope,
    activationPlan,
    forceFullExecution,
    result,
    startedAt,
    nowMilliseconds,
    reportInfo,
    reportError,
    ...(dependencies.writePerformanceSummary === undefined
      ? {}
      : { writeSummary: dependencies.writePerformanceSummary })
  });
  if (performanceReport === null && invocation.scope === "quick") return 1;
  if (result.kind !== "completed") {
    reportError(
      "Vibe Check invocation failed: " +
        `${describeInvocationFailure(result)}. ` +
        "Fix the reported invocation boundary and rerun the same Gate command."
    );
    return 1;
  }
  if (result.aggregate !== "passed") {
    reportError(
      "Vibe Check gate failed: " +
        `${result.aggregate ?? "no aggregate"}. ` +
        "Fix the failed or unavailable check and rerun the same Gate command."
    );
    return 1;
  }
  if (performanceReport !== null && !performanceReport.passed) {
    reportError(
      "Vibe Check quick performance budget failed or measurement unavailable; native Check outcomes are unchanged."
    );
    return 1;
  }
  return 0;
}

if (isMainModule(import.meta.url)) {
  try {
    process.exitCode = await runVibeCheck();
  } catch (error) {
    console.error(
      error instanceof Error ? (error.stack ?? error.message) : String(error)
    );
    process.exitCode = 1;
  }
}

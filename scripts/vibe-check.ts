import process from "node:process";
import fs from "node:fs/promises";
import path from "node:path";
import { run } from "@zxyycom/vibe-check";
import type {
  ProjectDefinition,
  RunControls,
  RunResult
} from "@zxyycom/vibe-check";
import { isMainModule } from "../tools/shared/src/node/main-module.ts";
import { rootDir } from "./lib/project.ts";
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

type GateExitCode = 0 | 1;

export type VibeCheckDependencies = Readonly<{
  continuousIntegration?: boolean;
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

type GateIncrementalSummary = Readonly<{
  counts: GateActivationCounts;
  activeToolIds: readonly string[];
  decisions: GateActivationPlan["decisions"];
  fallbackDetail: string | null;
  mode: GateActivationPlan["kind"];
  publication: GateReceiptPublication;
}>;

type GateActivationCounts = Readonly<{
  execute: number;
  fallback: number;
  firstRun: number;
  reuse: number;
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

function activationCounts(plan: GateActivationPlan): GateActivationCounts {
  const execute = plan.decisions.filter(
    ({ action }) => action === "execute"
  ).length;
  const reuse = plan.decisions.length - execute;
  const firstRun = plan.decisions.filter(
    ({ reason }) => reason === "first-run"
  ).length;
  const fallback = plan.decisions.filter(({ reason }) =>
    ["cache-invalid", "conservative-fallback", "snapshot-unavailable"].includes(
      reason
    )
  ).length;
  return { execute, fallback, firstRun, reuse };
}

function describeActivationPlan(plan: GateActivationPlan): string {
  const counts = activationCounts(plan);
  const summary = `Vibe Check plan: ${plan.kind}; execute ${counts.execute}, reuse ${counts.reuse}, fallback ${counts.fallback}, first-run ${counts.firstRun}.`;
  return plan.kind === "fallback"
    ? `${summary} Snapshot fallback: ${plan.fallbackDetail}.`
    : summary;
}

async function writeIncrementalSummary(
  invocationDirectory: string,
  summary: GateIncrementalSummary
): Promise<string> {
  const summaryPath = path.join(
    invocationDirectory,
    "machine",
    "gate-incremental.json"
  );
  await fs.mkdir(path.dirname(summaryPath), { recursive: true });
  await fs.writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
  return summaryPath;
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
  const reportError = dependencies.reportError ?? console.error;
  const reportInfo = dependencies.reportInfo ?? console.log;
  const invocation = resolveGateInvocation(argv);
  if (invocation === null) {
    reportError(
      "Usage: bun run check [--tag release] [--baseline-ref <ref>] [--cold] [--diagnostic-log] (compatibility: --full is --tag release)"
    );
    return 1;
  }

  const forceFullExecution =
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
  if (activationPlan !== null)
    reportInfo(describeActivationPlan(activationPlan));
  const definitionDependencies: GateDefinitionDependencies = {
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
      "Vibe Check invocation rejected; no success receipts were published. Rerun bun run check and inspect invocation diagnostics."
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
    const publication = await (dependencies.publishReceipts?.(
      activationPlan,
      publicationResult
    ) ?? publishGateReceipts(activationPlan, publicationResult));
    try {
      const summaryPath = await writeIncrementalSummary(invocationDirectory, {
        counts: activationCounts(activationPlan),
        activeToolIds: activationPlan.activeToolIds,
        decisions: activationPlan.decisions,
        fallbackDetail:
          activationPlan.kind === "fallback"
            ? activationPlan.fallbackDetail
            : null,
        mode: activationPlan.kind,
        publication
      });
      reportInfo(`Vibe Check incremental summary: ${summaryPath}`);
    } catch {
      reportInfo(
        "Vibe Check incremental summary unavailable; Gate outcomes are unchanged."
      );
    }
    if (!publication.published) {
      if (publication.reason === "workspace-drift") {
        reportInfo(
          "Vibe Check receipts not published because the workspace changed during the run."
        );
      } else if ("detail" in publication) {
        reportInfo(
          `Vibe Check receipts not published (${publication.reason}): ${publication.detail}.`
        );
      }
    }
  }
  if (result.kind !== "completed") {
    reportError(
      "Vibe Check invocation failed: " +
        `${describeInvocationFailure(result)}. ` +
        "Fix the reported invocation boundary and rerun bun run check."
    );
    return 1;
  }
  if (result.aggregate !== "passed") {
    reportError(
      "Vibe Check gate failed: " +
        `${result.aggregate ?? "no aggregate"}. ` +
        "Fix the failed or unavailable check and rerun bun run check."
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

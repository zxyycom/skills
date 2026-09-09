import process from "node:process";
import { randomUUID } from "node:crypto";
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
  gateActivationFlags,
  gateTags,
  isReleaseBaselineRef,
  normalizeGateTags,
  prepareGateActivation,
  publishGateReceipts,
  type GateActivationPlan,
  type GateDefinitionDependencies,
  type GateReceiptPublication,
  type GateTag
} from "./lib/vibe-gate.ts";

type GateExitCode = 0 | 1;

export type GateInvocation = Readonly<{
  baselineRef?: string;
  cold: boolean;
  diagnosticLog: boolean;
  tags: readonly GateTag[];
}>;

type GateInvocationParserState = {
  baselineRef: string | undefined;
  cold: boolean;
  diagnosticLog: boolean;
  tags: GateTag[];
};

export type VibeCheckDependencies = Readonly<{
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
    passedCheckIds: ReadonlySet<string>
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
  decisions: GateActivationPlan["decisions"];
  fallbackDetail: string | null;
  mode: GateActivationPlan["kind"];
  publication: GateReceiptPublication;
  releaseTestBatchProof: "cold" | "fresh" | "reused" | "unavailable" | null;
}>;

type GateActivationCounts = Readonly<{
  execute: number;
  fallback: number;
  firstRun: number;
  reuse: number;
}>;

export function createGateInvocationDirectory(
  workspaceRoot: string = rootDir,
  now: Date = new Date(),
  uuid: string = randomUUID()
): string {
  const timestamp = now.toISOString().replaceAll(/[-:.]/gu, "");
  return path.join(
    workspaceRoot,
    ".log/vibe-check/invocations",
    `${timestamp}-${uuid}`
  );
}

export function gateInvocationOutputControls(
  invocationDirectory: string,
  diagnosticLog: boolean
): Pick<
  RunControls,
  | "checkArtifactBaseDirectory"
  | "diagnosticLogFileNaming"
  | "outputs"
  | "progressLogFile"
> {
  return {
    checkArtifactBaseDirectory: path.join(invocationDirectory, "checks"),
    diagnosticLogFileNaming: "channel",
    outputs: {
      diagnosticLogging: {
        directory: path.join(invocationDirectory, "diagnostics"),
        enabled: diagnosticLog
      },
      machinePublication: {
        directory: path.join(invocationDirectory, "machine"),
        enabled: true
      }
    },
    progressLogFile: path.join(invocationDirectory, "progress.log")
  };
}

function isGateTag(value: string | undefined): value is GateTag {
  return gateTags.some((tag) => tag === value);
}

function appendGateTag(tags: GateTag[], value: string | undefined): boolean {
  if (!isGateTag(value) || tags.includes(value)) {
    return false;
  }
  tags.push(value);
  return true;
}

function enableDiagnosticLog(state: GateInvocationParserState): 0 | null {
  if (state.diagnosticLog) {
    return null;
  }
  state.diagnosticLog = true;
  return 0;
}

function enableCold(state: GateInvocationParserState): 0 | null {
  if (state.cold) return null;
  state.cold = true;
  return 0;
}

function setBaselineRef(
  state: GateInvocationParserState,
  value: string | undefined
): 1 | null {
  if (state.baselineRef !== undefined || !isReleaseBaselineRef(value)) {
    return null;
  }
  state.baselineRef = value;
  return 1;
}

function applyGateArgument(
  state: GateInvocationParserState,
  argument: string | undefined,
  value: string | undefined
): 0 | 1 | null {
  switch (argument) {
    case "--tag":
      return appendGateTag(state.tags, value) ? 1 : null;
    case "--full":
      return appendGateTag(state.tags, "release") ? 0 : null;
    case "--diagnostic-log":
      return enableDiagnosticLog(state);
    case "--cold":
      return enableCold(state);
    case "--baseline-ref":
      return setBaselineRef(state, value);
    default:
      return null;
  }
}

export function resolveGateInvocation(
  argv: readonly string[]
): GateInvocation | null {
  const state: GateInvocationParserState = {
    baselineRef: undefined,
    cold: false,
    diagnosticLog: false,
    tags: []
  };
  for (let index = 0; index < argv.length; index += 1) {
    const consumed = applyGateArgument(state, argv[index], argv[index + 1]);
    if (consumed === null) {
      return null;
    }
    index += consumed;
  }
  const normalizedTags = normalizeGateTags(state.tags);
  if (
    (state.baselineRef !== undefined || state.cold) &&
    !normalizedTags.includes("release")
  ) {
    return null;
  }
  return {
    ...(normalizedTags.includes("release")
      ? { baselineRef: state.baselineRef ?? "HEAD" }
      : {}),
    cold: state.cold,
    diagnosticLog: state.diagnosticLog,
    tags: normalizedTags
  };
}

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

  const activationPlan =
    dependencies.prepareActivation === false
      ? null
      : await (dependencies.prepareActivation?.(invocation) ??
          prepareGateActivation({
            release: invocation.tags.includes("release")
          }));
  if (activationPlan !== null)
    reportInfo(describeActivationPlan(activationPlan));
  let releaseTestBatchProofReused = false;
  const releaseTestBatchProofCold =
    invocation.cold ||
    (process.env.CI !== undefined &&
      process.env.CI !== "" &&
      process.env.CI !== "false");
  const definitionDependencies: GateDefinitionDependencies = {
    ...(invocation.baselineRef === undefined
      ? activationPlan?.kind === "incremental"
        ? { activeCheckIds: activationPlan.activeCheckIds }
        : {}
      : { baselineRef: invocation.baselineRef }),
    ...(activationPlan?.kind === "release" && activationPlan.snapshot !== null
      ? {
          releaseTestBatchProof: {
            cacheDirectory: path.join(
              path.dirname(activationPlan.cacheDirectory),
              "release-test-batch-v1"
            ),
            cold: releaseTestBatchProofCold,
            initialWorkspaceFingerprint:
              activationPlan.snapshot.workspaceFingerprint,
            onReuse: () => {
              releaseTestBatchProofReused = true;
            }
          }
        }
      : {})
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
  const result = await (dependencies.runProject ?? run)(definition, {
    checkAggregation: {
      checks: "effective",
      empty:
        activationPlan?.kind === "incremental" &&
        activationPlan.activeCheckIds.length === 0
          ? "passed"
          : "failed",
      mode: "all",
      notApplicable: "fail",
      unavailable: "fail"
    },
    flags: [
      ...invocation.tags,
      ...(activationPlan?.kind === "incremental"
        ? gateActivationFlags(activationPlan)
        : [])
    ],
    ...gateInvocationOutputControls(
      invocationDirectory,
      invocation.diagnosticLog
    ),
    projectRoot: rootDir
  });

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
  if (activationPlan !== null) {
    const releaseTestBatchProof =
      activationPlan.kind !== "release"
        ? null
        : activationPlan.snapshot === null
          ? "unavailable"
          : releaseTestBatchProofReused
            ? "reused"
            : releaseTestBatchProofCold
              ? "cold"
              : "fresh";
    const publication =
      result.kind === "completed" && result.aggregate === "passed"
        ? await (dependencies.publishReceipts?.(
            activationPlan,
            passedCheckIds(result)
          ) ?? publishGateReceipts(activationPlan, passedCheckIds(result)))
        : ({ published: false, reason: "check-not-passed" } as const);
    try {
      const summaryPath = await writeIncrementalSummary(invocationDirectory, {
        counts: activationCounts(activationPlan),
        decisions: activationPlan.decisions,
        fallbackDetail:
          activationPlan.kind === "fallback"
            ? activationPlan.fallbackDetail
            : null,
        mode: activationPlan.kind,
        publication,
        releaseTestBatchProof
      });
      reportInfo(`Vibe Check incremental summary: ${summaryPath}`);
      if (releaseTestBatchProof === "reused") {
        reportInfo(
          "Vibe Check reused the exact release test batch proof; no batched test process ran in this invocation."
        );
      } else if (releaseTestBatchProof === "cold") {
        reportInfo(
          "Vibe Check release test batch ran cold; a matching proof was not reused."
        );
      }
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

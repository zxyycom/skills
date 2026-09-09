import process from "node:process";
import { randomUUID } from "node:crypto";
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
  gateTags,
  isReleaseBaselineRef,
  normalizeGateTags,
  type GateTag
} from "./lib/vibe-gate.ts";

type GateExitCode = 0 | 1;

export type GateInvocation = Readonly<{
  baselineRef?: string;
  diagnosticLog: boolean;
  tags: readonly GateTag[];
}>;

type GateInvocationParserState = {
  baselineRef: string | undefined;
  diagnosticLog: boolean;
  tags: GateTag[];
};

export type VibeCheckDependencies = Readonly<{
  createDefinition?: (invocation: GateInvocation) => ProjectDefinition;
  createInvocationDirectory?: () => string;
  reportError?: (message: string) => void;
  reportInfo?: (message: string) => void;
  runProject?: (
    definition: ProjectDefinition,
    controls: RunControls
  ) => Promise<RunResult>;
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
  if (state.baselineRef !== undefined && !normalizedTags.includes("release")) {
    return null;
  }
  return {
    ...(normalizedTags.includes("release")
      ? { baselineRef: state.baselineRef ?? "HEAD" }
      : {}),
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

export async function runVibeCheck(
  argv: readonly string[] = process.argv.slice(2),
  dependencies: VibeCheckDependencies = {}
): Promise<GateExitCode> {
  const reportError = dependencies.reportError ?? console.error;
  const reportInfo = dependencies.reportInfo ?? console.log;
  const invocation = resolveGateInvocation(argv);
  if (invocation === null) {
    reportError(
      "Usage: bun run check [--tag release] [--baseline-ref <ref>] [--diagnostic-log] (compatibility: --full is --tag release)"
    );
    return 1;
  }

  const definition =
    dependencies.createDefinition?.(invocation) ??
    createGateDefinition(
      invocation.tags,
      invocation.baselineRef === undefined
        ? {}
        : { baselineRef: invocation.baselineRef }
    );
  const invocationDirectory =
    dependencies.createInvocationDirectory?.() ??
    createGateInvocationDirectory();
  const result = await (dependencies.runProject ?? run)(definition, {
    checkAggregation: {
      checks: "effective",
      empty: "failed",
      mode: "all",
      notApplicable: "fail",
      unavailable: "fail"
    },
    flags: invocation.tags,
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

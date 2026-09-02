import process from "node:process";
import { run } from "@zxyycom/vibe-check";
import type { ProjectDefinition, RunResult } from "@zxyycom/vibe-check";
import { isMainModule } from "../tools/shared/src/node/main-module.ts";
import { rootDir } from "./lib/project.ts";
import {
  activeGateCheckIds,
  createGateDefinition,
  gateTags,
  isReleaseBaselineRef,
  normalizeGateTags,
  type GateTag
} from "./lib/vibe-gate.ts";
import {
  createGateSchedulingHints,
  type GateSchedulingHints
} from "./lib/vibe-scheduling-hints.ts";

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
  reportError?: (message: string) => void;
  reportInfo?: (message: string) => void;
  runProject?: typeof run;
  schedulingHints?: GateSchedulingHints;
}>;

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

  const selectedCheckIds = activeGateCheckIds(invocation.tags);
  const schedulingHints =
    dependencies.schedulingHints ?? createGateSchedulingHints(rootDir);
  const durationHints = await schedulingHints
    .read(invocation.tags, selectedCheckIds)
    .catch(() => new Map<string, number>());
  const definition =
    dependencies.createDefinition?.(invocation) ??
    createGateDefinition(
      invocation.tags,
      invocation.baselineRef === undefined
        ? { durationHints }
        : { baselineRef: invocation.baselineRef, durationHints }
    );
  const result = await (dependencies.runProject ?? run)(definition, {
    checkAggregation: {
      checks: selectedCheckIds,
      empty: "failed",
      mode: "all",
      notApplicable: "fail",
      unavailable: "fail"
    },
    flags: invocation.tags,
    ...(invocation.diagnosticLog
      ? {
          outputs: {
            diagnosticLogging: {
              directory: ".log/vibe-check",
              enabled: true
            }
          }
        }
      : {}),
    projectRoot: rootDir
  });

  if (result.kind === "completed" && result.aggregate === "passed") {
    await schedulingHints
      .write(invocation.tags, selectedCheckIds, result.checkDurations)
      .catch(() => undefined);
  }

  if (
    invocation.diagnosticLog &&
    "outputs" in result &&
    result.outputs.diagnosticLogging.file !== null
  ) {
    reportInfo(
      `Vibe Check diagnostic log: ${result.outputs.diagnosticLogging.file}`
    );
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

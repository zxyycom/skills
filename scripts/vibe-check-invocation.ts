import { randomUUID } from "node:crypto";
import path from "node:path";
import type { RunControls } from "@zxyycom/vibe-check";
import { rootDir } from "./lib/project.ts";
import {
  gateTags,
  isReleaseBaselineRef,
  normalizeGateTags,
  type GateTag
} from "./lib/vibe-gate.ts";

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

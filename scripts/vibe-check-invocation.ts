import { randomUUID } from "node:crypto";
import path from "node:path";
import type { RunControls } from "@zxyycom/vibe-check";
import {
  isGateScope,
  isGateSelectionScope,
  type GateScope
} from "./lib/vibe-gate/profiles.ts";
import type { GateToolId } from "./lib/vibe-gate/impact-tools.ts";
import { rootDir } from "./lib/project.ts";
import {
  gateTags,
  isReleaseBaselineRef,
  normalizeGateTags,
  type GateTag
} from "./lib/vibe-gate.ts";

export type GateInvocation = Readonly<{
  baselineRef?: string;
  listScopes?: true;
  cold: boolean;
  diagnosticLog: boolean;
  tags: readonly GateTag[];
}> &
  (
    | Readonly<{ scope: "selected"; selectionScopes: readonly GateToolId[] }>
    | Readonly<{
        scope: Exclude<GateScope, "selected">;
        selectionScopes?: never;
      }>
  );

type GateInvocationParserState = {
  scope: Exclude<GateScope, "release" | "selected"> | undefined;
  selectionScopes: GateToolId[];
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

function setGateScope(
  state: GateInvocationParserState,
  value: string | undefined
): 1 | null {
  if (isGateSelectionScope(value)) {
    if (state.scope !== undefined) return null;
    if (!state.selectionScopes.includes(value))
      state.selectionScopes.push(value);
    return 1;
  }
  if (
    state.scope !== undefined ||
    state.selectionScopes.length > 0 ||
    !isGateScope(value) ||
    value === "release" ||
    value === "selected"
  ) {
    return null;
  }
  state.scope = value;
  return 1;
}

function applyGateArgument(
  state: GateInvocationParserState,
  argument: string | undefined,
  value: string | undefined
): 0 | 1 | null {
  if (argument === "--scope") return setGateScope(state, value);
  if (argument === "--tag") {
    return appendGateTag(state.tags, value) ? 1 : null;
  }
  if (argument === "--full") {
    return appendGateTag(state.tags, "release") ? 0 : null;
  }
  if (argument === "--diagnostic-log") {
    return enableDiagnosticLog(state);
  }
  if (argument === "--cold") {
    return enableCold(state);
  }
  if (argument === "--baseline-ref") {
    return setBaselineRef(state, value);
  }
  return null;
}

function finalizeGateInvocation(
  state: GateInvocationParserState
): GateInvocation | null {
  const normalizedTags = normalizeGateTags(state.tags);
  if (
    (state.scope !== undefined || state.selectionScopes.length > 0) &&
    normalizedTags.includes("release")
  )
    return null;
  if (
    (state.baselineRef !== undefined || state.cold) &&
    !normalizedTags.includes("release")
  ) {
    return null;
  }
  const options = {
    ...(normalizedTags.includes("release")
      ? { baselineRef: state.baselineRef ?? "HEAD" }
      : {}),
    cold: state.cold,
    diagnosticLog: state.diagnosticLog,
    tags: normalizedTags
  };
  if (normalizedTags.includes("release"))
    return { ...options, scope: "release" };
  if (state.selectionScopes.length > 0)
    return {
      ...options,
      scope: "selected",
      selectionScopes: state.selectionScopes
    };
  return { ...options, scope: state.scope ?? "quick" };
}

export function resolveGateInvocation(
  argv: readonly string[]
): GateInvocation | null {
  const arguments_ = argv[0] === "--" ? argv.slice(1) : argv;
  if (arguments_.length === 1 && arguments_[0] === "--list-scopes") {
    return {
      scope: "quick",
      cold: false,
      diagnosticLog: false,
      tags: [],
      listScopes: true
    };
  }
  const state: GateInvocationParserState = {
    scope: undefined,
    selectionScopes: [],
    baselineRef: undefined,
    cold: false,
    diagnosticLog: false,
    tags: []
  };
  for (let index = 0; index < arguments_.length; index += 1) {
    const consumed = applyGateArgument(
      state,
      arguments_[index],
      arguments_[index + 1]
    );
    if (consumed === null) {
      return null;
    }
    index += consumed;
  }
  return finalizeGateInvocation(state);
}

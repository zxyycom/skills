import process from "node:process";
import { run } from "@zxyycom/vibe-check";
import type { ProjectDefinition, RunResult } from "@zxyycom/vibe-check";
import { isMainModule } from "../tools/shared/src/node/main-module.ts";
import { rootDir } from "./lib/project.ts";
import {
  createGateDefinition,
  gateCheckIds,
  isReleaseBaselineRef
} from "./lib/vibe-gate.ts";
import {
  createGateSchedulingHints,
  type GateSchedulingHints
} from "./lib/vibe-scheduling-hints.ts";

type GateExitCode = 0 | 1;

export type GateInvocation =
  | Readonly<{ diagnosticLog: boolean; profile: "default" }>
  | Readonly<{
      baselineRef: string;
      diagnosticLog: boolean;
      profile: "full";
    }>;

export type VibeCheckDependencies = Readonly<{
  createDefinition?: (invocation: GateInvocation) => ProjectDefinition;
  reportError?: (message: string) => void;
  reportInfo?: (message: string) => void;
  runProject?: typeof run;
  schedulingHints?: GateSchedulingHints;
}>;

export function resolveGateInvocation(
  argv: readonly string[]
): GateInvocation | null {
  if (argv.length === 0) {
    return { diagnosticLog: false, profile: "default" };
  }

  let baselineRef: string | undefined;
  let diagnosticLog = false;
  let full = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--full" && !full) {
      full = true;
      continue;
    }
    if (argument === "--diagnostic-log" && !diagnosticLog) {
      diagnosticLog = true;
      continue;
    }
    if (argument === "--baseline-ref" && baselineRef === undefined) {
      const candidate = argv[index + 1];
      if (!isReleaseBaselineRef(candidate)) {
        return null;
      }
      baselineRef = candidate;
      index += 1;
      continue;
    }
    return null;
  }

  if (!full) {
    return baselineRef === undefined && diagnosticLog
      ? { diagnosticLog, profile: "default" }
      : null;
  }
  return { baselineRef: baselineRef ?? "HEAD", diagnosticLog, profile: "full" };
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
      "Usage: bun run check [--full [--baseline-ref <ref>]] [--diagnostic-log]"
    );
    return 1;
  }

  const knownCheckIds = gateCheckIds(invocation.profile);
  const schedulingHints =
    dependencies.schedulingHints ?? createGateSchedulingHints(rootDir);
  const durationHints = await schedulingHints
    .read(invocation.profile, knownCheckIds)
    .catch(() => new Map<string, number>());
  const definition =
    dependencies.createDefinition?.(invocation) ??
    createGateDefinition(
      invocation.profile,
      invocation.profile === "full"
        ? { baselineRef: invocation.baselineRef, durationHints }
        : { durationHints }
    );
  const result = await (dependencies.runProject ?? run)(definition, {
    checkAggregation: {
      checks: "all",
      empty: "failed",
      mode: "all",
      notApplicable: "fail",
      unavailable: "fail"
    },
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
      .write(
        invocation.profile,
        definition.checks.map(({ checkId }) => checkId),
        result.checkDurations
      )
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

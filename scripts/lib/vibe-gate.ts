import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  defaultProjectFileSelection,
  defineCheck,
  defineConfig,
  duplicateDetection,
  fileMetrics,
  functionMetrics,
  jsonSchemaValidation,
  jsonValidation,
  markdownLinkValidation
} from "@zxyycom/vibe-check";
import type { Check, ProjectDefinition } from "@zxyycom/vibe-check";
import {
  packSkillPackageSnapshot,
  prepareSkillPackageRelease,
  type PreparedSkillPackageRelease
} from "./skill-package-release.ts";

export const gateTags = ["release"] as const;

export type GateTag = (typeof gateTags)[number];

export type GateTagSet = readonly GateTag[];

export function normalizeGateTags(
  tags: readonly GateTag[]
): readonly GateTag[] {
  return [...new Set(tags)].sort();
}

export function hasGateTag(tags: GateTagSet, tag: GateTag): boolean {
  return tags.includes(tag);
}

const diagnosticOutputLimit = 4_000;

function isEstimatedDuration(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

/**
 * Reorders only active root executable Checks for Vibe's canonical-order admission.
 * Inactive Checks retain their declaration slots; invalid active declarations keep
 * the original order so Vibe still owns Definition and DAG validation.
 */
export function orderRootChecksByCriticalRank(
  checks: readonly Check[],
  durationHints: ReadonlyMap<string, number> | undefined,
  activeCheckIds: readonly string[] = checks.map(({ checkId }) => checkId)
): readonly Check[] {
  const activeIds = new Set(activeCheckIds);
  const executable = checks.flatMap((check, index) =>
    activeIds.has(check.checkId) && typeof check.execution === "function"
      ? [{ check, index }]
      : []
  );
  if (
    executable.length === 0 ||
    executable.length !== activeIds.size ||
    durationHints === undefined
  ) {
    return checks;
  }

  const executableById = new Map<string, (typeof executable)[number]>();
  for (const entry of executable) {
    if (executableById.has(entry.check.checkId)) {
      return checks;
    }
    const duration = durationHints.get(entry.check.checkId);
    if (!isEstimatedDuration(duration)) {
      return checks;
    }
    executableById.set(entry.check.checkId, entry);
  }

  const successorsById = new Map(
    executable.map(({ check }) => [check.checkId, [] as string[]])
  );
  for (const { check } of executable) {
    if (check.dependsOn === undefined) continue;
    if (!Array.isArray(check.dependsOn)) {
      return checks;
    }
    for (const dependencyId of check.dependsOn) {
      if (
        typeof dependencyId !== "string" ||
        !successorsById.has(dependencyId)
      ) {
        return checks;
      }
      successorsById.get(dependencyId)?.push(check.checkId);
    }
  }

  const ranks = new Map<string, number>();
  const visiting = new Set<string>();
  const rank = (checkId: string): number | undefined => {
    if (visiting.has(checkId)) return undefined;
    const cached = ranks.get(checkId);
    if (cached !== undefined) return cached;
    const duration = durationHints.get(checkId);
    if (!isEstimatedDuration(duration)) return undefined;
    visiting.add(checkId);
    let longestSuccessorRank = 0;
    for (const successorId of successorsById.get(checkId) ?? []) {
      const successorRank = rank(successorId);
      if (successorRank === undefined) return undefined;
      longestSuccessorRank = Math.max(longestSuccessorRank, successorRank);
    }
    visiting.delete(checkId);
    const computed = duration + longestSuccessorRank;
    ranks.set(checkId, computed);
    return computed;
  };
  for (const { check } of executable) {
    if (rank(check.checkId) === undefined) return checks;
  }

  const orderedExecutable = [...executable].sort((left, right) => {
    const rankDifference =
      (ranks.get(right.check.checkId) ?? 0) -
      (ranks.get(left.check.checkId) ?? 0);
    return rankDifference === 0 ? left.index - right.index : rankDifference;
  });
  let executableIndex = 0;
  return checks.map((check) =>
    activeIds.has(check.checkId) && typeof check.execution === "function"
      ? (orderedExecutable[executableIndex++]?.check ?? check)
      : check
  );
}

export const projectJscpdExecutable = fileURLToPath(
  new URL("./vibe-jscpd.js", import.meta.url)
);

export const projectLizardExecutable = fileURLToPath(
  new URL("./vibe-lizard.js", import.meta.url)
);

export const historicalContentExclusions = [
  "changes/archive/**",
  "docs/investigations/_resources/**"
] as const;

export const investigationAuthoringDocumentExclusions = [
  "docs/investigations/_candidate.*"
] as const;

const projectExclusions = [
  ...defaultProjectFileSelection.exclude,
  ...historicalContentExclusions
] as const;

export const maintainedCodeFiles = {
  source: "git-worktree",
  include: [
    "scripts/**/*.js",
    "scripts/**/*.ts",
    "tools/**/*.js",
    "tools/**/*.ts"
  ],
  exclude: projectExclusions
} as const;

export const maintainedDocumentFiles = {
  source: "git-worktree",
  exclude: [...projectExclusions, ...investigationAuthoringDocumentExclusions]
} as const;

const schemas = [
  {
    id: "urn:skills:task-graph-index",
    path: "skills/task-graph/references/task-graph-index.schema.json"
  },
  {
    id: "urn:skills:test-evidence-index",
    path: "skills/test-evidence-review/references/schemas/test-evidence-state-index.schema.json"
  }
] as const;

const bindings = [
  {
    id: "task-graph-index",
    instancePath: "docs/task-graph/task-graph-index.json",
    schemaId: "urn:skills:task-graph-index"
  },
  {
    id: "test-evidence-index",
    instancePath: "docs/test-evidence/test-evidence-index.json",
    schemaId: "urn:skills:test-evidence-index"
  }
] as const;

export const vibeNativeCheckIds = [
  "duplicate-detection",
  "json-validation",
  "json-schema-validation",
  "markdown-link-validation",
  "file-metrics",
  "function-metrics"
] as const;

export const compatibilityTestPackageScripts = [
  "test:decision-records-cli",
  "test:change-plan-cli",
  "test:task-graph-cli",
  "test:test-evidence-cli",
  "test:investigation-report-check"
] as const;

// Package scripts remain stable manual aggregation entry points. Gate execution
// uses the semantic test checks below instead of treating these containers as leaves.
export const releaseRequiredPackageScripts = [
  "test:environment",
  "test:index-runtime",
  "test:check",
  "test:skill-updater",
  "test:skill-validator",
  "test:relation-graph",
  "test:version-control",
  "test:skill-package-hash",
  "test:skill-release-publisher",
  "typecheck",
  "lint",
  "validate",
  "check:investigations",
  "check:decisions",
  "check:test-evidence-cli",
  "check:test-evidence-catalog",
  "check:skill-validator",
  "check:investigation-report-check",
  "check:change-plan-cli",
  "check:decision-records-cli",
  "check:task-graph-cli",
  "check:skill-updaters",
  "test:generated-file",
  "format:check",
  "check:task-graph-index"
] as const;

export type GatePackageScript = (typeof releaseRequiredPackageScripts)[number];

export type GatePackageScriptCheckId = `script:${GatePackageScript}`;

const releaseOnlyGatePackageScripts: ReadonlySet<GatePackageScript> = new Set([
  "test:version-control",
  "test:skill-package-hash"
]);

export type GateCommand = Readonly<{
  args: readonly string[];
  command: "bun" | "node";
}>;

export type SemanticGateCheck = Readonly<{
  checkId: `test:${string}`;
  command: GateCommand;
  dependsOn?: readonly GatePackageScriptCheckId[];
  displayName: string;
  requiredTag?: GateTag;
}>;

const bunTest = (file: string): GateCommand => ({
  args: ["test", file],
  command: "bun"
});

export const semanticGateChecks = [
  {
    checkId: "test:change-plan:artifact-and-active-plan-gates",
    displayName: "Change Plan artifact and active-plan gates",
    requiredTag: undefined,
    command: bunTest(
      "./tools/change-plan/tests/checks/artifact-and-active-plan-gates.ts"
    )
  },
  {
    checkId: "test:change-plan:lifecycle-archive",
    displayName: "Change Plan lifecycle and archive",
    requiredTag: undefined,
    command: bunTest("./tools/change-plan/tests/checks/lifecycle-archive.ts")
  },
  {
    checkId: "test:change-plan:public-distribution",
    dependsOn: ["script:check:change-plan-cli"],
    displayName: "Change Plan public distribution",
    requiredTag: undefined,
    command: bunTest("./tools/change-plan/tests/checks/public-distribution.ts")
  },
  {
    checkId: "test:decision-records:record-and-established-graph",
    displayName: "Decision Records record and established graph",
    requiredTag: "release",
    command: bunTest(
      "./tools/decision-records/tests/checks/record-and-established-graph.ts"
    )
  },
  {
    checkId: "test:decision-records:query-and-index-projection",
    displayName: "Decision Records query and index projection",
    requiredTag: "release",
    command: bunTest(
      "./tools/decision-records/tests/checks/query-and-index-projection.ts"
    )
  },
  {
    checkId: "test:decision-records:lifecycle-and-recovery",
    displayName: "Decision Records lifecycle and recovery",
    requiredTag: "release",
    command: bunTest(
      "./tools/decision-records/tests/checks/lifecycle-and-recovery.ts"
    )
  },
  {
    checkId: "test:decision-records:pending-stage",
    displayName: "Decision Records pending stage",
    requiredTag: "release",
    command: bunTest("./tools/decision-records/tests/stage.test.ts")
  },
  {
    checkId: "test:decision-records:public-distribution",
    dependsOn: ["script:check:decision-records-cli"],
    displayName: "Decision Records public distribution",
    requiredTag: "release",
    command: bunTest(
      "./tools/decision-records/tests/checks/public-distribution.ts"
    )
  },
  {
    checkId: "test:investigation-report:collection-and-resources",
    displayName: "Investigation Report collection and resources",
    requiredTag: "release",
    command: bunTest(
      "./tools/investigation-report/tests/checks/collection-and-resources.ts"
    )
  },
  {
    checkId: "test:investigation-report:index-and-query",
    displayName: "Investigation Report index and query",
    requiredTag: "release",
    command: bunTest(
      "./tools/investigation-report/tests/checks/index-and-query.ts"
    )
  },
  {
    checkId: "test:investigation-report:transactional-maintenance",
    displayName: "Investigation Report transactional maintenance",
    requiredTag: "release",
    command: bunTest(
      "./tools/investigation-report/tests/checks/transactional-maintenance.ts"
    )
  },
  {
    checkId: "test:investigation-report:pending-stage",
    displayName: "Investigation Report pending stage",
    requiredTag: "release",
    command: bunTest("./tools/investigation-report/tests/staging.test.ts")
  },
  {
    checkId: "test:investigation-report:cli-contract",
    displayName: "Investigation Report CLI contract",
    requiredTag: "release",
    command: bunTest("./tools/investigation-report/tests/cli-generated.test.ts")
  },
  {
    checkId: "test:task-graph:index-and-projection",
    displayName: "Task Graph index and projection",
    requiredTag: "release",
    command: bunTest("./tools/task-graph/tests/checks/index-and-projection.ts")
  },
  {
    checkId: "test:task-graph:task-lifecycle",
    displayName: "Task Graph task lifecycle",
    requiredTag: "release",
    command: bunTest("./tools/task-graph/tests/checks/task-lifecycle.ts")
  },
  {
    checkId: "test:task-graph:runtime-and-store",
    displayName: "Task Graph runtime and store",
    requiredTag: "release",
    command: bunTest("./tools/task-graph/tests/checks/runtime-and-store.ts")
  },
  {
    checkId: "test:task-graph:native-store",
    displayName: "Task Graph native store",
    requiredTag: "release",
    command: {
      command: "node",
      args: ["--test", "./tools/task-graph/tests/native-store.test.ts"]
    }
  },
  {
    checkId: "test:task-graph:cli-rendering",
    displayName: "Task Graph CLI rendering",
    requiredTag: "release",
    command: bunTest("./tools/task-graph/tests/checks/cli-rendering.ts")
  },
  {
    checkId: "test:task-graph:pending-stage",
    displayName: "Task Graph pending stage",
    requiredTag: "release",
    command: bunTest("./tools/task-graph/tests/staging.test.ts")
  },
  {
    checkId: "test:task-graph:public-distribution",
    dependsOn: ["script:check:task-graph-cli"],
    displayName: "Task Graph public distribution",
    requiredTag: "release",
    command: bunTest("./tools/task-graph/tests/generated-artifacts.test.ts")
  },
  {
    checkId: "test:task-graph:portable-build",
    displayName: "Task Graph portable build",
    requiredTag: "release",
    command: bunTest("./tools/task-graph/tests/portable-build.test.ts")
  },
  {
    checkId: "test:test-evidence:catalog-contract",
    displayName: "Test Evidence catalog contract",
    requiredTag: "release",
    command: bunTest("./tools/test-evidence/tests/catalog.test.ts")
  },
  {
    checkId: "test:test-evidence:ledger-source-and-relations",
    displayName: "Test Evidence ledger source and relations",
    requiredTag: "release",
    command: bunTest(
      "./tools/test-evidence/tests/checks/ledger-source-and-relations.ts"
    )
  },
  {
    checkId: "test:test-evidence:ledger-index-and-query",
    displayName: "Test Evidence ledger index and query",
    requiredTag: "release",
    command: bunTest(
      "./tools/test-evidence/tests/checks/ledger-index-and-query.ts"
    )
  },
  {
    checkId: "test:test-evidence:ledger-cli",
    displayName: "Test Evidence ledger CLI",
    requiredTag: "release",
    command: bunTest("./tools/test-evidence/tests/ledger-cli.test.ts")
  },
  {
    checkId: "test:test-evidence:pending-stage",
    displayName: "Test Evidence pending stage",
    requiredTag: "release",
    command: bunTest("./tools/test-evidence/tests/staging.test.ts")
  }
] as const satisfies readonly SemanticGateCheck[];

export const releaseVersionPackageScript = "hash:skills";
export const releaseSnapshotCheckId = "release:skill-prepare";
const releaseVersionCheckId = "release:skill-version";
const packSkillsCheckId = "pack:skills";

export function isReleaseBaselineRef(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.trim() === value &&
    !value.startsWith("-") &&
    !value.includes("\0") &&
    !/[\r\n]/u.test(value)
  );
}

export type GateCommandInvocation = Readonly<{
  args: readonly string[];
  command: "bun" | "node";
  cwd: string;
  signal: AbortSignal;
}>;

export type GateCommandUnavailableReason =
  | "gate-command-cancelled"
  | "gate-command-exit-unavailable"
  | "gate-command-start-failed";

type PackageScriptUnavailableReason =
  | "package-script-cancelled"
  | "package-script-exit-unavailable"
  | "package-script-start-failed";

export type GateCommandRunResult =
  | Readonly<{ exitCode: number; output: string; status: "completed" }>
  | Readonly<{
      output: string;
      reason: GateCommandUnavailableReason;
      status: "unavailable";
    }>;

export type GateCommandRunner = (
  invocation: GateCommandInvocation
) => Promise<GateCommandRunResult>;

export type GateDefinitionDependencies = Readonly<{
  baselineRef?: string;
  durationHints?: ReadonlyMap<string, number>;
  nativeChecks?: readonly Check[];
  packRelease?: (
    preparedRelease: PreparedSkillPackageRelease,
    workspaceRoot: string
  ) => Promise<unknown>;
  prepareRelease?: (
    workspaceRoot: string,
    baselineRef: string
  ) => Promise<PreparedSkillPackageRelease>;
  runCommand?: GateCommandRunner;
}>;

type GateCommandContext =
  | Readonly<{ kind: "package-script"; script: string }>
  | Readonly<{ kind: "semantic" }>;

export function packageScriptCheckId(
  script: GatePackageScript
): GatePackageScriptCheckId {
  return `script:${script}`;
}

function truncateDiagnostic(value: string): string {
  return value.length <= diagnosticOutputLimit
    ? value
    : `…${value.slice(-diagnosticOutputLimit)}`;
}

function outputMessage(output: string): string {
  const diagnostic = truncateDiagnostic(output.trim());
  return diagnostic.length === 0 ? "" : `\n${diagnostic}`;
}

function quoteCommandArgument(argument: string): string {
  return /^[A-Za-z0-9_./,:=@+%-]+$/u.test(argument)
    ? argument
    : `'${argument.replaceAll("'", `'"'"'`)}'`;
}

function commandText(
  invocation: Pick<GateCommandInvocation, "args" | "command">
): string {
  return [invocation.command, ...invocation.args]
    .map(quoteCommandArgument)
    .join(" ");
}

function contextReason(
  context: GateCommandContext,
  reason: GateCommandUnavailableReason
): GateCommandUnavailableReason | PackageScriptUnavailableReason {
  if (context.kind === "semantic") return reason;
  switch (reason) {
    case "gate-command-cancelled":
      return "package-script-cancelled";
    case "gate-command-exit-unavailable":
      return "package-script-exit-unavailable";
    case "gate-command-start-failed":
      return "package-script-start-failed";
  }
}

function unavailableCommandResult(
  invocation: GateCommandInvocation,
  context: GateCommandContext,
  reason: GateCommandUnavailableReason,
  output: string
) {
  const code = contextReason(context, reason);
  return {
    status: "unavailable" as const,
    reason: { code },
    messages: [
      {
        level: "error" as const,
        code,
        message: `Could not run ${commandText(invocation)}. Confirm the command is available, then run ${commandText(invocation)} directly.${outputMessage(output)}`
      }
    ]
  };
}

function settleGateCommand(
  invocation: GateCommandInvocation,
  context: GateCommandContext,
  result: GateCommandRunResult
) {
  if (result.status === "unavailable") {
    return unavailableCommandResult(
      invocation,
      context,
      result.reason,
      result.output
    );
  }
  const data =
    context.kind === "semantic"
      ? {
          args: invocation.args,
          command: invocation.command,
          exitCode: result.exitCode
        }
      : { exitCode: result.exitCode, script: context.script };
  if (result.exitCode === 0) return { status: "passed" as const, data };
  const code =
    context.kind === "semantic"
      ? "gate-command-exit-nonzero"
      : "package-script-exit-nonzero";
  return {
    status: "failed" as const,
    data,
    messages: [
      {
        level: "error" as const,
        code,
        message: `${commandText(invocation)} exited with code ${result.exitCode}. Run ${commandText(invocation)} directly for its full diagnostic.${outputMessage(result.output)}`
      }
    ]
  };
}

export async function runGateCommand(
  invocation: GateCommandInvocation
): Promise<GateCommandRunResult> {
  const { args, command, cwd, signal } = invocation;
  if (signal.aborted) {
    return {
      output: "",
      reason: "gate-command-cancelled",
      status: "unavailable"
    };
  }
  return await new Promise((resolve) => {
    let output = "";
    let settled = false;
    const child = spawn(command, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true
    });
    const appendOutput = (chunk: string): void => {
      output = truncateDiagnostic(`${output}${chunk}`);
    };
    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", appendOutput);
    child.stderr?.on("data", appendOutput);
    const unavailable = (reason: GateCommandUnavailableReason) => ({
      output,
      reason,
      status: "unavailable" as const
    });
    const finish = (result: GateCommandRunResult): void => {
      if (settled) return;
      settled = true;
      signal.removeEventListener("abort", abort);
      resolve(result);
    };
    const abort = (): void => {
      child.kill("SIGTERM");
    };
    signal.addEventListener("abort", abort, { once: true });
    child.once("error", (error: Error) => {
      appendOutput(error.message);
      finish(
        unavailable(
          signal.aborted
            ? "gate-command-cancelled"
            : "gate-command-start-failed"
        )
      );
    });
    child.once("close", (exitCode) => {
      if (signal.aborted) {
        finish(unavailable("gate-command-cancelled"));
        return;
      }
      if (exitCode === null) {
        finish(unavailable("gate-command-exit-unavailable"));
        return;
      }
      finish({ exitCode, output, status: "completed" });
    });
  });
}

async function executeGateCommand(
  input: Readonly<{
    command: GateCommand;
    context: GateCommandContext;
    projectRoot: string;
    runner: GateCommandRunner;
    signal: AbortSignal;
  }>
) {
  const invocation: GateCommandInvocation = {
    ...input.command,
    cwd: input.projectRoot,
    signal: input.signal
  };
  if (input.signal.aborted) {
    return unavailableCommandResult(
      invocation,
      input.context,
      "gate-command-cancelled",
      ""
    );
  }
  try {
    const result = await input.runner(invocation);
    if (input.signal.aborted) {
      return unavailableCommandResult(
        invocation,
        input.context,
        "gate-command-cancelled",
        result.output
      );
    }
    return settleGateCommand(invocation, input.context, result);
  } catch (error) {
    return unavailableCommandResult(
      invocation,
      input.context,
      "gate-command-start-failed",
      error instanceof Error ? error.message : String(error)
    );
  }
}

function createPackageScriptCheck(
  script: GatePackageScript,
  runner: GateCommandRunner
): Check {
  return defineCheck({
    checkId: packageScriptCheckId(script),
    displayName: `Script: ${script}`,
    async execution({ project, signal }) {
      return await executeGateCommand({
        command: { args: ["run", script], command: "bun" },
        projectRoot: project.root,
        runner,
        context: { kind: "package-script", script },
        signal
      });
    }
  });
}

function semanticPrerequisiteFailure(
  check: SemanticGateCheck,
  dependencies: Readonly<{
    get(
      checkId: string
    ): Readonly<{ ok: boolean; status?: string }> | undefined;
  }>
) {
  for (const checkId of check.dependsOn ?? []) {
    const dependency = dependencies.get(checkId);
    const rerun = `bun run ${checkId.slice("script:".length)}`;
    if (!dependency?.ok) {
      return {
        status: "unavailable" as const,
        reason: {
          code: "semantic-prerequisite-unavailable",
          checkIds: [checkId]
        },
        messages: [
          {
            level: "error" as const,
            code: "semantic-prerequisite-unavailable",
            message: `${check.displayName} did not start because ${checkId} has no trusted final result. Fix that prerequisite and rerun ${rerun}.`
          }
        ]
      };
    }
    if (dependency.status !== "passed") {
      return {
        status: "failed" as const,
        data: { prerequisite: checkId, prerequisiteStatus: dependency.status },
        messages: [
          {
            level: "error" as const,
            code: "semantic-prerequisite-failed",
            message: `${check.displayName} did not start because ${checkId} is ${dependency.status}. Fix that prerequisite and rerun ${rerun}.`
          }
        ]
      };
    }
  }
  return null;
}

function createSemanticGateCheck(
  check: SemanticGateCheck,
  runner: GateCommandRunner
): Check {
  return defineCheck({
    checkId: check.checkId,
    ...(check.dependsOn === undefined ? {} : { dependsOn: check.dependsOn }),
    displayName: check.displayName,
    async execution({ dependencies, project, signal }) {
      const prerequisiteFailure = semanticPrerequisiteFailure(
        check,
        dependencies
      );
      if (prerequisiteFailure !== null) return prerequisiteFailure;
      return await executeGateCommand({
        command: check.command,
        projectRoot: project.root,
        runner,
        context: { kind: "semantic" },
        signal
      });
    }
  });
}

function prepareReleaseBaseline(
  baselineRef: unknown
):
  | Readonly<{ readonly baselineRef: string; readonly status: "ready" }>
  | Readonly<{ readonly status: "invalid" }> {
  return isReleaseBaselineRef(baselineRef)
    ? { baselineRef, status: "ready" }
    : { status: "invalid" };
}

type ReleaseDependencies = Readonly<{
  get(checkId: string):
    | Readonly<{
        ok: boolean;
        status?: string;
      }>
    | undefined;
}>;

type ReleaseState = { prepared: PreparedSkillPackageRelease | undefined };

function releasePrerequisiteFailure(dependencies: ReleaseDependencies) {
  for (const checkId of releaseRequiredCheckIds) {
    const dependency = dependencies.get(checkId);
    if (!dependency?.ok) {
      return {
        status: "unavailable" as const,
        reason: {
          code: "release-prerequisite-unavailable",
          checkIds: [checkId]
        },
        messages: [
          {
            level: "error" as const,
            code: "release-prerequisite-unavailable",
            message: `Release version validation did not start because ${checkId} has no trusted final result. Fix that prerequisite and rerun bun run check --tag release.`
          }
        ]
      };
    }
    if (dependency.status !== "passed") {
      return {
        status: "failed" as const,
        data: { prerequisite: checkId, prerequisiteStatus: dependency.status },
        messages: [
          {
            level: "error" as const,
            code: "release-prerequisite-failed",
            message: `Release version validation did not start because ${checkId} is ${dependency.status}. Fix that prerequisite and rerun bun run check --tag release.`
          }
        ]
      };
    }
  }
  return null;
}

function releaseSnapshotUnavailable(message: string, error: unknown) {
  const detail = error instanceof Error ? error.message : String(error);
  return {
    status: "unavailable" as const,
    reason: { code: "release-snapshot-unavailable" },
    messages: [
      {
        level: "error" as const,
        code: "release-snapshot-unavailable",
        message: `${message}${outputMessage(detail)}`
      }
    ]
  };
}

function createReleasePrepareCheck(
  baselineRef: string,
  prepareRelease: GateDefinitionDependencies["prepareRelease"],
  state: ReleaseState
): Check {
  const prepare = prepareRelease ?? prepareSkillPackageRelease;
  return defineCheck({
    checkId: releaseSnapshotCheckId,
    displayName: "Prepare skill release snapshot",
    options: { baselineRef },
    preflight(options: Readonly<{ baselineRef: string }>) {
      const prepared = prepareReleaseBaseline(options.baselineRef);
      if (prepared.status === "invalid") {
        return {
          status: "failure" as const,
          action: "block" as const,
          reason: { code: "release-baseline-invalid" },
          messages: [
            {
              level: "error" as const,
              code: "release-baseline-invalid",
              message:
                "The release baseline must be a trimmed, non-empty revision input without a leading hyphen, NUL, CR, or LF. Pass --baseline-ref <ref> to bun run check --tag release."
            }
          ]
        };
      }
      return {
        status: "success" as const,
        preparedOptions: { baselineRef: prepared.baselineRef }
      };
    },
    async execution({ options, project }) {
      try {
        state.prepared = await prepare(project.root, options.baselineRef);
        return { status: "passed" as const, data: {} };
      } catch (error) {
        return releaseSnapshotUnavailable(
          "Could not prepare the pending skill release snapshot. Fix the Git or skill-package input and rerun bun run check --tag release.",
          error
        );
      }
    }
  });
}

function createReleaseVersionCheck(state: ReleaseState): Check {
  return defineCheck({
    checkId: releaseVersionCheckId,
    displayName: "Validate skill release versions",
    dependsOn: [...releaseRequiredCheckIds, releaseSnapshotCheckId],
    async execution({ dependencies }) {
      const prerequisiteFailure = releasePrerequisiteFailure(dependencies);
      if (prerequisiteFailure !== null) {
        state.prepared = undefined;
        return prerequisiteFailure;
      }
      const prepared = state.prepared;
      if (prepared === undefined) {
        return releaseSnapshotUnavailable(
          "Release version authorization did not receive a prepared snapshot. Rerun bun run check --tag release.",
          ""
        );
      }
      if (prepared.versionIssues.length === 0) {
        return { status: "passed" as const, data: {} };
      }
      state.prepared = undefined;
      return {
        status: "failed" as const,
        data: { versionIssueCount: prepared.versionIssues.length },
        messages: [
          {
            level: "error" as const,
            code: "release-version-invalid",
            message:
              `Skill package versions are invalid against ${prepared.baselineRef}:\n- ` +
              prepared.versionIssues.join("\n- ") +
              "\nRun bun run hash:skills -- --baseline-ref <ref> for the standalone diagnostic."
          }
        ]
      };
    }
  });
}

function createPackSkillsCheck(
  packRelease: GateDefinitionDependencies["packRelease"],
  state: ReleaseState
): Check {
  const pack =
    packRelease ??
    ((preparedRelease: PreparedSkillPackageRelease, workspaceRoot: string) =>
      packSkillPackageSnapshot(
        preparedRelease.snapshot,
        path.join(workspaceRoot, "dist")
      ));
  return defineCheck({
    checkId: "pack:skills",
    displayName: "Package skills",
    dependsOn: ["release:skill-version"],
    async execution({ dependencies, project }) {
      const version = dependencies.get("release:skill-version");
      if (!version?.ok) {
        return {
          status: "unavailable" as const,
          reason: {
            code: "release-version-unavailable",
            checkIds: [releaseVersionCheckId]
          },
          messages: [
            {
              level: "error" as const,
              code: "release-version-unavailable",
              message:
                "Packaging did not start because release:skill-version has no trusted final result. Fix the version check and rerun bun run check --tag release."
            }
          ]
        };
      }
      if (version.status !== "passed") {
        return {
          status: "failed" as const,
          data: {
            prerequisite: releaseVersionCheckId,
            prerequisiteStatus: version.status
          },
          messages: [
            {
              level: "error" as const,
              code: "release-version-failed",
              message: `Packaging did not start because release:skill-version is ${version.status}. Fix the version check and rerun bun run check --tag release.`
            }
          ]
        };
      }
      const prepared = state.prepared;
      if (prepared === undefined) {
        return releaseSnapshotUnavailable(
          "Packaging did not receive a prepared snapshot. Rerun bun run check --tag release.",
          ""
        );
      }
      try {
        await pack(prepared, project.root);
        return { status: "passed" as const, data: {} };
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        return {
          status: "failed" as const,
          data: {},
          messages: [
            {
              level: "error" as const,
              code: "release-pack-failed",
              message: `Could not package the prepared skill release snapshot.${outputMessage(detail)}`
            }
          ]
        };
      } finally {
        state.prepared = undefined;
      }
    }
  });
}

export function createVibeNativeChecks(): readonly Check[] {
  return [
    duplicateDetection({
      cache: { enabled: false },
      scanner: {
        command: { kind: "custom", executable: projectJscpdExecutable }
      },
      codeAreas: {
        maintained: {
          files: maintainedCodeFiles,
          findingPolicy: "blocking",
          minimumTokens: 150
        }
      }
    }),
    jsonValidation({
      files: maintainedDocumentFiles,
      maximumBytes: 2_097_152
    }),
    jsonSchemaValidation({
      bindings,
      files: {
        source: "git-worktree",
        include: [
          ...schemas.map(({ path }) => path),
          ...bindings.map(({ instancePath }) => instancePath)
        ],
        exclude: projectExclusions
      },
      maximumBytes: 2_097_152,
      schemaIdentity: { mode: "configuration-authoritative" },
      schemas
    }),
    markdownLinkValidation({
      files: maintainedDocumentFiles,
      findingPolicy: "blocking"
    }),
    fileMetrics({
      codeAreas: {
        maintained: {
          files: maintainedCodeFiles,
          findingPolicy: "non-blocking"
        }
      },
      findingPolicy: "non-blocking",
      findingWaivers: []
    }),
    functionMetrics({
      codeAreas: {
        maintained: {
          files: maintainedCodeFiles,
          findingPolicy: "non-blocking"
        }
      },
      findingPolicy: "non-blocking",
      scanner: { executable: projectLizardExecutable }
    })
  ];
}

export const releaseRequiredCheckIds = [
  ...vibeNativeCheckIds,
  ...releaseRequiredPackageScripts.map(packageScriptCheckId),
  ...semanticGateChecks.map(({ checkId }) => checkId)
] as const;

export function gateCheckIds(): readonly string[] {
  return [
    releaseSnapshotCheckId,
    ...vibeNativeCheckIds,
    ...releaseRequiredPackageScripts.map(packageScriptCheckId),
    ...semanticGateChecks.map(({ checkId }) => checkId),
    releaseVersionCheckId,
    packSkillsCheckId
  ];
}

const releaseOnlyGateCheckIds: ReadonlySet<string> = new Set([
  releaseSnapshotCheckId,
  releaseVersionCheckId,
  packSkillsCheckId,
  ...Array.from(releaseOnlyGatePackageScripts, packageScriptCheckId),
  ...semanticGateChecks
    .filter(({ requiredTag }) => requiredTag === "release")
    .map(({ checkId }) => checkId)
]);

export function activeGateCheckIds(tags: GateTagSet): readonly string[] {
  return hasGateTag(tags, "release")
    ? gateCheckIds()
    : gateCheckIds().filter((checkId) => !releaseOnlyGateCheckIds.has(checkId));
}

function inactiveTagPreflight(requiredTag: GateTag) {
  return {
    status: "failure" as const,
    action: "block" as const,
    reason: { code: "gate-tag-not-enabled" },
    messages: [
      {
        level: "info" as const,
        code: "gate-tag-not-enabled",
        message: `This Check did not start because it requires the ${requiredTag} tag. Pass --tag ${requiredTag} to run it with the base Checks.`
      }
    ]
  };
}

/** Adds the invocation tag boundary before a Check's own preflight, so inactive
 * Check definitions remain visible without starting their I/O or original setup. */
export function activateGateCheck<
  AuthoredOptions extends object,
  PreparedOptions extends object
>(
  check: Check<AuthoredOptions, PreparedOptions>,
  requiredTag: GateTag | undefined,
  activeTags: GateTagSet
): Check<AuthoredOptions, PreparedOptions> {
  if (requiredTag === undefined) return check;
  const originalPreflight = check.preflight;
  return {
    ...check,
    async preflight(options, signal) {
      if (!hasGateTag(activeTags, requiredTag)) {
        return inactiveTagPreflight(requiredTag);
      }
      return originalPreflight === undefined
        ? { status: "success" as const, preparedOptions: options }
        : await originalPreflight(options, signal);
    }
  };
}

export function createGateDefinition(
  activeTags: GateTagSet = [],
  dependencies: GateDefinitionDependencies = {}
): ProjectDefinition {
  const tags = normalizeGateTags(activeTags);
  const runner = dependencies.runCommand ?? runGateCommand;
  const releaseState: ReleaseState = { prepared: undefined };
  const nativeChecks = dependencies.nativeChecks ?? createVibeNativeChecks();
  const semanticChecks = semanticGateChecks.map((check) =>
    activateGateCheck(
      createSemanticGateCheck(check, runner),
      check.requiredTag,
      tags
    )
  );
  const packageChecks = releaseRequiredPackageScripts.map((script) =>
    activateGateCheck(
      createPackageScriptCheck(script, runner),
      releaseOnlyGatePackageScripts.has(script) ? "release" : undefined,
      tags
    )
  );
  const releasePrepareCheck = activateGateCheck(
    createReleasePrepareCheck(
      dependencies.baselineRef ?? "HEAD",
      dependencies.prepareRelease,
      releaseState
    ),
    "release",
    tags
  );
  const releaseVersionCheck = activateGateCheck(
    createReleaseVersionCheck(releaseState),
    "release",
    tags
  );
  const packSkillsCheck = activateGateCheck(
    createPackSkillsCheck(dependencies.packRelease, releaseState),
    "release",
    tags
  );
  // Declaration order is only an admission hint. All Checks always remain in the
  // Definition; aggregate selection decides which activated Checks settle the Gate.
  const checks: Check[] = [
    releasePrepareCheck,
    ...nativeChecks,
    ...packageChecks,
    ...semanticChecks,
    releaseVersionCheck,
    packSkillsCheck
  ];
  return defineConfig({
    checks: orderRootChecksByCriticalRank(
      checks,
      dependencies.durationHints,
      activeGateCheckIds(tags)
    ),
    outputs: {
      diagnosticLogging: { directory: ".log/vibe-check", enabled: false },
      machinePublication: {
        directory: ".log/vibe-check/publication",
        enabled: true
      },
      progressRendering: { enabled: true }
    },
    scheduler: { maxParallel: 4 }
  });
}

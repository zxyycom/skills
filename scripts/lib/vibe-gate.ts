import { spawn } from "node:child_process";
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

export type GateProfile = "default" | "full";

const diagnosticOutputLimit = 4_000;

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
  exclude: projectExclusions
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

export const defaultGatePackageScripts = [
  "test:relation-graph",
  "test:change-plan-cli",
  "test:skill-release-publisher",
  "test:index-runtime",
  "test:skill-validator",
  "check:investigations",
  "check:decisions",
  "validate",
  "test:skill-updater",
  "check:test-evidence-cli",
  "check:test-evidence-catalog",
  "check:skill-validator",
  "check:investigation-report-check",
  "check:change-plan-cli",
  "check:decision-records-cli",
  "check:task-graph-index",
  "check:task-graph-cli",
  "typecheck",
  "lint",
  "format:check",
  "check:skill-updaters",
  "test:check",
  "test:environment",
  "test:generated-file"
] as const;

export const fullOnlyGatePackageScripts = [
  "test:decision-records-cli",
  "test:version-control",
  "test:skill-package-hash",
  "test:investigation-report-check",
  "test:test-evidence-cli",
  "test:task-graph-cli"
] as const;

export const releaseRequiredPackageScripts = [
  ...defaultGatePackageScripts,
  ...fullOnlyGatePackageScripts
] as const;

export const releaseVersionPackageScript = "hash:skills";

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

export type GatePackageScript = (typeof releaseRequiredPackageScripts)[number];

export type GatePackageInvocation = Readonly<{
  args: readonly ["run", string, ...string[]];
  command: "bun";
  cwd: string;
  script: string;
  signal: AbortSignal;
}>;

export type GatePackageUnavailableReason =
  | "package-script-cancelled"
  | "package-script-exit-unavailable"
  | "package-script-start-failed";

export type GatePackageRunResult =
  | Readonly<{
      exitCode: number;
      output: string;
      status: "completed";
    }>
  | Readonly<{
      output: string;
      reason: GatePackageUnavailableReason;
      status: "unavailable";
    }>;

export type GatePackageRunner = (
  invocation: GatePackageInvocation
) => Promise<GatePackageRunResult>;

export type GateDefinitionDependencies = Readonly<{
  baselineRef?: string;
  nativeChecks?: readonly Check[];
  runPackageScript?: GatePackageRunner;
}>;

export function packageScriptCheckId(script: string): string {
  return `script:${script}`;
}

export const releaseRequiredCheckIds = [
  ...releaseRequiredPackageScripts.map(packageScriptCheckId),
  ...vibeNativeCheckIds
] as const;

function truncateDiagnostic(value: string): string {
  if (value.length <= diagnosticOutputLimit) {
    return value;
  }
  return `…${value.slice(-diagnosticOutputLimit)}`;
}

function outputMessage(output: string): string {
  const diagnostic = truncateDiagnostic(output.trim());
  return diagnostic.length === 0 ? "" : `\n${diagnostic}`;
}

function unavailableScriptResult(
  script: string,
  reason: GatePackageUnavailableReason,
  output: string
) {
  return {
    status: "unavailable" as const,
    reason: { code: reason },
    messages: [
      {
        level: "error" as const,
        code: reason,
        message:
          `Could not run bun run ${script}. ` +
          `Confirm Bun and the script are available, then run bun run ${script} directly.` +
          outputMessage(output)
      }
    ]
  };
}

function settlePackageScript(script: string, result: GatePackageRunResult) {
  if (result.status === "unavailable") {
    return unavailableScriptResult(script, result.reason, result.output);
  }

  const data = {
    exitCode: result.exitCode,
    script
  };
  if (result.exitCode === 0) {
    return { status: "passed" as const, data };
  }
  return {
    status: "failed" as const,
    data,
    messages: [
      {
        level: "error" as const,
        code: "package-script-exit-nonzero",
        message:
          `bun run ${script} exited with code ${result.exitCode}. ` +
          `Run bun run ${script} directly for its full diagnostic.` +
          outputMessage(result.output)
      }
    ]
  };
}

export async function runBunPackageScript(
  invocation: GatePackageInvocation
): Promise<GatePackageRunResult> {
  const { args, command, cwd, signal } = invocation;
  if (signal.aborted) {
    return {
      output: "",
      reason: "package-script-cancelled",
      status: "unavailable"
    };
  }

  return new Promise((resolve) => {
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

    const finish = (result: GatePackageRunResult): void => {
      if (settled) {
        return;
      }
      settled = true;
      signal.removeEventListener("abort", abort);
      resolve(result);
    };
    const abort = (): void => {
      child.kill("SIGTERM");
    };
    signal.addEventListener("abort", abort, { once: true });
    child.once("error", (error: Error) => {
      if (signal.aborted) {
        finish({
          output,
          reason: "package-script-cancelled",
          status: "unavailable"
        });
        return;
      }
      finish({
        output: `${output}${error.message}`,
        reason: "package-script-start-failed",
        status: "unavailable"
      });
    });
    child.once("close", (exitCode) => {
      if (signal.aborted) {
        finish({
          output,
          reason: "package-script-cancelled",
          status: "unavailable"
        });
        return;
      }
      if (exitCode === null) {
        finish({
          output,
          reason: "package-script-exit-unavailable",
          status: "unavailable"
        });
        return;
      }
      finish({ exitCode, output, status: "completed" });
    });
  });
}

async function executePackageScript(
  input: Readonly<{
    args: GatePackageInvocation["args"];
    projectRoot: string;
    runner: GatePackageRunner;
    script: string;
    signal: AbortSignal;
  }>
) {
  const { args, projectRoot, runner, script, signal } = input;
  if (signal.aborted) {
    return unavailableScriptResult(script, "package-script-cancelled", "");
  }
  try {
    const result = await runner({
      args,
      command: "bun",
      cwd: projectRoot,
      script,
      signal
    });
    if (signal.aborted) {
      return unavailableScriptResult(
        script,
        "package-script-cancelled",
        result.output
      );
    }
    return settlePackageScript(script, result);
  } catch (error) {
    return unavailableScriptResult(
      script,
      "package-script-start-failed",
      error instanceof Error ? error.message : String(error)
    );
  }
}

function createPackageScriptCheck(
  script: string,
  runner: GatePackageRunner
): Check {
  return defineCheck({
    checkId: packageScriptCheckId(script),
    displayName: `Script: ${script}`,
    async execution({ project, signal }) {
      return executePackageScript({
        args: ["run", script],
        projectRoot: project.root,
        runner,
        script,
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
  if (!isReleaseBaselineRef(baselineRef)) {
    return { status: "invalid" };
  }
  return { baselineRef, status: "ready" };
}

function createPackSkillsCheck(
  runner: GatePackageRunner,
  baselineRef: string
): Check {
  return defineCheck({
    checkId: "pack:skills",
    displayName: "Validate versions and package skills",
    dependsOn: releaseRequiredCheckIds,
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
                "The release baseline must be a trimmed, non-empty revision input without a leading hyphen, NUL, CR, or LF. " +
                "Only hash:skills resolves it after release prerequisites pass. " +
                "Pass --baseline-ref <ref> to bun run check --full."
            }
          ]
        };
      }
      return {
        status: "success" as const,
        preparedOptions: { baselineRef: prepared.baselineRef }
      };
    },
    async execution({ dependencies, options, project, records, signal }) {
      records.report(
        { id: "release-baseline" },
        { baselineRef: options.baselineRef }
      );
      for (const checkId of releaseRequiredCheckIds) {
        const dependency = dependencies.get(checkId);
        if (!dependency.ok) {
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
                message:
                  `Packaging did not start because ${checkId} has no trusted final result. ` +
                  "Fix that prerequisite and rerun bun run check --full."
              }
            ]
          };
        }
        if (dependency.status !== "passed") {
          return {
            status: "failed" as const,
            data: {
              baselineRef: options.baselineRef,
              prerequisite: checkId,
              prerequisiteStatus: dependency.status
            },
            messages: [
              {
                level: "error" as const,
                code: "release-prerequisite-failed",
                message:
                  `Packaging did not start because ${checkId} is ${dependency.status}. ` +
                  "Fix that prerequisite and rerun bun run check --full."
              }
            ]
          };
        }
      }

      const versionCheck = await executePackageScript({
        args: [
          "run",
          releaseVersionPackageScript,
          "--",
          "--baseline-ref",
          options.baselineRef,
          "--quiet"
        ],
        projectRoot: project.root,
        runner,
        script: releaseVersionPackageScript,
        signal
      });
      if (versionCheck.status !== "passed") {
        if (versionCheck.status === "failed") {
          return {
            ...versionCheck,
            data: { ...versionCheck.data, baselineRef: options.baselineRef }
          };
        }
        return versionCheck;
      }
      const packageResult = await executePackageScript({
        args: ["run", "pack:skills"],
        projectRoot: project.root,
        runner,
        script: "pack:skills",
        signal
      });
      if (
        packageResult.status === "passed" ||
        packageResult.status === "failed"
      ) {
        return {
          ...packageResult,
          data: { ...packageResult.data, baselineRef: options.baselineRef }
        };
      }
      return packageResult;
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

function selectedPackageScripts(
  profile: GateProfile
): readonly GatePackageScript[] {
  return profile === "default"
    ? defaultGatePackageScripts
    : releaseRequiredPackageScripts;
}

export function gateCheckIds(profile: GateProfile): readonly string[] {
  const checks = [
    ...vibeNativeCheckIds,
    ...selectedPackageScripts(profile).map(packageScriptCheckId)
  ];
  return profile === "full" ? [...checks, "pack:skills"] : checks;
}

export function createGateDefinition(
  profile: GateProfile,
  dependencies: GateDefinitionDependencies = {}
): ProjectDefinition {
  const runner = dependencies.runPackageScript ?? runBunPackageScript;
  const nativeChecks = dependencies.nativeChecks ?? createVibeNativeChecks();
  const checks: Check[] = [
    ...nativeChecks,
    ...selectedPackageScripts(profile).map((script) =>
      createPackageScriptCheck(script, runner)
    )
  ];
  if (profile === "full") {
    checks.push(
      createPackSkillsCheck(runner, dependencies.baselineRef ?? "HEAD")
    );
  }

  return defineConfig({
    checks,
    outputs: {
      diagnosticLogging: { enabled: false },
      machinePublication: {
        directory: ".log/vibe-check/publication",
        enabled: true
      },
      progressRendering: { enabled: true }
    },
    scheduler: { maxParallel: 4 }
  });
}

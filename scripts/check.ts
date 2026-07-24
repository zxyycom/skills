import { spawn } from "node:child_process";
import os from "node:os";
import process from "node:process";
import { parseArgs } from "node:util";
import { isMainModule } from "../tools/shared/src/node/main-module.ts";
import { rootDir } from "./lib/project.ts";

const defaultConcurrencyLimit = 2;

type CheckTask =
  | string
  | { blocking: true; script: string };

const preflightTasks = [
  "test:test-evidence-cli",
  "test:change-plan-cli",
  "test:decision-records-cli",
  "test:index-runtime",
  "check:test-evidence-fixture",
  "test:skill-validator",
  "test:investigation-report-check",
  "check:investigations",
  "check:decisions",
  "validate",
  "test:skill-updater",
  "check:test-evidence-cli",
  "check:skill-validator",
  "check:investigation-report-check",
  "check:change-plan-cli",
  "check:decision-records-cli",
  "typecheck",
  "check:skill-updaters",
  "test:check",
  "test:generated-file",
  "test:skill-package-hash",
  "hash:skills",
  "test:version-control"
] as const satisfies readonly CheckTask[];
const packageScript = "pack:skills";
export const checkPackageScripts = [
  ...preflightTasks.map(checkTaskScript),
  packageScript
];

type ScriptResult = {
  durationMilliseconds: number;
  exitCode: number;
  script: string;
  stderr: string;
  stdout: string;
};

type CheckResultOutput = {
  stderr: string;
  stdout: string;
  summary: string;
};

type CheckMode = "strict" | "warnings";
type CheckStatus = "failed" | "passed" | "warning";

type CheckWorkflowOptions = {
  concurrency: number;
  mode: CheckMode;
  packageScript: string;
  preflightTasks: readonly CheckTask[];
  report: (result: ScriptResult, status: CheckStatus) => void;
  runScript: (script: string) => Promise<ScriptResult>;
};

type CheckWorkflowResult =
  | {
    exitCode: 1;
    packagingSkipped: true;
    status: "failed";
  }
  | {
    exitCode: 0;
    packagingSkipped: false;
    status: "passed" | "warning";
  }
  | {
    exitCode: 1;
    packagingSkipped: false;
    status: "failed";
  };

type PreflightResult = {
  blockingFailure: boolean;
  hasWarnings: boolean;
};

type ResolveConcurrencyOptions = {
  availableParallelism: number;
  configured: string | undefined;
  taskCount: number;
};

export function resolveConcurrency(
  options: ResolveConcurrencyOptions
): number {
  const { availableParallelism, configured, taskCount } = options;
  if (configured === undefined) {
    return Math.min(defaultConcurrencyLimit, availableParallelism, taskCount);
  }
  if (!/^[1-9]\d*$/u.test(configured)) {
    throw new Error("CHECK_CONCURRENCY must be a positive integer");
  }

  const concurrency = Number(configured);
  if (!Number.isSafeInteger(concurrency)) {
    throw new Error("CHECK_CONCURRENCY must be a safe positive integer");
  }
  return Math.min(concurrency, taskCount);
}

export function resolveCheckMode(argv: readonly string[]): CheckMode {
  const parsed = parseArgs({
    allowPositionals: false,
    args: [...argv],
    options: {
      strict: { type: "boolean" }
    },
    strict: true
  });
  return parsed.values.strict === true ? "strict" : "warnings";
}

function checkTaskScript(task: CheckTask): string {
  return typeof task === "string" ? task : task.script;
}

export function resolveCheckStatus(
  task: CheckTask,
  mode: CheckMode,
  exitCode: number
): CheckStatus {
  if (exitCode === 0) {
    return "passed";
  }
  if (mode === "strict" || (typeof task !== "string" && task.blocking)) {
    return "failed";
  }
  return "warning";
}

async function runPackageScript(script: string): Promise<ScriptResult> {
  const startedAt = performance.now();
  try {
    const child = spawn(
      process.execPath,
      ["run", "--silent", script],
      {
        cwd: rootDir,
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true
      }
    );
    const stdout: string[] = [];
    const stderr: string[] = [];
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => stdout.push(chunk));
    child.stderr.on("data", (chunk: string) => stderr.push(chunk));
    const exitCode = await new Promise<number>((resolve, reject) => {
      child.once("error", reject);
      child.once("close", (code) => resolve(code ?? 1));
    });
    return {
      durationMilliseconds: performance.now() - startedAt,
      exitCode,
      script,
      stderr: stderr.join(""),
      stdout: stdout.join("")
    };
  } catch (error) {
    return {
      durationMilliseconds: performance.now() - startedAt,
      exitCode: 1,
      script,
      stderr: error instanceof Error ? error.message : String(error),
      stdout: ""
    };
  }
}

function writeCapturedOutput(output: string, stream: NodeJS.WriteStream): void {
  if (output.length === 0) {
    return;
  }
  stream.write(output);
  if (!output.endsWith("\n")) {
    stream.write("\n");
  }
}

export function formatCheckResult(
  result: ScriptResult,
  status: CheckStatus
): CheckResultOutput {
  return {
    stderr: result.stderr,
    stdout: status === "passed" ? "" : result.stdout,
    summary: formatTimedStatus(result.script, status, result.durationMilliseconds)
  };
}

export function formatTimedStatus(
  label: string,
  status: CheckStatus,
  durationMilliseconds: number
): string {
  const durationSeconds = (durationMilliseconds / 1_000).toFixed(2);
  return `${label} [${status}][${durationSeconds}s]`;
}

function reportResult(result: ScriptResult, status: CheckStatus): void {
  const output = formatCheckResult(result, status);
  writeCapturedOutput(output.stdout, process.stdout);
  writeCapturedOutput(output.stderr, process.stderr);
  console.log(output.summary);
}

export async function runPreflightTasks(
  tasks: readonly CheckTask[],
  mode: CheckMode,
  concurrency: number,
  runScript: (script: string) => Promise<ScriptResult>,
  report: (result: ScriptResult, status: CheckStatus) => void
): Promise<PreflightResult> {
  const taskIterator = tasks.values();
  let blockingFailure = false;
  let hasWarnings = false;
  async function runWorker(): Promise<void> {
    while (!blockingFailure) {
      const nextTask = taskIterator.next();
      if (nextTask.done) {
        return;
      }

      const task = nextTask.value;
      const result = await runScript(checkTaskScript(task));
      const status = resolveCheckStatus(task, mode, result.exitCode);
      report(result, status);
      if (status === "failed") {
        blockingFailure = true;
      } else if (status === "warning") {
        hasWarnings = true;
      }
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(concurrency, tasks.length) },
      () => runWorker()
    )
  );
  return { blockingFailure, hasWarnings };
}

export async function runCheckWorkflow(
  options: CheckWorkflowOptions
): Promise<CheckWorkflowResult> {
  const {
    concurrency,
    mode,
    packageScript,
    preflightTasks,
    report,
    runScript
  } = options;
  const preflightResult = await runPreflightTasks(
    preflightTasks,
    mode,
    concurrency,
    runScript,
    report
  );
  if (preflightResult.blockingFailure) {
    return {
      exitCode: 1,
      packagingSkipped: true,
      status: "failed"
    };
  }

  const packageResult = await runScript(packageScript);
  const packageStatus = packageResult.exitCode === 0 ? "passed" : "failed";
  report(packageResult, packageStatus);
  if (packageStatus === "failed") {
    return {
      exitCode: 1,
      packagingSkipped: false,
      status: "failed"
    };
  }
  return {
    exitCode: 0,
    packagingSkipped: false,
    status: preflightResult.hasWarnings ? "warning" : "passed"
  };
}

async function main(): Promise<number> {
  const startedAt = performance.now();
  try {
    const mode = resolveCheckMode(process.argv.slice(2));
    const concurrency = resolveConcurrency({
      availableParallelism: os.availableParallelism(),
      configured: process.env.CHECK_CONCURRENCY,
      taskCount: preflightTasks.length
    });
    console.log(
      `${preflightTasks.length} preflight checks `
      + `[running][mode:${mode}][concurrency:${concurrency}]`
    );
    const result = await runCheckWorkflow({
      concurrency,
      mode,
      packageScript,
      preflightTasks,
      report: reportResult,
      runScript: runPackageScript
    });
    if (result.packagingSkipped) {
      console.error(`${packageScript} [skipped]`);
    }
    const summary = formatTimedStatus(
      `All ${preflightTasks.length} preflight checks and packaging`,
      result.status,
      performance.now() - startedAt
    );
    if (result.exitCode === 0) {
      console.log(summary);
    } else {
      console.error(summary);
    }
    return result.exitCode;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error(formatTimedStatus(
      `All ${preflightTasks.length} preflight checks and packaging`,
      "failed",
      performance.now() - startedAt
    ));
    return 1;
  }
}

if (isMainModule(import.meta.url)) {
  process.exitCode = await main();
}

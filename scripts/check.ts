import { spawn } from "node:child_process";
import os from "node:os";
import process from "node:process";
import { parseArgs } from "node:util";
import { isMainModule } from "../tools/shared/src/node/main-module.ts";
import {
  checkPackageScript as packageScript,
  checkPreflightTasks as preflightTasks,
  checkTaskRunsInProfile,
  checkTaskScript,
  type CheckProfile,
  type CheckTask
} from "./lib/check-plan.ts";
import { rootDir } from "./lib/project.ts";

const defaultConcurrencyLimit = 2;

export type ScriptResult = {
  capturedOutput: string;
  durationMilliseconds: number;
  exitCode: number;
  script: string;
};

type CheckStatus = "failed" | "passed" | "skipped";
type CheckSkipReason = "failed preflight checks" | "full profile only";

export type CheckReport =
  | {
    result: ScriptResult;
    status: "failed" | "passed";
  }
  | {
    reason: CheckSkipReason;
    script: string;
    status: "skipped";
  };

type CheckReportOutput = {
  details: string;
  script: string;
  summary: string;
};

type CheckOptions = {
  profile: CheckProfile;
  verbose: boolean;
};

type CheckWorkflowOptions = {
  concurrency: number;
  packageScript: string;
  preflightTasks: readonly CheckTask[];
  profile: CheckProfile;
  onReport: (report: CheckReport) => void;
  runScript: (script: string) => Promise<ScriptResult>;
};

type CheckWorkflowResult =
  | {
    exitCode: 0;
    packageStatus: "passed";
  }
  | {
    exitCode: 1;
    packageStatus: "failed" | "skipped";
  };

type PreflightResult = {
  hasFailures: boolean;
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

export function resolveCheckOptions(argv: readonly string[]): CheckOptions {
  const parsed = parseArgs({
    allowPositionals: false,
    args: [...argv],
    options: {
      full: { type: "boolean" },
      verbose: { type: "boolean" }
    },
    strict: true
  });
  return {
    profile: parsed.values.full === true ? "full" : "quick",
    verbose: parsed.values.verbose === true
  };
}

async function runWorkspaceScript(script: string): Promise<ScriptResult> {
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
    const capturedOutput: string[] = [];
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => capturedOutput.push(chunk));
    child.stderr.on("data", (chunk: string) => capturedOutput.push(chunk));
    const exitCode = await new Promise<number>((resolve, reject) => {
      child.once("error", reject);
      child.once("close", (code) => resolve(code ?? 1));
    });
    return {
      capturedOutput: capturedOutput.join(""),
      durationMilliseconds: performance.now() - startedAt,
      exitCode,
      script
    };
  } catch (error) {
    return {
      capturedOutput: error instanceof Error ? error.message : String(error),
      durationMilliseconds: performance.now() - startedAt,
      exitCode: 1,
      script
    };
  }
}

function writeCapturedOutput(output: string): void {
  if (output.length === 0) {
    return;
  }
  process.stdout.write(output);
  if (!output.endsWith("\n")) {
    process.stdout.write("\n");
  }
}

export function formatDuration(durationMilliseconds: number): string {
  const milliseconds = Math.max(0, durationMilliseconds);
  if (milliseconds < 1_000) {
    return `${Math.round(milliseconds)}ms`;
  }

  const seconds = milliseconds / 1_000;
  if (seconds < 10) {
    return `${seconds.toFixed(1)}s`;
  }
  return `${Math.round(seconds)}s`;
}

export function formatCheckReport(
  report: CheckReport,
  verbose: boolean = false
): CheckReportOutput {
  if (report.status === "skipped") {
    return {
      details: "",
      script: report.script,
      summary: `  skipped: ${report.script} (${report.reason})`
    };
  }

  return {
    details: report.status === "failed" || verbose
      ? report.result.capturedOutput
      : "",
    script: report.result.script,
    summary: `  ${report.status}: ${report.result.script} `
      + `(${formatDuration(report.result.durationMilliseconds)})`
  };
}

export function formatCheckSummary(
  profile: CheckProfile,
  reports: readonly CheckReport[],
  durationMilliseconds: number
): string {
  const counts: Record<CheckStatus, number> = {
    failed: 0,
    passed: 0,
    skipped: 0
  };
  for (const report of reports) {
    counts[report.status] += 1;
  }
  const status = counts.failed === 0 ? "passed" : "failed";
  return [
    "Summary:",
    `  status: ${status}`,
    `  profile: ${profile}`,
    `  total checks: ${reports.length}`,
    `  passed: ${counts.passed}`,
    `  skipped: ${counts.skipped}`,
    `  failed: ${counts.failed}`,
    `  duration: ${formatDuration(durationMilliseconds)}`
  ].join("\n");
}

function writeCheckReport(report: CheckReport, verbose: boolean): void {
  const output = formatCheckReport(report, verbose);
  if (output.details.length > 0) {
    console.log(`\nOutput: ${output.script}`);
    writeCapturedOutput(output.details);
  }
  console.log(output.summary);
}

export async function runPreflightTasks(
  tasks: readonly CheckTask[],
  concurrency: number,
  runScript: (script: string) => Promise<ScriptResult>,
  onReport: (report: CheckReport) => void
): Promise<PreflightResult> {
  const taskIterator = tasks.values();
  let hasFailures = false;
  async function runWorker(): Promise<void> {
    while (true) {
      const nextTask = taskIterator.next();
      if (nextTask.done) {
        return;
      }

      const result = await runScript(checkTaskScript(nextTask.value));
      const status = result.exitCode === 0 ? "passed" : "failed";
      onReport({ result, status });
      if (status === "failed") {
        hasFailures = true;
      }
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(concurrency, tasks.length) },
      () => runWorker()
    )
  );
  return { hasFailures };
}

export async function runCheckWorkflow(
  options: CheckWorkflowOptions
): Promise<CheckWorkflowResult> {
  const {
    concurrency,
    packageScript,
    preflightTasks,
    profile,
    onReport,
    runScript
  } = options;
  const selectedTasks: CheckTask[] = [];
  for (const task of preflightTasks) {
    if (checkTaskRunsInProfile(task, profile)) {
      selectedTasks.push(task);
    } else {
      onReport({
        reason: "full profile only",
        script: checkTaskScript(task),
        status: "skipped"
      });
    }
  }

  const preflightResult = await runPreflightTasks(
    selectedTasks,
    concurrency,
    runScript,
    onReport
  );
  if (preflightResult.hasFailures) {
    onReport({
      reason: "failed preflight checks",
      script: packageScript,
      status: "skipped"
    });
    return {
      exitCode: 1,
      packageStatus: "skipped"
    };
  }

  const packageResult = await runScript(packageScript);
  const packageStatus = packageResult.exitCode === 0 ? "passed" : "failed";
  onReport({ result: packageResult, status: packageStatus });
  return packageStatus === "passed"
    ? { exitCode: 0, packageStatus }
    : { exitCode: 1, packageStatus };
}

async function main(): Promise<number> {
  const startedAt = performance.now();
  try {
    const options = resolveCheckOptions(process.argv.slice(2));
    const selectedTaskCount = preflightTasks.filter((task) =>
      checkTaskRunsInProfile(task, options.profile)
    ).length;
    const concurrency = resolveConcurrency({
      availableParallelism: os.availableParallelism(),
      configured: process.env.CHECK_CONCURRENCY,
      taskCount: selectedTaskCount
    });
    const reports: CheckReport[] = [];
    const totalChecks = preflightTasks.length + 1;
    console.log("Skills Workspace Check");
    console.log(`Profile: ${options.profile}`);
    console.log(`Total checks: ${totalChecks}`);
    console.log("\nChecks:");
    const result = await runCheckWorkflow({
      concurrency,
      packageScript,
      preflightTasks,
      profile: options.profile,
      onReport: (report) => {
        reports.push(report);
        writeCheckReport(report, options.verbose);
      },
      runScript: runWorkspaceScript
    });
    console.log(`\n${formatCheckSummary(
      options.profile,
      reports,
      performance.now() - startedAt
    )}`);
    return result.exitCode;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

if (isMainModule(import.meta.url)) {
  process.exitCode = await main();
}

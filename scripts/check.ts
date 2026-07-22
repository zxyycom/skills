import { spawn } from "node:child_process";
import os from "node:os";
import process from "node:process";
import { isMainModule } from "./lib/main-module.ts";
import { rootDir } from "./lib/project.ts";

const defaultConcurrencyLimit = 2;
const preflightScripts = [
  "test:test-evidence-cli",
  "test:decision-records-cli",
  "check:test-evidence-fixture",
  "test:skill-validator",
  "test:investigation-report-check",
  "check:investigations",
  "validate",
  "test:skill-updater",
  "check:test-evidence-cli",
  "check:skill-validator",
  "check:investigation-report-check",
  "check:decision-records-cli",
  "typecheck",
  "check:skill-updaters",
  "test:check",
  "test:generated-file"
] as const;
const packageScript = "pack:skills";
export const checkPackageScripts = [
  ...preflightScripts,
  packageScript
] as const;

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

type CheckStatus = "failed" | "passed";

type CheckWorkflowOptions = {
  concurrency: number;
  packageScript: string;
  preflightScripts: readonly string[];
  report: (result: ScriptResult) => void;
  runScript: (script: string) => Promise<ScriptResult>;
};

type CheckWorkflowResult =
  | { exitCode: 1; packagingSkipped: true }
  | { exitCode: 0 | 1; packagingSkipped: false };

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

export function formatCheckResult(result: ScriptResult): CheckResultOutput {
  const status = result.exitCode === 0 ? "passed" : "failed";
  return {
    stderr: result.stderr,
    stdout: result.exitCode === 0 ? "" : result.stdout,
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

function reportResult(result: ScriptResult): void {
  const output = formatCheckResult(result);
  writeCapturedOutput(output.stdout, process.stdout);
  writeCapturedOutput(output.stderr, process.stderr);
  console.log(output.summary);
}

export async function runPreflightScripts(
  scripts: readonly string[],
  concurrency: number,
  runScript: (script: string) => Promise<ScriptResult>,
  report: (result: ScriptResult) => void
): Promise<boolean> {
  const scriptIterator = scripts.values();
  let failed = false;
  async function runWorker(): Promise<void> {
    while (!failed) {
      const nextScript = scriptIterator.next();
      if (nextScript.done) {
        return;
      }

      const result = await runScript(nextScript.value);
      report(result);
      if (result.exitCode !== 0) {
        failed = true;
      }
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(concurrency, scripts.length) },
      () => runWorker()
    )
  );
  return !failed;
}

export async function runCheckWorkflow(
  options: CheckWorkflowOptions
): Promise<CheckWorkflowResult> {
  const {
    concurrency,
    packageScript,
    preflightScripts,
    report,
    runScript
  } = options;
  if (!await runPreflightScripts(
    preflightScripts,
    concurrency,
    runScript,
    report
  )) {
    return { exitCode: 1, packagingSkipped: true };
  }

  const packageResult = await runScript(packageScript);
  report(packageResult);
  return {
    exitCode: packageResult.exitCode === 0 ? 0 : 1,
    packagingSkipped: false
  };
}

async function main(): Promise<number> {
  const startedAt = performance.now();
  try {
    const concurrency = resolveConcurrency({
      availableParallelism: os.availableParallelism(),
      configured: process.env.CHECK_CONCURRENCY,
      taskCount: preflightScripts.length
    });
    console.log(
      `${preflightScripts.length} preflight checks `
      + `[running][concurrency:${concurrency}]`
    );
    const result = await runCheckWorkflow({
      concurrency,
      packageScript,
      preflightScripts,
      report: reportResult,
      runScript: runPackageScript
    });
    if (result.packagingSkipped) {
      console.error(`${packageScript} [skipped]`);
    }
    const summary = formatTimedStatus(
      `All ${preflightScripts.length} preflight checks and packaging`,
      result.exitCode === 0 ? "passed" : "failed",
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
      `All ${preflightScripts.length} preflight checks and packaging`,
      "failed",
      performance.now() - startedAt
    ));
    return 1;
  }
}

if (isMainModule(import.meta.url)) {
  process.exitCode = await main();
}

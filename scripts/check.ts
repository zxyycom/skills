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
  "validate",
  "test:skill-updater",
  "check:test-evidence-cli",
  "check:skill-validator",
  "check:decision-records-cli",
  "typecheck",
  "check:skill-updaters",
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

function resolveConcurrency(taskCount: number): number {
  const configured = process.env.CHECK_CONCURRENCY;
  if (configured === undefined) {
    return Math.min(defaultConcurrencyLimit, os.availableParallelism(), taskCount);
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

function reportResult(result: ScriptResult): void {
  writeCapturedOutput(result.stdout, process.stdout);
  writeCapturedOutput(result.stderr, process.stderr);
  const durationSeconds = (result.durationMilliseconds / 1_000).toFixed(2);
  const status = result.exitCode === 0 ? "passed" : `failed (${result.exitCode})`;
  console.log(`[check] ${result.script} ${status} in ${durationSeconds}s.`);
}

async function runPreflightChecks(): Promise<boolean> {
  const concurrency = resolveConcurrency(preflightScripts.length);
  console.log(
    `[check] Running ${preflightScripts.length} preflight checks `
    + `with concurrency ${concurrency}.`
  );

  let nextTaskIndex = 0;
  let failed = false;
  async function runWorker(): Promise<void> {
    while (!failed) {
      const taskIndex = nextTaskIndex;
      nextTaskIndex += 1;
      const script = preflightScripts[taskIndex];
      if (script === undefined) {
        return;
      }

      const result = await runPackageScript(script);
      reportResult(result);
      if (result.exitCode !== 0) {
        failed = true;
      }
    }
  }

  await Promise.all(
    Array.from({ length: concurrency }, async () => await runWorker())
  );
  return !failed;
}

async function main(): Promise<number> {
  if (!await runPreflightChecks()) {
    console.error("[check] Preflight checks failed; packaging was skipped.");
    return 1;
  }

  console.log("[check] Preflight checks passed; packaging skills.");
  const packageResult = await runPackageScript(packageScript);
  reportResult(packageResult);
  return packageResult.exitCode === 0 ? 0 : 1;
}

if (isMainModule(import.meta.url)) {
  try {
    process.exitCode = await main();
  } catch (error) {
    console.error(
      `[check] ${error instanceof Error ? error.message : String(error)}`
    );
    process.exitCode = 1;
  }
}

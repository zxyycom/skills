import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  formatCheckResult,
  formatTimedStatus,
  resolveCheckMode,
  resolveCheckStatus,
  resolveConcurrency,
  runCheckWorkflow,
  runPreflightTasks
} from "./check.ts";

function scriptResult(script: string, exitCode = 0) {
  return {
    durationMilliseconds: 1,
    exitCode,
    script,
    stderr: exitCode === 0 ? "" : `${script} failed`,
    stdout: exitCode === 0 ? `${script} passed` : `${script} context`
  };
}

assert.equal(resolveConcurrency({
  availableParallelism: 8,
  configured: undefined,
  taskCount: 5
}), 2);
assert.equal(resolveConcurrency({
  availableParallelism: 1,
  configured: undefined,
  taskCount: 5
}), 1);
assert.equal(resolveConcurrency({
  availableParallelism: 1,
  configured: "4",
  taskCount: 3
}), 3);
assert.throws(
  () => resolveConcurrency({
    availableParallelism: 8,
    configured: "0",
    taskCount: 5
  }),
  /CHECK_CONCURRENCY must be a positive integer/
);

assert.equal(resolveCheckMode([]), "warnings");
assert.equal(resolveCheckMode(["--strict"]), "strict");
assert.throws(() => resolveCheckMode(["--unknown"]), /Unknown option/u);

const blockingTask = { blocking: true, script: "blocking" } as const;
assert.equal(resolveCheckStatus("default-warning", "warnings", 1), "warning");
assert.equal(resolveCheckStatus("strict-failure", "strict", 1), "failed");
assert.equal(resolveCheckStatus(blockingTask, "warnings", 1), "failed");
assert.equal(resolveCheckStatus(blockingTask, "warnings", 0), "passed");

assert.deepEqual(formatCheckResult({
  durationMilliseconds: 250,
  exitCode: 0,
  script: "successful",
  stderr: "diagnostic\n",
  stdout: "successful details\n"
}, "passed"), {
  stderr: "diagnostic\n",
  stdout: "",
  summary: "successful [passed][0.25s]"
});
assert.deepEqual(formatCheckResult({
  durationMilliseconds: 500,
  exitCode: 1,
  script: "recoverable-task",
  stderr: "failure diagnostic\n",
  stdout: "failure context\n"
}, "warning"), {
  stderr: "failure diagnostic\n",
  stdout: "failure context\n",
  summary: "recoverable-task [warning][0.50s]"
});
assert.deepEqual(formatCheckResult({
  durationMilliseconds: 500,
  exitCode: 1,
  script: "blocking-task",
  stderr: "failure diagnostic\n",
  stdout: "failure context\n"
}, "failed"), {
  stderr: "failure diagnostic\n",
  stdout: "failure context\n",
  summary: "blocking-task [failed][0.50s]"
});
assert.equal(
  formatTimedStatus(
    "All 20 preflight checks and packaging",
    "warning",
    6_370
  ),
  "All 20 preflight checks and packaging [warning][6.37s]"
);

const slowResult = Promise.withResolvers<ReturnType<typeof scriptResult>>();
const failedResult = Promise.withResolvers<ReturnType<typeof scriptResult>>();
const strictCalls: string[] = [];
let strictRunSettled = false;
const strictRun = runPreflightTasks(
  ["slow", "failure", "must-not-start"],
  "strict",
  2,
  async (script) => {
    strictCalls.push(script);
    if (script === "slow") {
      return await slowResult.promise;
    }
    if (script === "failure") {
      return await failedResult.promise;
    }
    return scriptResult(script);
  },
  () => undefined
);
void strictRun.then(() => {
  strictRunSettled = true;
});
assert.deepEqual(strictCalls, ["slow", "failure"]);

failedResult.resolve(scriptResult("failure", 1));
await Promise.resolve();
assert.equal(strictRunSettled, false);

slowResult.resolve(scriptResult("slow"));
assert.deepEqual(await strictRun, {
  blockingFailure: true,
  hasWarnings: false
});
assert.deepEqual(strictCalls, ["slow", "failure"]);

const warningCalls: string[] = [];
const warningStatuses: string[] = [];
const warningRun = await runPreflightTasks(
  ["warning", "after-warning"],
  "warnings",
  1,
  async (script) => {
    warningCalls.push(script);
    return scriptResult(script, script === "warning" ? 1 : 0);
  },
  (_result, status) => warningStatuses.push(status)
);
assert.deepEqual(warningRun, {
  blockingFailure: false,
  hasWarnings: true
});
assert.deepEqual(warningCalls, ["warning", "after-warning"]);
assert.deepEqual(warningStatuses, ["warning", "passed"]);

const workflowCalls: string[] = [];
const defaultWarning = await runCheckWorkflow({
  concurrency: 1,
  mode: "warnings",
  packageScript: "package",
  preflightTasks: ["warning", "successful"],
  report: () => undefined,
  runScript: async (script) => {
    workflowCalls.push(script);
    return scriptResult(script, script === "warning" ? 1 : 0);
  }
});
assert.deepEqual(defaultWarning, {
  exitCode: 0,
  packagingSkipped: false,
  status: "warning"
});
assert.deepEqual(workflowCalls, ["warning", "successful", "package"]);

workflowCalls.length = 0;
const explicitBlockingFailure = await runCheckWorkflow({
  concurrency: 1,
  mode: "warnings",
  packageScript: "package",
  preflightTasks: [{ blocking: true, script: "failure" }],
  report: () => undefined,
  runScript: async (script) => {
    workflowCalls.push(script);
    return scriptResult(script, 1);
  }
});
assert.deepEqual(explicitBlockingFailure, {
  exitCode: 1,
  packagingSkipped: true,
  status: "failed"
});
assert.deepEqual(workflowCalls, ["failure"]);

workflowCalls.length = 0;
const strictFailure = await runCheckWorkflow({
  concurrency: 1,
  mode: "strict",
  packageScript: "package",
  preflightTasks: ["failure"],
  report: () => undefined,
  runScript: async (script) => {
    workflowCalls.push(script);
    return scriptResult(script, 1);
  }
});
assert.deepEqual(strictFailure, {
  exitCode: 1,
  packagingSkipped: true,
  status: "failed"
});
assert.deepEqual(workflowCalls, ["failure"]);

workflowCalls.length = 0;
const packageFailure = await runCheckWorkflow({
  concurrency: 1,
  mode: "warnings",
  packageScript: "package",
  preflightTasks: ["successful"],
  report: () => undefined,
  runScript: async (script) => {
    workflowCalls.push(script);
    return scriptResult(script, script === "package" ? 1 : 0);
  }
});
assert.deepEqual(packageFailure, {
  exitCode: 1,
  packagingSkipped: false,
  status: "failed"
});
assert.deepEqual(workflowCalls, ["successful", "package"]);

const invalidConcurrency = spawnSync(
  process.execPath,
  [fileURLToPath(new URL("./check.ts", import.meta.url))],
  {
    encoding: "utf8",
    env: { ...process.env, CHECK_CONCURRENCY: "0" },
    windowsHide: true
  }
);
assert.equal(invalidConcurrency.status, 1);
assert.equal(invalidConcurrency.stdout, "");
assert.match(
  invalidConcurrency.stderr,
  /CHECK_CONCURRENCY must be a positive integer/u
);
assert.match(
  invalidConcurrency.stderr,
  /All 20 preflight checks and packaging \[failed\]\[\d+\.\d{2}s\]/u
);

const invalidArgument = spawnSync(
  process.execPath,
  [fileURLToPath(new URL("./check.ts", import.meta.url)), "--unknown"],
  {
    encoding: "utf8",
    windowsHide: true
  }
);
assert.equal(invalidArgument.status, 1);
assert.equal(invalidArgument.stdout, "");
assert.match(invalidArgument.stderr, /Unknown option '--unknown'/u);
assert.match(
  invalidArgument.stderr,
  /All 20 preflight checks and packaging \[failed\]\[\d+\.\d{2}s\]/u
);

console.log("Check orchestration tests passed.");

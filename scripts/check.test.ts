import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  formatCheckResult,
  formatTimedStatus,
  resolveConcurrency,
  runCheckWorkflow,
  runPreflightScripts
} from "./check.ts";

function scriptResult(script: string, exitCode = 0) {
  return {
    durationMilliseconds: 1,
    exitCode,
    script,
    stderr: exitCode === 0 ? "" : `${script} failed`,
    stdout: exitCode === 0 ? `${script} passed` : ""
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

assert.deepEqual(formatCheckResult({
  durationMilliseconds: 250,
  exitCode: 0,
  script: "successful",
  stderr: "warning\n",
  stdout: "successful details\n"
}), {
  stderr: "warning\n",
  stdout: "",
  summary: "successful [passed][0.25s]"
});
assert.deepEqual(formatCheckResult({
  durationMilliseconds: 500,
  exitCode: 1,
  script: "broken-task",
  stderr: "failure diagnostic\n",
  stdout: "failure context\n"
}), {
  stderr: "failure diagnostic\n",
  stdout: "failure context\n",
  summary: "broken-task [failed][0.50s]"
});
assert.equal(
  formatTimedStatus(
    "All 16 preflight checks and packaging",
    "passed",
    6_370
  ),
  "All 16 preflight checks and packaging [passed][6.37s]"
);

const slowResult = Promise.withResolvers<ReturnType<typeof scriptResult>>();
const failedResult = Promise.withResolvers<ReturnType<typeof scriptResult>>();
const failedCalls: string[] = [];
let failureRunSettled = false;
const failureRun = runPreflightScripts(
  ["slow", "failure", "must-not-start"],
  2,
  async (script) => {
    failedCalls.push(script);
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
void failureRun.then(() => {
  failureRunSettled = true;
});
assert.deepEqual(failedCalls, ["slow", "failure"]);

failedResult.resolve(scriptResult("failure", 1));
await Promise.resolve();
assert.equal(failureRunSettled, false);

slowResult.resolve(scriptResult("slow"));
assert.equal(await failureRun, false);
assert.deepEqual(failedCalls, ["slow", "failure"]);

const workflowCalls: string[] = [];
const preflightFailure = await runCheckWorkflow({
  concurrency: 1,
  packageScript: "package",
  preflightScripts: ["failure"],
  report: () => undefined,
  runScript: async (script) => {
    workflowCalls.push(script);
    return scriptResult(script, 1);
  }
});
assert.deepEqual(preflightFailure, { exitCode: 1, packagingSkipped: true });
assert.deepEqual(workflowCalls, ["failure"]);

workflowCalls.length = 0;
const packageFailure = await runCheckWorkflow({
  concurrency: 1,
  packageScript: "package",
  preflightScripts: ["successful"],
  report: () => undefined,
  runScript: async (script) => {
    workflowCalls.push(script);
    return scriptResult(script, script === "package" ? 1 : 0);
  }
});
assert.deepEqual(packageFailure, { exitCode: 1, packagingSkipped: false });
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
  /All 16 preflight checks and packaging \[failed\]\[\d+\.\d{2}s\]/u
);

console.log("Check orchestration tests passed.");

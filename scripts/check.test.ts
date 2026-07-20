import assert from "node:assert/strict";
import {
  resolveConcurrency,
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

console.log("Check orchestration tests passed.");

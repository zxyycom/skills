import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  formatCheckReport,
  formatCheckSummary,
  formatDuration,
  resolveCheckOptions,
  resolveConcurrency,
  runCheckWorkflow,
  runPreflightTasks,
  type CheckReport
} from "./check.ts";
import {
  checkPackageScript,
  checkPackageScripts,
  checkPreflightTasks,
  checkTaskRunsInProfile,
  checkTaskScript,
  type CheckProfile,
  type CheckTask
} from "./lib/check-plan.ts";

function checkTask(
  script: string,
  minimumProfile: CheckProfile = "quick"
): CheckTask {
  return { minimumProfile, script };
}

function scriptResult(script: string, exitCode = 0) {
  return {
    capturedOutput: exitCode === 0
      ? `${script} details\n`
      : `${script} failure\n`,
    durationMilliseconds: 1,
    exitCode,
    script
  };
}

test("check plan classifies every package script by minimum profile", () => {
  const expectedCheckTasks = [
    ["test:decision-records-cli", "full"],
    ["test:version-control", "full"],
    ["test:skill-package-hash", "full"],
    ["test:investigation-report-check", "full"],
    ["test:test-evidence-cli", "full"],
    ["test:task-graph-cli", "full"],
    ["test:change-plan-cli", "quick"],
    ["test:index-runtime", "quick"],
    ["test:skill-validator", "quick"],
    ["check:investigations", "quick"],
    ["check:decisions", "quick"],
    ["validate", "quick"],
    ["test:skill-updater", "quick"],
    ["check:test-evidence-cli", "quick"],
    ["check:test-evidence-catalog", "quick"],
    ["check:skill-validator", "quick"],
    ["check:investigation-report-check", "quick"],
    ["check:change-plan-cli", "quick"],
    ["check:decision-records-cli", "quick"],
    ["check:task-graph-index", "quick"],
    ["check:task-graph-cli", "quick"],
    ["typecheck", "quick"],
    ["check:skill-updaters", "quick"],
    ["test:check", "quick"],
    ["test:environment", "quick"],
    ["test:generated-file", "quick"],
    ["hash:skills", "quick"]
  ] as const;
  assert.deepEqual(
    checkPreflightTasks.map((task) => [task.script, task.minimumProfile]),
    expectedCheckTasks
  );
  assert.deepEqual(
    checkPackageScripts,
    [...expectedCheckTasks.map(([script]) => script), "pack:skills"]
  );
  assert.equal(checkPackageScript, "pack:skills");
  assert.equal(checkTaskScript(checkTask("script")), "script");
  assert.equal(checkTaskRunsInProfile(checkTask("quick"), "quick"), true);
  assert.equal(checkTaskRunsInProfile(checkTask("quick"), "full"), true);
  assert.equal(
    checkTaskRunsInProfile(checkTask("full", "full"), "quick"),
    false
  );
  assert.equal(checkTaskRunsInProfile(checkTask("full", "full"), "full"), true);
});

test("check concurrency resolves defaults, caps, and invalid values", () => {
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
});

test("check options resolve quick, full, and verbose profiles", () => {
  assert.deepEqual(resolveCheckOptions([]), {
    profile: "quick",
    verbose: false
  });
  assert.deepEqual(resolveCheckOptions(["--full"]), {
    profile: "full",
    verbose: false
  });
  assert.deepEqual(resolveCheckOptions(["--verbose"]), {
    profile: "quick",
    verbose: true
  });
  assert.deepEqual(resolveCheckOptions(["--full", "--verbose"]), {
    profile: "full",
    verbose: true
  });
  assert.throws(() => resolveCheckOptions(["--strict"]), /Unknown option/u);
});

test("check durations use compact human-readable units", () => {
  assert.equal(formatDuration(55), "55ms");
  assert.equal(formatDuration(1_100), "1.1s");
  assert.equal(formatDuration(12_000), "12s");
});

test("check report formatting keeps success concise and failures complete", () => {
  const passedReport = {
    result: {
      capturedOutput: "successful details\n",
      durationMilliseconds: 1_100,
      exitCode: 0,
      script: "successful"
    },
    status: "passed"
  } as const;
  const failedReport = {
    result: {
      capturedOutput: "failure details\n",
      durationMilliseconds: 12_000,
      exitCode: 1,
      script: "failed"
    },
    status: "failed"
  } as const;
  const skippedReport = {
    reason: "full profile only",
    script: "slow",
    status: "skipped"
  } as const;

  assert.deepEqual(formatCheckReport(passedReport), {
    details: "",
    script: "successful",
    summary: "  passed: successful (1.1s)"
  });
  assert.deepEqual(formatCheckReport(passedReport, true), {
    details: "successful details\n",
    script: "successful",
    summary: "  passed: successful (1.1s)"
  });
  assert.deepEqual(formatCheckReport(failedReport), {
    details: "failure details\n",
    script: "failed",
    summary: "  failed: failed (12s)"
  });
  assert.deepEqual(formatCheckReport(skippedReport), {
    details: "",
    script: "slow",
    summary: "  skipped: slow (full profile only)"
  });
});

test("check summary reports profile and status counts", () => {
  const reports: CheckReport[] = [
    {
      result: {
        capturedOutput: "",
        durationMilliseconds: 1_100,
        exitCode: 0,
        script: "successful"
      },
      status: "passed"
    },
    {
      reason: "full profile only",
      script: "slow",
      status: "skipped"
    },
    {
      result: {
        capturedOutput: "failure details\n",
        durationMilliseconds: 12_000,
        exitCode: 1,
        script: "failed"
      },
      status: "failed"
    }
  ];

  assert.equal(
    formatCheckSummary(
      "quick",
      reports,
      12_000
    ),
    [
      "Summary:",
      "  status: failed",
      "  profile: quick",
      "  total checks: 3",
      "  passed: 1",
      "  skipped: 1",
      "  failed: 1",
      "  duration: 12s"
    ].join("\n")
  );
});

test("preflight scheduling continues after failures", async () => {
  const calls: string[] = [];
  const reports: CheckReport[] = [];
  const result = await runPreflightTasks(
    [checkTask("failure"), checkTask("after-failure")],
    1,
    async (script) => {
      calls.push(script);
      return scriptResult(script, script === "failure" ? 1 : 0);
    },
    (report) => reports.push(report)
  );

  assert.deepEqual(result, { hasFailures: true });
  assert.deepEqual(calls, ["failure", "after-failure"]);
  assert.deepEqual(reports.map((report) => report.status), ["failed", "passed"]);
});

test("workflow skips full checks in the quick profile", async () => {
  const calls: string[] = [];
  const reports: CheckReport[] = [];
  const result = await runCheckWorkflow({
    concurrency: 1,
    packageScript: "package",
    preflightTasks: [checkTask("slow", "full"), checkTask("quick")],
    profile: "quick",
    onReport: (report) => reports.push(report),
    runScript: async (script) => {
      calls.push(script);
      return scriptResult(script);
    }
  });

  assert.deepEqual(result, {
    exitCode: 0,
    packageStatus: "passed"
  });
  assert.deepEqual(calls, ["quick", "package"]);
  assert.deepEqual(reports.map((report) => report.status), [
    "skipped",
    "passed",
    "passed"
  ]);
});

test("workflow runs every check in the full profile", async () => {
  const calls: string[] = [];
  const reports: CheckReport[] = [];
  const result = await runCheckWorkflow({
    concurrency: 1,
    packageScript: "package",
    preflightTasks: [checkTask("slow", "full"), checkTask("quick")],
    profile: "full",
    onReport: (report) => reports.push(report),
    runScript: async (script) => {
      calls.push(script);
      return scriptResult(script);
    }
  });

  assert.deepEqual(result, {
    exitCode: 0,
    packageStatus: "passed"
  });
  assert.deepEqual(calls, ["slow", "quick", "package"]);
  assert.deepEqual(reports.map((report) => report.status), [
    "passed",
    "passed",
    "passed"
  ]);
});

test("workflow skips packaging after preflight failures", async () => {
  const calls: string[] = [];
  const reports: CheckReport[] = [];
  const result = await runCheckWorkflow({
    concurrency: 1,
    packageScript: "package",
    preflightTasks: [checkTask("failure"), checkTask("after-failure")],
    profile: "quick",
    onReport: (report) => reports.push(report),
    runScript: async (script) => {
      calls.push(script);
      return scriptResult(script, script === "failure" ? 1 : 0);
    }
  });

  assert.deepEqual(result, {
    exitCode: 1,
    packageStatus: "skipped"
  });
  assert.deepEqual(calls, ["failure", "after-failure"]);
  assert.deepEqual(reports.map((report) => report.status), [
    "failed",
    "passed",
    "skipped"
  ]);
});

test("workflow reports package script failures", async () => {
  const reports: CheckReport[] = [];
  const result = await runCheckWorkflow({
    concurrency: 1,
    packageScript: "package",
    preflightTasks: [checkTask("successful")],
    profile: "quick",
    onReport: (report) => reports.push(report),
    runScript: async (script) =>
      scriptResult(script, script === "package" ? 1 : 0)
  });

  assert.deepEqual(result, {
    exitCode: 1,
    packageStatus: "failed"
  });
  assert.deepEqual(reports.map((report) => report.status), ["passed", "failed"]);
});

test("CLI reports invalid concurrency without starting checks", () => {
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
});

test("CLI reports unknown options without starting checks", () => {
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
});

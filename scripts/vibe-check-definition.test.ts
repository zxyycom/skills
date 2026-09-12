import assert from "node:assert/strict";
import test from "node:test";
import { defineCheck, defineConfig, run } from "@zxyycom/vibe-check";
import {
  activationFlagForCheck,
  createGateDefinition,
  gateCheckIds,
  gateResourceCapacities,
  packageScriptCheckId,
  releaseGateResourceCapacities,
  releaseRequiredCheckIds,
  releaseRequiredPackageScripts,
  releaseSnapshotCheckId,
  releaseTestBatchGroups,
  releaseTestBatchLeaderCheckId,
  releaseTestBatchResourceClaim,
  semanticGateChecks,
  vibeNativeCheckIds
} from "./lib/vibe-gate.ts";
import {
  expectedSemanticCommandPaths,
  expectedSemanticGateChecks,
  expectedSemanticPrerequisites
} from "./vibe-check-catalog-fixture.ts";
import {
  aggregateOptions,
  completed,
  completedScript,
  noOutput,
  outcomeFor,
  passingNativeChecks,
  releaseTerminalCheck,
  repositoryRoot,
  runDefinition
} from "./vibe-check-test-support.ts";

function catalogDefinitions() {
  const runner = completedScript();
  const nativeChecks = passingNativeChecks();
  return {
    baseDefinition: createGateDefinition([], {
      nativeChecks,
      runCommand: runner
    }),
    incrementalDefinition: createGateDefinition([], {
      activeCheckIds: ["secret-detection"],
      nativeChecks,
      runCommand: runner
    }),
    nativeChecks,
    releaseDefinition: createGateDefinition(["release"], {
      nativeChecks,
      runCommand: runner
    }),
    runner
  };
}

test("gate Definition keeps the complete catalog and incremental selection", async () => {
  const {
    baseDefinition,
    incrementalDefinition,
    nativeChecks,
    releaseDefinition,
    runner
  } = catalogDefinitions();
  const expectedSemanticCheckIds = expectedSemanticGateChecks.map(
    ([, checkId]) => checkId
  );
  const expectedCheckIds = [
    releaseSnapshotCheckId,
    ...vibeNativeCheckIds,
    ...releaseRequiredPackageScripts.map((script) => `script:${script}`),
    ...expectedSemanticCheckIds,
    "release:skill-version",
    "pack:skills"
  ];
  assert.deepEqual(
    baseDefinition.checks.map(({ checkId }) => checkId),
    expectedCheckIds
  );
  assert.deepEqual(
    releaseDefinition.checks.map(({ checkId }) => checkId),
    expectedCheckIds
  );
  assert.deepEqual(gateCheckIds(), expectedCheckIds);
  assert.deepEqual(
    incrementalDefinition.checks.find(
      ({ checkId }) => checkId === "secret-detection"
    )?.enabledByFlags,
    {
      flags: ["gate-activation:secret-detection"],
      mode: "all"
    }
  );
  assert.deepEqual(
    incrementalDefinition.checks.find(
      ({ checkId }) => checkId === "test:change-plan:public-distribution"
    )?.enabledByFlags,
    {
      flags: ["gate-activation:test:change-plan:public-distribution"],
      mode: "all",
      propagateDependsOn: true
    }
  );
  assert.throws(
    () =>
      createGateDefinition([], {
        activeCheckIds: ["release:skill-version"],
        nativeChecks,
        runCommand: runner
      }),
    /non-base Check/u
  );
  const incrementalResult = await runDefinition(
    incrementalDefinition,
    repositoryRoot,
    [activationFlagForCheck("secret-detection")]
  );
  assert.equal(
    outcomeFor(incrementalResult, "secret-detection").status,
    "passed"
  );
  assert.equal(
    outcomeFor(incrementalResult, "duplicate-detection").status,
    "not-applicable"
  );
  assert.equal(
    baseDefinition.checks.some(({ checkId }) => checkId === "pack:skills"),
    true
  );
});

test("gate Definition keeps scheduler, output, and release DAG contracts", () => {
  const { baseDefinition, releaseDefinition } = catalogDefinitions();
  assert.equal(baseDefinition.scheduler.maxParallel, 4);
  assert.equal(baseDefinition.scheduler.admissionPolicy.kind, "custom");
  assert.deepEqual(
    baseDefinition.scheduler.resourceCapacities,
    gateResourceCapacities
  );
  assert.equal(releaseDefinition.scheduler.maxParallel, 4);
  assert.deepEqual(
    releaseDefinition.scheduler.resourceCapacities,
    releaseGateResourceCapacities
  );
  assert.deepEqual(baseDefinition.outputs, {
    diagnosticLogging: { enabled: false, directory: ".log/vibe-check" },
    machinePublication: {
      enabled: true,
      directory: ".log/vibe-check/publication"
    },
    progressRendering: {
      enabled: true,
      formatter: null,
      messagePreviewLimit: 5,
      recordPreviewLimit: 5,
      textPreviewCodePointLimit: 240
    }
  });
  assert.equal(releaseRequiredCheckIds.length, 59);
  assert.deepEqual(
    releaseDefinition.checks.find(
      ({ checkId }) => checkId === releaseSnapshotCheckId
    )?.dependsOn ?? [],
    []
  );
  assert.deepEqual(
    releaseDefinition.checks.find(
      ({ checkId }) => checkId === "release:skill-version"
    )?.dependsOn,
    [...releaseRequiredCheckIds, releaseSnapshotCheckId]
  );
  assert.deepEqual(releaseTerminalCheck(releaseDefinition).dependsOn, [
    "release:skill-version"
  ]);
  const releaseFlag = {
    flags: ["release"],
    mode: "all",
    propagateDependsOn: true
  };
  assert.deepEqual(
    releaseDefinition.checks.find(
      ({ checkId }) => checkId === "release:skill-version"
    )?.enabledByFlags,
    releaseFlag
  );
  assert.deepEqual(
    releaseTerminalCheck(releaseDefinition).enabledByFlags,
    releaseFlag
  );
  assert.deepEqual(
    releaseDefinition.checks.find(
      ({ checkId }) => checkId === releaseSnapshotCheckId
    )?.enabledByFlags,
    { flags: ["release"], mode: "all" }
  );
});

test("gate Definition projects semantic prerequisites and batch resources", () => {
  const { baseDefinition, releaseDefinition } = catalogDefinitions();
  const versionControlCheckId = packageScriptCheckId("test:version-control");
  assert.deepEqual(
    semanticGateChecks.map((check) => [
      check.requiredTag,
      check.checkId,
      check.command.command,
      check.command.args.at(-1),
      "dependsOn" in check ? check.dependsOn : []
    ]),
    expectedSemanticGateChecks.map(([requiredTag, checkId, command]) => [
      requiredTag,
      checkId,
      command,
      expectedSemanticCommandPaths.get(checkId),
      expectedSemanticPrerequisites.get(checkId) ?? []
    ])
  );
  assert.deepEqual(
    releaseDefinition.checks
      .filter(({ checkId }) => expectedSemanticPrerequisites.has(checkId))
      .map(({ checkId, dependsOn }) => [checkId, dependsOn]),
    [...expectedSemanticPrerequisites]
  );
  const batchedIds = new Set(
    releaseTestBatchGroups.map(({ checkId }) => checkId)
  );
  const batchLeader = releaseDefinition.checks.find(
    ({ checkId }) => checkId === releaseTestBatchLeaderCheckId
  );
  assert.deepEqual(batchLeader?.resourceClaims, releaseTestBatchResourceClaim);
  assert.equal(batchLeader?.observes, undefined);
  for (const {
    checkId,
    observes,
    resourceClaims
  } of releaseDefinition.checks.filter(
    ({ checkId }) =>
      batchedIds.has(checkId) && checkId !== releaseTestBatchLeaderCheckId
  )) {
    assert.deepEqual(observes, [releaseTestBatchLeaderCheckId], checkId);
    assert.equal(resourceClaims, undefined, checkId);
  }
  for (const { checkId, resourceClaims } of releaseDefinition.checks.filter(
    ({ checkId }) =>
      (checkId.startsWith("script:") || checkId.startsWith("test:")) &&
      !batchedIds.has(checkId) &&
      checkId !== versionControlCheckId
  )) {
    assert.deepEqual(
      resourceClaims,
      { "external-process": 1, "cpu-work": 1 },
      checkId
    );
  }
  assert.deepEqual(
    releaseDefinition.checks.find(
      ({ checkId }) => checkId === versionControlCheckId
    )?.resourceClaims,
    { "external-process": 1, "cpu-work": 4 }
  );
  for (const { checkId, resourceClaims } of baseDefinition.checks.filter(
    ({ checkId }) =>
      checkId.startsWith("script:") || checkId.startsWith("test:")
  )) {
    assert.deepEqual(resourceClaims, { "external-process": 1 }, checkId);
  }
});

test("native flag selection keeps inactive release Checks visible without starting Check work", async () => {
  let originalPreflightCalls = 0;
  let releaseExecutionCalls = 0;
  const definition = defineConfig({
    checks: [
      defineCheck({
        checkId: "base",
        displayName: "base",
        execution: () => ({ status: "passed" as const, data: {} })
      }),
      defineCheck({
        checkId: "release",
        displayName: "release",
        enabledByFlags: { flags: ["release"], mode: "all" },
        preflight: () => {
          originalPreflightCalls += 1;
          return { status: "success" as const, preparedOptions: {} };
        },
        execution: () => {
          releaseExecutionCalls += 1;
          return { status: "passed" as const, data: {} };
        }
      })
    ],
    outputs: noOutput
  });
  const result = completed(
    await run(definition, {
      checkAggregation: { ...aggregateOptions, checks: "effective" },
      flags: [],
      outputs: noOutput,
      projectRoot: repositoryRoot
    })
  );
  assert.equal(result.aggregate, "passed");
  assert.equal(result.snapshot.checks.length, 2);
  assert.equal(outcomeFor(result, "release").status, "not-applicable");
  assert.equal(
    result.checkDurations.find(({ checkId }) => checkId === "release")
      ?.durationMs,
    null
  );
  assert.equal(originalPreflightCalls, 0);
  assert.equal(releaseExecutionCalls, 0);
  const releaseOutcome = outcomeFor(result, "release");
  if (releaseOutcome.status !== "not-applicable") {
    throw new Error("expected inactive release Check to be not-applicable");
  }
  assert.equal(releaseOutcome.reason?.code, "flag-condition-not-matched");
});

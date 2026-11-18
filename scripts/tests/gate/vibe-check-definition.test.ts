import assert from "node:assert/strict";
import test from "node:test";
import {
  createGateDefinition,
  gateCheckIds,
  gateEnvironmentCheckId,
  gateResourceCapacities,
  releaseGateResourceCapacities,
  vibeNativeCheckIds
} from "../../lib/vibe-gate.ts";
import {
  expectedReleaseOnlyCheckIds,
  expectedSemanticPrerequisites
} from "./vibe-check-catalog-fixture.ts";

test("gate Definition keeps the complete catalog and incremental selection", () => {
  const definition = createGateDefinition([], {
    activeToolIds: ["repository-code"]
  });
  assert.deepEqual(
    definition.checks.map(({ checkId }) => checkId),
    gateCheckIds()
  );
  for (const checkId of vibeNativeCheckIds) {
    const check = definition.checks.find(
      (candidate) => candidate.checkId === checkId
    );
    assert.deepEqual(
      check?.enabledByFlags,
      checkId === "markdown-lint"
        ? {
            when: { kind: "any", conditions: ["gate-tool:markdown-content"] },
            propagateDependsOn: true
          }
        : undefined,
      checkId
    );
    assert.deepEqual(check?.dependsOn, [gateEnvironmentCheckId], checkId);
  }
  assert.deepEqual(
    definition.checks.find(({ checkId }) => checkId === "script:typecheck")
      ?.enabledByFlags,
    {
      when: { kind: "any", conditions: ["gate-tool:typescript-program"] },
      propagateDependsOn: true
    }
  );
  assert.throws(
    () =>
      createGateDefinition([], { activeToolIds: ["release:skill-version"] }),
    /unknown tool/u
  );
});

test("gate Definition keeps scheduler, output, and release DAG contracts", () => {
  const base = createGateDefinition();
  const release = createGateDefinition(["release"]);
  assert.equal(base.scheduler.maxParallel, 4);
  assert.equal(base.scheduler.admissionPolicy.kind, "custom");
  assert.deepEqual(base.scheduler.resourceCapacities, gateResourceCapacities);
  assert.deepEqual(
    release.scheduler.resourceCapacities,
    releaseGateResourceCapacities
  );
  assert.deepEqual(
    release.checks.find(({ checkId }) => checkId === "release:skill-prepare")
      ?.dependsOn,
    [gateEnvironmentCheckId]
  );
  const versionDependencies = release.checks.find(
    ({ checkId }) => checkId === "release:skill-version"
  )?.dependsOn;
  const baseCheckIds = release.checks
    .map(({ checkId }) => checkId)
    .filter(
      (checkId) => !expectedReleaseOnlyCheckIds.some((id) => id === checkId)
    );
  assert.ok(Array.isArray(versionDependencies));
  const dependencies: readonly unknown[] = versionDependencies;
  assert.ok(dependencies.every((id) => typeof id === "string"));
  assert.deepEqual(
    [...dependencies].sort(),
    [...baseCheckIds, "release:skill-prepare"].sort()
  );
  assert.deepEqual(
    release.checks.find(({ checkId }) => checkId === "pack:skills")?.dependsOn,
    [gateEnvironmentCheckId, "release:skill-version"]
  );
  for (const id of expectedReleaseOnlyCheckIds)
    assert.deepEqual(
      release.checks.find(({ checkId }) => checkId === id)?.enabledByFlags,
      { when: "release", propagateDependsOn: true }
    );
  assert.equal(base.outputs.machinePublication.enabled, true);
  assert.equal(base.outputs.diagnosticLogging.enabled, false);
});

test("gate Definition projects semantic prerequisites and independent command resources", () => {
  const release = createGateDefinition(["release"]);
  assert.deepEqual(
    release.checks.find(
      ({ checkId }) => checkId === "script:test:skill-updater"
    )?.dependsOn,
    [gateEnvironmentCheckId, "script:check:skill-updaters"]
  );
  for (const check of release.checks) {
    assert.equal(check.observes, undefined, check.checkId);
    assert.equal(
      check.resourceClaims?.["cpu-work"],
      check.checkId === "script:test:version-control" ? 4 : 1,
      check.checkId
    );
    if (
      check.checkId.startsWith("script:") ||
      check.checkId.startsWith("test:")
    )
      assert.equal(
        check.resourceClaims?.["external-process"],
        1,
        check.checkId
      );
    const expected = expectedSemanticPrerequisites.get(check.checkId);
    if (expected !== undefined)
      assert.deepEqual(check.dependsOn, [gateEnvironmentCheckId, ...expected]);
  }
});

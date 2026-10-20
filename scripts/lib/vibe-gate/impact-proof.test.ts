import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";
import { writeReceiptManifest } from "./impact-receipts.ts";
import {
  baseGateCheckIds,
  gateActivationFlags,
  publishGateReceipts,
  validateBaseGateImpactContracts
} from "./impact.ts";
import {
  prepareFixtureActivation,
  publishInitialFixtureReceipts,
  withImpactFixture
} from "./impact-test-support.ts";

test("incremental Gate reuses only exact successful receipts", async () => {
  await withImpactFixture(async (fixture) => {
    assert.deepEqual(validateBaseGateImpactContracts(), []);
    assert.ok(!baseGateCheckIds.includes("markdown-link-validation"));
    assert.ok(!baseGateCheckIds.includes("environment"));
    await publishInitialFixtureReceipts(fixture);
    const warm = await prepareFixtureActivation(fixture);
    assert.deepEqual(warm.activeCheckIds, []);
    assert.equal(
      warm.decisions.filter(({ action }) => action === "reuse").length,
      baseGateCheckIds.length
    );
    assert.deepEqual(gateActivationFlags(warm), []);
    await writeReceiptManifest(
      fixture.cacheDirectory,
      warm.decisions
        .filter(({ checkId }) => checkId !== "script:test:skill-updater")
        .map(({ checkId, fingerprint }) => {
          assert.ok(fingerprint);
          return { checkId, fingerprint, outcome: "passed" as const };
        })
    );
    // Only the missing project receipt is selected; native dependsOn propagation owns provider activation.
    assert.deepEqual((await prepareFixtureActivation(fixture)).activeCheckIds, [
      "script:test:skill-updater"
    ]);
  });
});

test("incremental Gate publishes nothing when the final Run did not succeed", async () => {
  await withImpactFixture(async (fixture) => {
    const plan = await prepareFixtureActivation(fixture);
    const result = await publishGateReceipts(
      plan,
      { runSucceeded: false, passedCheckIds: fixture.passedCheckIds },
      fixture.directory,
      fixture.captureDependencies
    );
    assert.deepEqual(result, { published: false, reason: "check-not-passed" });
    assert.equal(
      await fs.stat(fixture.cacheDirectory).then(
        () => true,
        () => false
      ),
      false
    );
    assert.equal(
      (await prepareFixtureActivation(fixture)).activeCheckIds.length,
      baseGateCheckIds.length
    );
  });
});

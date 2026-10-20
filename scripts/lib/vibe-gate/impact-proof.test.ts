import assert from "node:assert/strict";
import test from "node:test";
import { writeReceiptManifest } from "./impact-receipts.ts";
import {
  baseGateCheckIds,
  gateActivationFlags,
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
    assert.equal(baseGateCheckIds.length, 64);
    await publishInitialFixtureReceipts(fixture);

    const warm = await prepareFixtureActivation(fixture);
    assert.deepEqual(warm.activeCheckIds, []);
    assert.equal(
      warm.decisions.filter(({ action }) => action === "reuse").length,
      64
    );
    assert.deepEqual(gateActivationFlags(warm), []);
    // A cached provider must execute again when its importing consumer has no receipt.
    await writeReceiptManifest(
      fixture.cacheDirectory,
      warm.decisions
        .filter(({ checkId }) => checkId !== "script:test:skill-updater")
        .map(({ checkId, fingerprint }) => {
          assert.ok(fingerprint);
          return { checkId, fingerprint, outcome: "passed" as const };
        })
    );
    const importingConsumer = await prepareFixtureActivation(fixture);
    assert.deepEqual(
      new Set(importingConsumer.activeCheckIds),
      new Set(["script:test:skill-updater", "script:check:skill-updaters"])
    );
    assert.equal(
      importingConsumer.decisions.find(
        ({ checkId }) => checkId === "script:check:skill-updaters"
      )?.reason,
      "dependency-required"
    );
  });
});

import assert from "node:assert/strict";
import test from "node:test";
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
    assert.equal(baseGateCheckIds.length, 59);
    await publishInitialFixtureReceipts(fixture);

    const warm = await prepareFixtureActivation(fixture);
    assert.deepEqual(warm.activeCheckIds, []);
    assert.equal(
      warm.decisions.filter(({ action }) => action === "reuse").length,
      59
    );
    assert.deepEqual(gateActivationFlags(warm), []);
  });
});

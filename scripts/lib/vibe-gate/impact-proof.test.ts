import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";
import {
  readReceiptManifest,
  writeReceiptManifest
} from "./impact-receipts.ts";
import {
  baseGateCheckIds,
  baseGateImpactContracts,
  gateCheckToolFingerprints,
  gateActivationFlags,
  publishGateReceipts,
  validateBaseGateImpactContracts
} from "./impact.ts";
import {
  prepareFixtureActivation,
  publishInitialFixtureReceipts,
  publishFixtureReceipts,
  withImpactFixture
} from "./impact-test-support.ts";

test("incremental Gate reuses only exact successful receipts", async () => {
  await withImpactFixture(async (fixture) => {
    assert.deepEqual(validateBaseGateImpactContracts(), []);
    assert.ok(baseGateCheckIds.includes("markdown-lint"));
    assert.equal(baseGateCheckIds.length, 56);
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
        .filter(({ checkId }) => checkId !== "script:typecheck")
        .map(({ checkId, fingerprint }) => {
          assert.ok(fingerprint);
          assert.equal(warm.kind, "incremental");
          return {
            checkId,
            fingerprint,
            outcome: "passed" as const,
            toolFingerprints: gateCheckToolFingerprints(
              baseGateImpactContracts.find(
                (contract_) => contract_.checkId === checkId
              )!,
              warm.snapshot
            )
          };
        })
    );
    // A shared tool activates every subscriber, even an exact-proof subscriber.
    const sharedTrigger = await prepareFixtureActivation(fixture);
    assert.deepEqual(sharedTrigger.activeToolIds, ["repository-code"]);
    assert.deepEqual(sharedTrigger.activeCheckIds, [
      "script:typecheck",
      "script:lint",
      "script:format:check"
    ]);
    assert.equal(
      sharedTrigger.decisions.find(({ checkId }) => checkId === "script:lint")
        ?.reason,
      "tool-triggered"
    );
    assert.deepEqual(
      await publishFixtureReceipts(
        fixture,
        sharedTrigger,
        new Set(["script:typecheck"])
      ),
      {
        published: false,
        reason: "check-not-passed"
      }
    );
    assert.equal(
      (await publishFixtureReceipts(fixture, sharedTrigger)).published,
      true
    );
    assert.deepEqual(
      (await prepareFixtureActivation(fixture)).activeToolIds,
      []
    );
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

test("incremental Gate rejects incomplete or inconsistent tool components despite an exact Check fingerprint", async () => {
  await withImpactFixture(async (fixture) => {
    await publishInitialFixtureReceipts(fixture);
    const { manifest } = await readReceiptManifest(fixture.cacheDirectory);
    assert.ok(manifest);
    const original = manifest.receipts.find(
      ({ checkId }) => checkId === "script:typecheck"
    );
    assert.ok(original);
    const components: readonly Readonly<Record<string, string>>[] = [
      { unrelated: "0".repeat(64) },
      {},
      { ...original.toolFingerprints, unrelated: "0".repeat(64) },
      { "repository-code": "0".repeat(64) }
    ];
    for (const toolFingerprints of components) {
      await writeReceiptManifest(
        fixture.cacheDirectory,
        manifest.receipts.map((receipt) =>
          receipt.checkId === original.checkId
            ? { ...receipt, toolFingerprints }
            : receipt
        )
      );
      const plan = await prepareFixtureActivation(fixture);
      assert.equal(
        plan.decisions.find(({ checkId }) => checkId === original.checkId)
          ?.action,
        "execute"
      );
      assert.ok(plan.activeToolIds.includes("repository-code"));
    }
  });
});

test("incremental Gate records generated prerequisites as execution and requires their passed outcome", async () => {
  await withImpactFixture(async (fixture) => {
    await publishInitialFixtureReceipts(fixture);
    const { manifest } = await readReceiptManifest(fixture.cacheDirectory);
    assert.ok(manifest);
    await writeReceiptManifest(
      fixture.cacheDirectory,
      manifest.receipts.filter(
        ({ checkId }) => checkId !== "test:novel-cards:card-and-query-contract"
      )
    );
    const plan = await prepareFixtureActivation(fixture);
    assert.deepEqual(plan.activeToolIds, ["novel-cards"]);
    assert.deepEqual(plan.activeCheckIds, [
      "script:check:skill-updaters",
      "test:novel-cards:card-and-query-contract"
    ]);
    assert.equal(
      plan.decisions.find(
        ({ checkId }) => checkId === "script:check:skill-updaters"
      )?.reason,
      "prerequisite-triggered"
    );
    assert.deepEqual(
      await publishFixtureReceipts(
        fixture,
        plan,
        new Set(["test:novel-cards:card-and-query-contract"])
      ),
      {
        published: false,
        reason: "check-not-passed"
      }
    );
    assert.equal((await publishFixtureReceipts(fixture, plan)).published, true);
  });
});

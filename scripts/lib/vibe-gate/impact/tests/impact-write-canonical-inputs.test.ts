import assert from "node:assert/strict";
import test from "node:test";
import {
  prepareChangedFixtureActivation,
  withImpactFixture
} from "./impact-test-support.ts";

test("incremental Gate selects write and canonical consumer tests for their leaves", async () => {
  await withImpactFixture(async (fixture) => {
    for (const [input, checkId] of [
      [
        "tools/shared/tests/version-control/blob/version-control-blob-write.test.ts",
        "script:test:version-control"
      ],
      [
        "tools/shared/tests/version-control/blob/version-control-blob-write-failure.test.ts",
        "script:test:version-control"
      ],
      [
        "tools/shared/tests/version-control/blob/version-control-blob-write-support.ts",
        "script:test:version-control"
      ],
      [
        "tools/index-runtime/tests/storage/canonical-eligibility.test.ts",
        "script:test:index-runtime"
      ],
      [
        "tools/decision-records/tests/queries/canonical-sync-cost.test.ts",
        "test:decision-records:query-and-index-projection"
      ],
      [
        "scripts/lib/vibe-gate/impact/tests/impact-write-canonical-inputs.test.ts",
        "script:test:check"
      ]
    ] as const) {
      const plan = await prepareChangedFixtureActivation(fixture, input);
      assert.equal(plan.kind, "incremental");
      assert.deepEqual(plan.snapshot.unclassifiedPaths, []);
      assert.ok(plan.activeCheckIds.includes(checkId), input);
    }
  });
});

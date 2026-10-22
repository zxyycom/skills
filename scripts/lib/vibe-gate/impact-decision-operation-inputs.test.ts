import assert from "node:assert/strict";
import test from "node:test";
import {
  prepareChangedFixtureActivation,
  withImpactFixture
} from "./impact-test-support.ts";

test("incremental Gate tracks Decision local operation and source safety closures", async () => {
  await withImpactFixture(async (fixture) => {
    const commonConsumers = [
      "test:decision-records:query-and-index-projection",
      "test:decision-records:lifecycle-and-recovery",
      "test:decision-records:public-distribution",
      "script:check:decisions"
    ];
    for (const group of [
      {
        inputs: [
          "tools/decision-records/src/decision-maintenance-context.ts",
          "tools/decision-records/src/decision-maintenance-transaction.ts",
          "tools/decision-records/tests/local-operation-contracts.test.ts"
        ],
        tools: ["decision-maintenance"],
        execute: commonConsumers,
        reuse: [
          "test:decision-records:pending-stage",
          "test:decision-records:record-and-established-graph"
        ]
      },
      {
        inputs: [
          "tools/decision-records/src/decision-source-dependencies.ts",
          "tools/decision-records/src/decision-source-path-safety.ts"
        ],
        tools: ["decision-record"],
        execute: [
          ...commonConsumers,
          "test:decision-records:pending-stage",
          "test:decision-records:record-and-established-graph"
        ],
        reuse: []
      },
      {
        inputs: [
          "tools/decision-records/src/decision-stage-refresh-context.ts",
          "tools/decision-records/src/decision-stage-refresh-sources.ts",
          "tools/decision-records/tests/local-stage-contracts.test.ts"
        ],
        tools: ["decision-stage"],
        execute: [...commonConsumers, "test:decision-records:pending-stage"],
        reuse: ["test:decision-records:record-and-established-graph"]
      },
      {
        inputs: ["tools/decision-records/tests/support-local-contracts.ts"],
        tools: ["decision-maintenance", "decision-stage"],
        execute: [...commonConsumers, "test:decision-records:pending-stage"],
        reuse: ["test:decision-records:record-and-established-graph"]
      }
    ]) {
      for (const input of group.inputs) {
        const changed = await prepareChangedFixtureActivation(fixture, input);
        assert.equal(changed.kind, "incremental", input);
        for (const toolId of group.tools)
          assert.ok(changed.activeToolIds.includes(toolId), input);
        for (const checkId of group.execute)
          assert.equal(
            changed.decisions.find((item) => item.checkId === checkId)?.action,
            "execute",
            `${input}: ${checkId}`
          );
        for (const checkId of [
          ...group.reuse,
          "test:investigation-report:pending-stage",
          "markdown-lint"
        ])
          assert.equal(
            changed.decisions.find((item) => item.checkId === checkId)?.action,
            "reuse",
            `${input}: ${checkId}`
          );
      }
    }
  });
});

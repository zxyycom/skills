import assert from "node:assert/strict";
import test from "node:test";
import {
  prepareChangedFixtureActivation,
  withImpactFixture
} from "./impact-test-support.ts";

const decisionChecks = [
  "test:decision-records:record-and-established-graph",
  "test:decision-records:query-and-index-projection",
  "test:decision-records:lifecycle-and-recovery",
  "test:decision-records:pending-stage",
  "test:decision-records:cli-contract",
  "test:decision-records:public-distribution",
  "script:check:decisions"
];
const maintenanceConsumers = decisionChecks.filter(
  (id) => !id.endsWith(":pending-stage")
);

test("incremental Gate tracks Decision local operation and source safety closures", async () => {
  await withImpactFixture(async (fixture) => {
    for (const group of [
      {
        inputs: [
          "tools/decision-records/src/decision-maintenance-context.ts",
          "tools/decision-records/src/decision-maintenance-transaction.ts"
        ],
        tools: ["decision-maintenance"],
        execute: maintenanceConsumers
      },
      {
        inputs: [
          "tools/decision-records/tests/local-operation-contracts.test.ts"
        ],
        tools: ["decision-maintenance-tests"],
        execute: ["test:decision-records:lifecycle-and-recovery"]
      },
      {
        inputs: [
          "tools/decision-records/src/decision-source-dependencies.ts",
          "tools/decision-records/src/decision-source-path-safety.ts"
        ],
        tools: ["decision-record"],
        execute: decisionChecks
      },
      {
        inputs: [
          "tools/decision-records/src/decision-stage-refresh-context.ts",
          "tools/decision-records/src/decision-stage-refresh-sources.ts"
        ],
        tools: ["decision-stage"],
        execute: [
          ...maintenanceConsumers,
          "test:decision-records:pending-stage"
        ]
      },
      {
        inputs: ["tools/decision-records/tests/local-stage-contracts.test.ts"],
        tools: ["decision-stage-tests"],
        execute: ["test:decision-records:pending-stage"]
      },
      {
        inputs: ["tools/decision-records/tests/support-local-contracts.ts"],
        tools: [
          "decision-query-tests",
          "decision-maintenance-tests",
          "decision-stage-tests",
          "decision-cli-tests"
        ],
        execute: [
          "test:decision-records:query-and-index-projection",
          "test:decision-records:lifecycle-and-recovery",
          "test:decision-records:pending-stage",
          "test:decision-records:cli-contract"
        ]
      }
    ]) {
      for (const input of group.inputs) {
        const changed = await prepareChangedFixtureActivation(fixture, input);
        assert.equal(changed.kind, "incremental", input);
        for (const toolId of group.tools)
          assert.ok(
            changed.activeToolIds.includes(toolId),
            `${input}: ${toolId}`
          );
        for (const checkId of [
          ...decisionChecks,
          "test:investigation-report:pending-stage",
          "markdown-lint"
        ])
          assert.equal(
            changed.decisions.find((item) => item.checkId === checkId)?.action,
            group.execute.includes(checkId) ? "execute" : "reuse",
            `${input}: ${checkId}`
          );
      }
    }
  });
});

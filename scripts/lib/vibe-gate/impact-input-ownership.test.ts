import assert from "node:assert/strict";
import test from "node:test";
import { domainInputOwnershipCases } from "./impact-input-ownership-fixture.ts";
import {
  prepareChangedFixtureActivation,
  prepareFixtureActivation,
  publishFixtureReceipts,
  withImpactFixture
} from "./impact-test-support.ts";

test("incremental Gate closes lazy relation inputs through their existing capabilities", async () => {
  await withImpactFixture(async (fixture) => {
    for (const group of [
      {
        input:
          "tools/decision-records/tests/lazy-relation-graph/context.test.ts",
        toolId: "decision-query",
        execute: ["test:decision-records:query-and-index-projection"],
        reuse: [
          "test:decision-records:record-and-established-graph",
          "test:investigation-report:index-and-query",
          "script:test:relation-graph"
        ]
      },
      {
        input:
          "tools/decision-records/tests/lazy-relation-graph/queries.test.ts",
        toolId: "decision-query",
        execute: ["test:decision-records:query-and-index-projection"],
        reuse: ["test:decision-records:record-and-established-graph"]
      },
      {
        input: "tools/decision-records/tests/lazy-relation-graph/support.ts",
        toolId: "decision-query",
        execute: ["test:decision-records:query-and-index-projection"],
        reuse: ["test:decision-records:record-and-established-graph"]
      },
      {
        input: "tools/decision-records/src/decision-index-snapshot.ts",
        toolId: "decision-record",
        execute: ["test:decision-records:query-and-index-projection"],
        reuse: ["test:investigation-report:index-and-query"]
      },
      {
        input: "tools/decision-records/src/scan-snapshot.ts",
        toolId: "decision-record",
        execute: ["test:decision-records:record-and-established-graph"],
        reuse: ["test:investigation-report:index-and-query"]
      },
      {
        input: "tools/decision-records/src/scan-relationship-snapshot.ts",
        toolId: "decision-record",
        execute: ["test:decision-records:record-and-established-graph"],
        reuse: ["test:investigation-report:index-and-query"]
      },
      {
        input: "tools/investigation-report/src/relation-context.ts",
        toolId: "investigation-record",
        execute: [
          "test:investigation-report:collection-and-resources",
          "test:investigation-report:index-and-query",
          "test:investigation-report:transactional-maintenance",
          "test:investigation-report:pending-stage",
          "test:investigation-report:cli-contract"
        ],
        reuse: ["test:decision-records:record-and-established-graph"]
      },
      {
        input: "tools/investigation-report/tests/relation-context.test.ts",
        toolId: "investigation-query",
        execute: ["test:investigation-report:index-and-query"],
        reuse: ["test:decision-records:query-and-index-projection"]
      },
      {
        input: "tools/investigation-report/tests/relation-order.test.ts",
        toolId: "investigation-query",
        execute: ["test:investigation-report:index-and-query"],
        reuse: ["test:decision-records:query-and-index-projection"]
      },
      {
        input: "tools/investigation-report/tests/relation-context-support.ts",
        toolId: "investigation-query",
        execute: ["test:investigation-report:index-and-query"],
        reuse: ["test:decision-records:query-and-index-projection"]
      },
      {
        input: "tools/shared/tests/lazy-relation-graph.test.ts",
        toolId: "relation-graph-tests",
        execute: ["script:test:relation-graph"],
        reuse: [
          "test:decision-records:record-and-established-graph",
          "test:investigation-report:index-and-query"
        ]
      }
    ]) {
      const plan = await prepareChangedFixtureActivation(fixture, group.input);
      assert.equal(plan.kind, "incremental");
      assert.deepEqual(plan.snapshot.unclassifiedPaths, [], group.input);
      assert.ok(plan.activeToolIds.includes(group.toolId), group.input);
      for (const [action, checkIds] of [
        ["execute", group.execute],
        ["reuse", group.reuse]
      ] as const) {
        for (const checkId of checkIds)
          assert.equal(
            plan.decisions.find((decision) => decision.checkId === checkId)
              ?.action,
            action,
            `${group.input}: ${checkId}`
          );
      }
      assert.equal(
        (await publishFixtureReceipts(fixture, plan)).published,
        true
      );
      const warm = await prepareFixtureActivation(fixture);
      assert.equal(warm.activeCheckIds.length, 0, group.input);
    }
  });
});

test("incremental Gate recognizes shared record operations only in actual domain consumers", async () => {
  await withImpactFixture(async (fixture) => {
    for (const input of [
      "tools/record-operations/src/query.ts",
      "tools/record-operations/src/synchronize.ts",
      "tools/record-operations/src/candidate.ts",
      "tools/record-operations/tests/query-contract.ts"
    ]) {
      const plan = await prepareChangedFixtureActivation(fixture, input);
      assert.equal(plan.kind, "incremental");
      assert.deepEqual(plan.snapshot.unclassifiedPaths, []);
      for (const checkId of [
        "test:decision-records:query-and-index-projection",
        "test:decision-records:lifecycle-and-recovery",
        "test:investigation-report:index-and-query",
        "test:investigation-report:transactional-maintenance"
      ])
        assert.equal(
          plan.decisions.find((decision) => decision.checkId === checkId)
            ?.action,
          "execute",
          `${input}: ${checkId}`
        );
      for (const checkId of [
        "script:test:index-runtime",
        "test:task-graph:index-and-projection",
        "test:novel-cards:card-and-query-contract"
      ])
        assert.equal(
          plan.decisions.find((decision) => decision.checkId === checkId)
            ?.action,
          "reuse",
          `${input}: ${checkId}`
        );
      assert.equal(
        (await publishFixtureReceipts(fixture, plan)).published,
        true
      );
      assert.equal(
        (await prepareFixtureActivation(fixture)).activeCheckIds.length,
        0
      );
    }
    for (const [input, toolId, checkId] of domainInputOwnershipCases) {
      const plan = await prepareChangedFixtureActivation(fixture, input);
      assert.equal(plan.kind, "incremental");
      assert.deepEqual(plan.snapshot.unclassifiedPaths, []);
      assert.ok(plan.activeToolIds.includes(toolId), input);
      assert.equal(
        plan.decisions.find((decision) => decision.checkId === checkId)?.action,
        "execute"
      );
      const otherDomainChecks = input.startsWith("tools/decision-records/")
        ? [
            "test:investigation-report:index-and-query",
            "test:investigation-report:transactional-maintenance"
          ]
        : [
            "test:decision-records:query-and-index-projection",
            "test:decision-records:lifecycle-and-recovery"
          ];
      for (const unrelatedCheck of [
        ...otherDomainChecks,
        "script:test:index-runtime",
        "test:task-graph:index-and-projection",
        "test:novel-cards:card-and-query-contract"
      ])
        assert.equal(
          plan.decisions.find(({ checkId }) => checkId === unrelatedCheck)
            ?.action,
          "reuse",
          `${input}: ${unrelatedCheck}`
        );
      assert.equal(
        (await publishFixtureReceipts(fixture, plan)).published,
        true
      );
      assert.equal(
        (await prepareFixtureActivation(fixture)).activeCheckIds.length,
        0
      );
    }
  });
});

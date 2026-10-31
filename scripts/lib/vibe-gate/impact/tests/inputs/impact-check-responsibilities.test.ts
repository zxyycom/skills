import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";
import path from "node:path";
import { defineCheck, defineConfig } from "@zxyycom/vibe-check";
import {
  semanticGateChecks,
  createSemanticGateCheck,
  type SemanticGateCheck
} from "../../../checks/semantic.ts";
import {
  createPackageScriptCheck,
  packageScriptDependencies
} from "../../../checks/package-script.ts";
import {
  runDefinition,
  outcomeFor,
  withTemporaryDirectory
} from "../../../../../tests/gate/vibe-check-test-support.ts";
import {
  prepareChangedFixtureActivation,
  prepareFixtureActivation,
  publishFixtureReceipts,
  withImpactFixture
} from "../impact-test-support.ts";

test("domain test aggregates stay owned by their real catalog consumers without fallback", async () => {
  await withImpactFixture(async (fixture) => {
    for (const input of [
      "tools/decision-records/tests/run.ts",
      "tools/investigation-report/tests/run.ts"
    ]) {
      const plan = await prepareChangedFixtureActivation(fixture, input);
      assert.equal(plan.kind, "incremental", input);
      assert.deepEqual(plan.snapshot.unclassifiedPaths, [], input);
      for (const checkId of [
        "script:test:check",
        "script:check:test-evidence-catalog"
      ])
        assert.equal(
          plan.decisions.find((item) => item.checkId === checkId)?.action,
          "execute",
          `${input}: ${checkId}`
        );
      for (const checkId of [
        "test:decision-records:record-and-established-graph",
        "test:decision-records:query-and-index-projection",
        "test:decision-records:lifecycle-and-recovery",
        "test:decision-records:cli-contract",
        "test:investigation-report:index-and-query",
        "test:investigation-report:transactional-maintenance",
        "test:investigation-report:cli-contract"
      ])
        assert.equal(
          plan.decisions.find((item) => item.checkId === checkId)?.action,
          "reuse",
          `${input}: ${checkId}`
        );
    }
  });
});

test("Test Evidence project checks own their adapter tree without widening core or unrelated script inputs", async () => {
  await withImpactFixture(async (fixture) => {
    const projectChecks = [
      "test:test-evidence:project-snapshot",
      "test:test-evidence:project-reference-check",
      "test:test-evidence:migration"
    ];
    for (const input of [
      "scripts/test-evidence/snapshot/snapshot.ts",
      "scripts/test-evidence/check.ts",
      "scripts/test-evidence/migration/migrate.ts",
      "scripts/test-evidence/snapshot/snapshot.test.ts",
      "scripts/test-evidence/migration/tests/migrate-preflight.test.ts",
      "scripts/test-evidence/test-fixture.ts"
    ]) {
      const plan = await prepareChangedFixtureActivation(fixture, input);
      for (const checkId of projectChecks)
        assert.equal(
          plan.decisions.find((item) => item.checkId === checkId)?.action,
          "execute",
          `${input}: ${checkId}`
        );
      for (const checkId of [
        "test:test-evidence:case-runtime",
        "test:test-evidence:public-boundary"
      ])
        assert.equal(
          plan.decisions.find((item) => item.checkId === checkId)?.action,
          "reuse",
          `${input}: ${checkId}`
        );
    }
    const unrelated = await prepareChangedFixtureActivation(
      fixture,
      "scripts/tests/repository/publish-skills.test.ts"
    );
    for (const checkId of projectChecks)
      assert.equal(
        unrelated.decisions.find((item) => item.checkId === checkId)?.action,
        "reuse",
        checkId
      );
  });
});

test("Decision record acquisition checks own strict preparation and their current source CLI closure", async () => {
  const consumer: SemanticGateCheck | undefined = semanticGateChecks.find(
    ({ checkId }) =>
      checkId === "test:decision-records:record-and-established-graph"
  );
  assert.ok(consumer);
  assert.equal(
    consumer.dependsOn?.includes("script:check:skill-updaters") ?? false,
    false
  );
  await withImpactFixture(async (fixture) => {
    for (const input of [
      "tools/decision-records/src/transactions/decision-strict-preparation.ts",
      "tools/decision-records/src/cli.ts",
      "tools/decision-records/src/query/sync/decision-query-sync.ts",
      "tools/decision-records/src/maintenance/decision-maintenance-context.ts",
      "tools/decision-records/src/staging/decision-stage-prepare.ts",
      "tools/shared/src/file-text-search/index.ts"
    ]) {
      const plan = await prepareChangedFixtureActivation(fixture, input);
      assert.equal(
        plan.decisions.find((item) => item.checkId === consumer.checkId)
          ?.action,
        "execute",
        input
      );
    }
  });
});

test("repository environment validation owns its source validator without a generation prerequisite", async () => {
  assert.equal(
    packageScriptDependencies["test:environment"]?.includes(
      "script:check:skill-updaters"
    ) ?? false,
    false
  );
  await withImpactFixture(async (fixture) => {
    const plan = await prepareChangedFixtureActivation(
      fixture,
      "tools/skill-validator/src/validation.ts"
    );
    assert.equal(
      plan.decisions.find(
        ({ checkId }) => checkId === "script:test:environment"
      )?.action,
      "execute"
    );
    assert.equal(
      plan.decisions.find(
        ({ checkId }) => checkId === "test:change-plan:lifecycle-finalize"
      )?.action,
      "reuse"
    );
  });
});

test("type-aware checks own conservative generated TypeScript inputs without widening formatter", async () => {
  await withImpactFixture(async (fixture) => {
    for (const input of [
      "skills/skill-maintainer/scripts/validate-skill.ts",
      "skills/ai-ready-docs/scripts/update-skill.ts",
      "skills/example/scripts/declaration.d.mts",
      "skills/example/package.json"
    ]) {
      const plan = await prepareChangedFixtureActivation(fixture, input);
      assert.equal(
        plan.decisions.find(({ checkId }) => checkId === "script:format:check")
          ?.action,
        "reuse",
        input
      );
      for (const checkId of ["script:typecheck", "script:lint"])
        assert.equal(
          plan.decisions.find((item) => item.checkId === checkId)?.action,
          "execute",
          `${input}: ${checkId}`
        );
    }
  });
});

test("shared readers and transactions own their tests and both generated worker installations", async () => {
  await withImpactFixture(async (fixture) => {
    for (const input of [
      "tools/record-operations/tests/reader/reader-batch.test.ts",
      "tools/record-operations/tests/transactions/transaction.test.ts",
      "tools/record-operations/tests/source-acquisition.test.ts",
      "skills/decision-records/scripts/runtime/tools/record-operations/src/reader/reader-worker.ts",
      "skills/investigation-report/scripts/runtime/tools/record-operations/src/reader/reader-worker.ts"
    ]) {
      const plan = await prepareChangedFixtureActivation(fixture, input);
      assert.equal(
        plan.decisions.find(
          ({ checkId }) => checkId === "test:record-operations:shared-contract"
        )?.action,
        "execute",
        input
      );
      for (const checkId of [
        "test:decision-records:lifecycle-and-recovery",
        "test:investigation-report:transactional-maintenance"
      ])
        assert.equal(
          plan.decisions.find((item) => item.checkId === checkId)?.action,
          "reuse",
          `${input}: ${checkId}`
        );
    }
  });
});

test("moved investigation CLI scenarios own their test inputs without rerunning index or transaction checks", async () => {
  await withImpactFixture(async (fixture) => {
    for (const input of [
      "tools/investigation-report/tests/collection/discovery-dependencies.test.ts",
      "tools/investigation-report/tests/candidates/candidate-operations.test.ts",
      "tools/investigation-report/tests/transactions/result-integrity.test.ts"
    ]) {
      const plan = await prepareChangedFixtureActivation(fixture, input);
      assert.equal(
        plan.decisions.find(
          ({ checkId }) => checkId === "test:investigation-report:cli-contract"
        )?.action,
        "execute",
        input
      );
      for (const checkId of [
        "test:investigation-report:index-and-query",
        "test:investigation-report:transactional-maintenance"
      ])
        assert.equal(
          plan.decisions.find((item) => item.checkId === checkId)?.action,
          "reuse",
          `${input}: ${checkId}`
        );
    }
  });
});

test("catalog proof retains leaf removal but ignores unread helper content", async () => {
  await withImpactFixture(async (fixture) => {
    for (const [input, expected] of [
      ["tools/novel-cards/tests/support.ts", "reuse"],
      ["tools/novel-cards/tests/fixtures/story.txt", "reuse"],
      ["tools/novel-cards/tests/model.test.ts", "execute"],
      ["tools/novel-cards/tests/checks/card-and-query-contract.ts", "execute"],
      ["tools/novel-cards/tests/run.ts", "execute"]
    ] as const) {
      const plan = await prepareChangedFixtureActivation(fixture, input);
      assert.equal(
        plan.decisions.find(({ checkId }) => checkId === "script:test:check")
          ?.action,
        expected,
        input
      );
    }
    const leaf = "tools/novel-cards/tests/model.test.ts";
    await publishFixtureReceipts(
      fixture,
      await prepareFixtureActivation(fixture)
    );
    await fs.rm(path.join(fixture.directory, leaf));
    const removed = await prepareFixtureActivation(fixture);
    assert.equal(
      removed.decisions.find(({ checkId }) => checkId === "script:test:check")
        ?.action,
      "execute"
    );
  });
});

test("generated consumers cannot execute before the unified generation provider passes", async () => {
  await withTemporaryDirectory(
    "gate-generated-prerequisite-",
    async (directory) => {
      const consumerIds = [
        "test:record-operations:shared-contract",
        "test:test-evidence:public-boundary",
        "test:lightweight-judgment:request-and-response"
      ];
      const consumers = semanticGateChecks
        .filter(({ checkId }) => consumerIds.includes(checkId))
        .map((check) => createSemanticGateCheck(check));
      const result = await runDefinition(
        defineConfig({
          checks: [
            defineCheck({
              checkId: "script:check:skill-updaters",
              displayName: "rejected generation",
              execute: () => ({ status: "failed", data: {} })
            }),
            ...consumers,
            createPackageScriptCheck("test:skill-validator")
          ]
        }),
        directory
      );
      assert.equal(result.aggregate, "failed");
      for (const checkId of [...consumerIds, "script:test:skill-validator"]) {
        const outcome = outcomeFor(result, checkId);
        assert.equal(outcome.status, "unavailable", checkId);
        assert.equal(
          result.checkDurations.find((duration) => duration.checkId === checkId)
            ?.durationMs,
          null,
          checkId
        );
      }
    }
  );
});

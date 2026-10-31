import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { baseGateCheckIds, prepareGateActivation } from "../../impact.ts";
import {
  captureFixtureCommand,
  prepareChangedFixtureActivation,
  prepareFixtureActivation,
  publishFixtureReceipts,
  withImpactFixture,
  writeImpactFixture
} from "../impact-test-support.ts";

test("incremental Gate refuses invalid Git paths and exhausted input budgets", async () => {
  await withImpactFixture(async (fixture) => {
    for (const output of [
      Buffer.from("../outside\0"),
      Buffer.from([255, 0]),
      Buffer.from(
        Array.from({ length: 20_001 }, (_, i) => `tools/file-${i}.ts`).join(
          "\0"
        )
      )
    ]) {
      const plan = await prepareFixtureActivation(fixture, {
        ...fixture.captureDependencies,
        async captureCommand(command, args, cwd) {
          return command === "git" && args[0] === "ls-files"
            ? output
            : await captureFixtureCommand(command, args, cwd);
        }
      });
      assert.equal(plan.kind, "fallback");
      assert.equal(plan.activeCheckIds.length, baseGateCheckIds.length);
      assert.deepEqual(await publishFixtureReceipts(fixture, plan), {
        published: false,
        reason: "not-incremental"
      });
    }
    const huge = "tools/change-plan/tests/oversized.fixture";
    await writeImpactFixture(fixture.directory, huge, "");
    await fs.truncate(path.join(fixture.directory, huge), 536_870_913);
    const exceeded = await prepareFixtureActivation(fixture);
    assert.equal(exceeded.kind, "fallback");
    assert.ok(
      exceeded.kind === "fallback" &&
        exceeded.fallbackDetail.includes("byte count")
    );
  });
});

test(
  "incremental Gate treats unreadable disk inputs as unavailable not stable identities",
  { skip: process.platform === "win32" || process.getuid?.() === 0 },
  async () => {
    await withImpactFixture(async (fixture) => {
      const input = "tools/change-plan/tests/unreadable.fixture";
      await writeImpactFixture(fixture.directory, input, "secret fixture");
      const target = path.join(fixture.directory, input);
      await fs.chmod(target, 0);
      try {
        const plan = await prepareFixtureActivation(fixture);
        assert.equal(plan.kind, "fallback");
        assert.ok(
          plan.kind === "fallback" &&
            /EACCES|permission/iu.test(plan.fallbackDetail)
        );
        assert.equal(plan.activeCheckIds.length, baseGateCheckIds.length);
      } finally {
        await fs.chmod(target, 0o600);
      }
    });
  }
);

test("release full execution does not acquire or publish project input proofs", async () => {
  await withImpactFixture(async (fixture) => {
    const plan = await prepareGateActivation({
      release: true,
      workspaceRoot: fixture.directory,
      captureDependencies: {
        async captureCommand() {
          throw new Error("release must not probe receipts");
        }
      }
    });
    assert.equal(plan.kind, "release");
    assert.equal(plan.snapshot, null);
    assert.equal(plan.activeCheckIds.length, 69);
    assert.deepEqual(await publishFixtureReceipts(fixture, plan), {
      published: false,
      reason: "not-incremental"
    });
  });
});

test("incremental Gate scopes updater tests to the distributed skill they actually load", async () => {
  await withImpactFixture(async (fixture) => {
    await writeImpactFixture(
      fixture.directory,
      "skills/ai-ready-docs/scripts/update-skill.ts",
      "export const value = 1;\n"
    );
    await publishFixtureReceipts(
      fixture,
      await prepareFixtureActivation(fixture)
    );
    await writeImpactFixture(
      fixture.directory,
      "skills/mcpshell-workspace-tools/scripts/runtime/value.ts",
      "export const value = 2;\n"
    );
    const unrelated = await prepareFixtureActivation(fixture);
    assert.equal(
      unrelated.decisions.find(
        ({ checkId }) => checkId === "script:test:skill-updater"
      )?.action,
      "reuse"
    );
    assert.ok(unrelated.activeCheckIds.includes("script:check:skill-updaters"));
    await writeImpactFixture(
      fixture.directory,
      "skills/ai-ready-docs/scripts/update-skill.ts",
      "export const value = 2;\n"
    );
    assert.ok(
      (await prepareFixtureActivation(fixture)).activeCheckIds.includes(
        "script:test:skill-updater"
      )
    );
  });
});

const sharedFeatureInputCases = [
  ...[
    "tools/shared/src/file-text-search/record-search-output.ts",
    "skills/decision-records/scripts/runtime/tools/shared/src/file-text-search/record-search-output.ts",
    "skills/investigation-report/scripts/runtime/tools/shared/src/file-text-search/record-search-output.ts"
  ].map((input) => ({
    input,
    consumers: [
      "test:decision-records:public-distribution",
      "test:investigation-report:cli-contract"
    ],
    unrelated: [
      "script:check:decisions",
      "script:check:investigations",
      "test:decision-records:query-and-index-projection",
      "test:decision-records:lifecycle-and-recovery",
      "test:decision-records:record-and-established-graph",
      "test:decision-records:pending-stage",
      "test:investigation-report:collection-and-resources",
      "test:investigation-report:index-and-query",
      "test:investigation-report:transactional-maintenance",
      "test:investigation-report:pending-stage",
      "script:test:file-text-search",
      ...baseGateCheckIds.filter((id) => id.startsWith("test:test-evidence:")),
      "script:test:relation-graph"
    ],
    toolId: "record-search-output"
  })),
  {
    input: "tools/shared/src/file-text-search/index.ts",
    consumers: [
      "test:decision-records:record-and-established-graph",
      "script:test:file-text-search",
      ...baseGateCheckIds.filter((id) => id.startsWith("test:test-evidence:")),
      "test:decision-records:query-and-index-projection",
      "test:decision-records:lifecycle-and-recovery",
      "test:decision-records:public-distribution",
      "test:investigation-report:collection-and-resources",
      "test:investigation-report:index-and-query",
      "test:investigation-report:transactional-maintenance",
      "test:investigation-report:pending-stage",
      "test:investigation-report:cli-contract"
    ],
    unrelated: [
      "test:decision-records:pending-stage",
      "script:test:relation-graph"
    ],
    toolId: "file-text-search"
  },
  {
    input: "tools/shared/src/graph/relations.ts",
    consumers: [
      "script:test:relation-graph",
      ...baseGateCheckIds.filter(
        (id) =>
          id.startsWith("test:decision-records:") ||
          id.startsWith("test:investigation-report:")
      )
    ],
    unrelated: [
      "script:test:file-text-search",
      "test:test-evidence:case-runtime"
    ],
    toolId: "relation-graph"
  }
];

test("incremental Gate preserves shared feature consumers without global owner invalidation", async () => {
  await withImpactFixture(async (fixture) => {
    for (const group of sharedFeatureInputCases) {
      const changed = await prepareChangedFixtureActivation(
        fixture,
        group.input
      );
      assert.ok(changed.activeToolIds.includes(group.toolId));
      if (group.toolId === "record-search-output") {
        assert.ok(!changed.activeToolIds.includes("decision-cli"));
        assert.ok(!changed.activeToolIds.includes("investigation-cli"));
        assert.ok(!changed.activeToolIds.includes("decision-distribution"));
        assert.ok(
          !changed.activeToolIds.includes("investigation-distribution")
        );
      }
      for (const checkId of [
        ...group.consumers,
        ...(group.toolId === "record-search-output"
          ? []
          : ["script:check:decisions", "script:check:investigations"]),
        ...(group.input.startsWith("tools/")
          ? ["script:format:check", "script:typecheck", "script:lint"]
          : []),
        "script:check:skill-updaters",
        "script:check:test-evidence-catalog"
      ]) {
        assert.equal(
          changed.decisions.find((item) => item.checkId === checkId)?.action,
          "execute",
          `${group.input}: ${checkId}`
        );
      }
      for (const checkId of [
        ...group.unrelated,
        "script:validate",
        "script:test:generated-file",
        "test:change-plan:lifecycle-finalize",
        "test:novel-cards:card-and-query-contract",
        "test:mcpshell:runtime"
      ]) {
        assert.equal(
          changed.decisions.find((item) => item.checkId === checkId)?.action,
          "reuse",
          `${group.input}: ${checkId}`
        );
      }
    }
  });
});

test("incremental Gate refuses orphan domain inputs despite repository-wide coverage", async () => {
  await withImpactFixture(async (fixture) => {
    await publishFixtureReceipts(
      fixture,
      await prepareFixtureActivation(fixture)
    );
    for (const input of [
      "tools/decision-records/src/unreviewed.ts",
      "tools/decision-records/tests/unreviewed.test.ts",
      "tools/investigation-report/src/unreviewed.ts",
      "tools/investigation-report/tests/unreviewed.fixture"
    ]) {
      await writeImpactFixture(fixture.directory, input, "unreviewed input\n");
      const plan = await prepareFixtureActivation(fixture);
      assert.equal(plan.kind, "incremental");
      assert.ok(plan.snapshot.unclassifiedPaths.includes(input));
      assert.equal(plan.activeCheckIds.length, baseGateCheckIds.length);
      assert.deepEqual(await publishFixtureReceipts(fixture, plan), {
        published: false,
        reason: "inputs-unclosed"
      });
      await fs.rm(path.join(fixture.directory, input));
    }
  });
});

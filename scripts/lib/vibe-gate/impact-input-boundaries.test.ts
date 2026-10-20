import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { baseGateCheckIds, prepareGateActivation } from "./impact.ts";
import {
  captureFixtureCommand,
  prepareFixtureActivation,
  publishFixtureReceipts,
  withImpactFixture,
  writeImpactFixture
} from "./impact-test-support.ts";

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
    assert.equal(plan.activeCheckIds.length, 64);
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

test("incremental Gate preserves shared feature consumers without global owner invalidation", async () => {
  await withImpactFixture(async (fixture) => {
    const groups = [
      {
        input: "tools/shared/src/file-text-search/record-search-output.ts",
        consumers: [
          "test:decision-records:query-and-index-projection",
          "test:investigation-report:index-and-query"
        ],
        domainPrefixes: [
          "test:decision-records:",
          "test:investigation-report:"
        ],
        unrelated: [
          "script:test:file-text-search",
          ...baseGateCheckIds.filter((id) =>
            id.startsWith("test:test-evidence:")
          ),
          "script:test:relation-graph",
          "test:change-plan:lifecycle-finalize",
          "test:novel-cards:card-and-query-contract",
          "test:mcpshell:runtime"
        ]
      },
      {
        input: "tools/shared/src/file-text-search/index.ts",
        consumers: [
          "script:test:file-text-search",
          "test:test-evidence:case-runtime"
        ],
        domainPrefixes: [
          "test:decision-records:",
          "test:investigation-report:",
          "test:test-evidence:"
        ],
        unrelated: [
          "script:test:relation-graph",
          "test:change-plan:lifecycle-finalize",
          "test:novel-cards:card-and-query-contract",
          "test:mcpshell:runtime"
        ]
      },
      {
        input: "tools/shared/src/graph/relations.ts",
        consumers: [
          "script:test:relation-graph",
          "test:decision-records:query-and-index-projection",
          "test:investigation-report:index-and-query"
        ],
        domainPrefixes: [
          "test:decision-records:",
          "test:investigation-report:"
        ],
        unrelated: [
          "script:test:file-text-search",
          "test:test-evidence:case-runtime",
          "test:change-plan:lifecycle-finalize",
          "test:novel-cards:card-and-query-contract",
          "test:mcpshell:runtime"
        ]
      }
    ];
    for (const group of groups) {
      await writeImpactFixture(
        fixture.directory,
        group.input,
        "export const value = 1;\n"
      );
      await publishFixtureReceipts(
        fixture,
        await prepareFixtureActivation(fixture)
      );
      await writeImpactFixture(
        fixture.directory,
        group.input,
        "export const value = 2;\n"
      );
      const changed = await prepareFixtureActivation(fixture);
      for (const prefix of group.domainPrefixes)
        assert.ok(
          baseGateCheckIds.some((checkId) => checkId.startsWith(prefix))
        );
      const domainConsumers = baseGateCheckIds.filter((checkId) =>
        group.domainPrefixes.some((prefix) => checkId.startsWith(prefix))
      );
      for (const checkId of [
        ...group.consumers,
        ...domainConsumers,
        "script:check:decisions",
        "script:check:investigations",
        "script:format:check",
        "script:test:generated-file",
        "script:check:skill-updaters",
        "script:typecheck",
        "script:lint",
        "script:check:test-evidence-catalog",
        "script:validate"
      ]) {
        assert.equal(
          changed.decisions.find((item) => item.checkId === checkId)?.action,
          "execute",
          `${group.input}: ${checkId}`
        );
      }
      for (const checkId of group.unrelated) {
        assert.equal(
          changed.decisions.find((item) => item.checkId === checkId)?.action,
          "reuse",
          `${group.input}: ${checkId}`
        );
      }
    }
  });
});

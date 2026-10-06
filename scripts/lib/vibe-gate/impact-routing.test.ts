import assert from "node:assert/strict";
import test from "node:test";
import { baseGateCheckIds, impactTagsForPath } from "./impact.ts";
import {
  prepareFixtureActivation,
  publishFixtureReceipts,
  publishInitialFixtureReceipts,
  withImpactFixture,
  writeImpactFixture
} from "./impact-test-support.ts";

test("incremental Gate invalidates Novel Cards consumers for every shared and distributed input", async () => {
  await withImpactFixture(async (fixture) => {
    const consumerIds = [
      "script:check:novel-cards-cli",
      "test:novel-cards:card-and-query-contract"
    ];
    for (const source of [
      "tools/index-runtime/src/value.ts",
      "tools/shared/src/value.ts",
      "scripts/lib/generated-file.ts",
      "skills/novel-cards/scripts/novel-cards.mjs",
      "skills/novel-cards/scripts/novel-cards.mjs.map"
    ]) {
      await writeImpactFixture(fixture.directory, source, "initial input\n");
      await publishFixtureReceipts(
        fixture,
        await prepareFixtureActivation(fixture)
      );
      const warm = await prepareFixtureActivation(fixture);
      for (const checkId of consumerIds)
        assert.equal(
          warm.decisions.find((item) => item.checkId === checkId)?.action,
          "reuse",
          `${source}: ${checkId}`
        );
      await writeImpactFixture(fixture.directory, source, "changed input\n");
      const changed = await prepareFixtureActivation(fixture);
      for (const checkId of consumerIds) {
        const decision = changed.decisions.find(
          (item) => item.checkId === checkId
        );
        assert.equal(decision?.action, "execute", `${source}: ${checkId}`);
        assert.equal(
          decision?.reason,
          "inputs-changed",
          `${source}: ${checkId}`
        );
      }
    }
  });
});

test("incremental Gate propagates documentation and shared owner changes", async () => {
  await withImpactFixture(async (fixture) => {
    await publishInitialFixtureReceipts(fixture);
    await writeImpactFixture(
      fixture.directory,
      "docs/README.md",
      "# Changed\n"
    );
    const documentationChange = await prepareFixtureActivation(fixture);
    assert.deepEqual(
      new Set(documentationChange.activeCheckIds),
      new Set(["markdown-link-validation", "secret-detection"])
    );
    assert.deepEqual(
      await publishFixtureReceipts(fixture, documentationChange),
      { published: true, receiptCount: 64 }
    );

    await writeImpactFixture(
      fixture.directory,
      "tools/shared/src/value.ts",
      "export const shared = 2;\n"
    );
    const sharedChange = await prepareFixtureActivation(fixture);
    assert.ok(
      sharedChange.activeCheckIds.includes(
        "test:change-plan:lifecycle-finalize"
      )
    );
    assert.ok(sharedChange.activeCheckIds.includes("script:check:decisions"));
    assert.ok(sharedChange.activeCheckIds.includes("script:validate"));
  });
});

test("incremental Gate propagates skill-package and build-system changes", async () => {
  await withImpactFixture(async (fixture) => {
    await publishInitialFixtureReceipts(fixture);
    await writeImpactFixture(
      fixture.directory,
      "tools/skill-package/src/value.ts",
      "export const packageValue = 1;\n"
    );
    const skillPackageChange = await prepareFixtureActivation(fixture);
    assert.ok(
      skillPackageChange.activeCheckIds.includes("script:test:skill-updater")
    );
    assert.ok(
      skillPackageChange.activeCheckIds.includes("script:test:environment")
    );
    assert.ok(skillPackageChange.activeCheckIds.includes("script:validate"));
    assert.deepEqual(
      await publishFixtureReceipts(fixture, skillPackageChange),
      {
        published: true,
        receiptCount: 64
      }
    );

    await writeImpactFixture(
      fixture.directory,
      "scripts/lib/generated-file.ts",
      "export const generatedFile = 1;\n"
    );
    const buildSystemChange = await prepareFixtureActivation(fixture);
    assert.ok(
      buildSystemChange.activeCheckIds.includes("script:test:generated-file")
    );
    assert.ok(
      buildSystemChange.activeCheckIds.includes(
        "test:change-plan:lifecycle-finalize"
      )
    );

    for (const extension of ["mjs", "mjs.map"]) {
      const bundle = `skills/lightweight-judgment/scripts/lightweight-judgment.${extension}`;
      await writeImpactFixture(fixture.directory, bundle, "initial artifact\n");
      await publishFixtureReceipts(
        fixture,
        await prepareFixtureActivation(fixture)
      );
      const warm = await prepareFixtureActivation(fixture);
      const consumerIds = [
        "script:check:lightweight-judgment-cli",
        "test:lightweight-judgment:public-distribution"
      ];
      for (const checkId of consumerIds) {
        assert.equal(
          warm.decisions.find((decision) => decision.checkId === checkId)
            ?.action,
          "reuse"
        );
      }
      await writeImpactFixture(fixture.directory, bundle, "changed artifact\n");
      const changed = await prepareFixtureActivation(fixture);
      for (const checkId of consumerIds) {
        const decision = changed.decisions.find(
          (item) => item.checkId === checkId
        );
        assert.equal(decision?.action, "execute");
        assert.equal(decision?.reason, "inputs-changed");
      }
    }
  });
});

test("incremental Gate treats unknown paths and root configuration conservatively", async () => {
  await withImpactFixture(async (fixture) => {
    await publishInitialFixtureReceipts(fixture);
    await writeImpactFixture(
      fixture.directory,
      "unknown-owner.bin",
      "unknown\n"
    );
    const unknownChange = await prepareFixtureActivation(fixture);
    assert.equal(unknownChange.activeCheckIds.length, baseGateCheckIds.length);
    assert.ok(
      unknownChange.decisions.some(
        ({ reason }) => reason === "conservative-fallback"
      )
    );
    assert.deepEqual(await publishFixtureReceipts(fixture, unknownChange), {
      published: true,
      receiptCount: 64
    });
    assert.deepEqual(
      (await prepareFixtureActivation(fixture)).activeCheckIds,
      []
    );

    await writeImpactFixture(
      fixture.directory,
      "package.json",
      '{"private":false}\n'
    );
    const configurationChange = await prepareFixtureActivation(fixture);
    assert.equal(
      configurationChange.activeCheckIds.length,
      baseGateCheckIds.length
    );
    assert.deepEqual(impactTagsForPath("new-owner/value.bin"), {
      tags: ["global", "path-inventory"],
      unclassified: true
    });
  });
});

test("incremental Gate reruns the Gate test suite when a semantic aggregation entry changes", async () => {
  await withImpactFixture(async (fixture) => {
    const aggregationEntry = "tools/task-graph/tests/run.ts";
    await writeImpactFixture(
      fixture.directory,
      aggregationEntry,
      'await import("./schema-index.test.ts");\n'
    );
    await publishFixtureReceipts(
      fixture,
      await prepareFixtureActivation(fixture)
    );
    const warm = await prepareFixtureActivation(fixture);
    assert.equal(
      warm.decisions.find(({ checkId }) => checkId === "script:test:check")
        ?.action,
      "reuse"
    );

    await writeImpactFixture(
      fixture.directory,
      aggregationEntry,
      'await import("./schema-index.test.ts");\nawait import("./store.test.ts");\n'
    );
    const aggregationChange = await prepareFixtureActivation(fixture);
    const suiteDecision = aggregationChange.decisions.find(
      ({ checkId }) => checkId === "script:test:check"
    );
    assert.equal(suiteDecision?.action, "execute");
    assert.equal(suiteDecision?.reason, "inputs-changed");
    assert.match(suiteDecision?.fingerprint ?? "", /^[a-f0-9]{64}$/u);
  });
});

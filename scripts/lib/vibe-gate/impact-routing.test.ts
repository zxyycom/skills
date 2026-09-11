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
      { published: true, receiptCount: 59 }
    );

    await writeImpactFixture(
      fixture.directory,
      "tools/shared/src/value.ts",
      "export const shared = 2;\n"
    );
    const sharedChange = await prepareFixtureActivation(fixture);
    assert.ok(
      sharedChange.activeCheckIds.includes(
        "test:change-plan:lifecycle-complete"
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
        receiptCount: 59
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
        "test:change-plan:lifecycle-complete"
      )
    );
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
      receiptCount: 59
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

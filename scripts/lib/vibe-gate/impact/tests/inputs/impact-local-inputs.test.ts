import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  prepareChangedFixtureActivation,
  prepareFixtureActivation,
  publishFixtureReceipts,
  withImpactFixture,
  writeImpactFixture
} from "../impact-test-support.ts";

// These are project subscription assertions, not tests of native pattern matching.
test("incremental Gate validates repository structure without consuming unrelated implementation bytes", async () => {
  await withImpactFixture(async (fixture) => {
    for (const [input, action] of [
      ["skills/example/SKILL.md", "execute"],
      ["tools/skill-validator/src/validation.ts", "execute"],
      ["scripts/validators/project-config.ts", "execute"],
      ["scripts/validate.ts", "execute"],
      ["tools/shared/src/file-text-search/record-search-output.ts", "reuse"],
      [
        "skills/decision-records/scripts/runtime/tools/shared/src/file-text-search/record-search-output.ts",
        "reuse"
      ],
      ["docs/example.md", "reuse"],
      ["skills/example/scripts/nested.fixture", "reuse"]
    ] as const) {
      const plan = await prepareChangedFixtureActivation(fixture, input);
      assert.equal(
        plan.decisions.find(({ checkId }) => checkId === "script:validate")
          ?.action,
        action,
        input
      );
    }
  });
});

test("incremental Gate keeps public runtime tests with their actual owner instead of every domain", async () => {
  await withImpactFixture(async (fixture) => {
    const fileSearch = "script:test:file-text-search";
    for (const [input, consumer] of [
      [
        "tools/shared/tests/file-text-search/file-text-search-matching.test.ts",
        fileSearch
      ],
      [
        "tools/shared/tests/file-text-search/file-text-search-limited.test.ts",
        fileSearch
      ],
      [
        "tools/shared/tests/file-text-search/record-text-search.test.ts",
        "script:test:file-text-search"
      ],
      [
        "tools/shared/tests/file-text-search/record-text-search-safety.test.ts",
        "script:test:file-text-search"
      ],
      [
        "tools/shared/tests/version-control/pending/version-control-pending-delta.test.ts",
        "script:test:version-control"
      ],
      [
        "tools/shared/tests/version-control/revision/version-control-revision-batch.test.ts",
        "script:test:version-control"
      ],
      [
        "scripts/lib/skill-package/tests/skill-package-hash-batch-baseline.test.ts",
        "script:test:skill-package-hash"
      ],
      [
        "tools/shared/tests/graph/relation-trace-selection.test.ts",
        "script:test:relation-graph"
      ],
      [
        "tools/shared/tests/version-control/protocol/version-control-pathspec-query.test.ts",
        "script:test:version-control"
      ],
      [
        "tools/index-runtime/tests/query/query.test.ts",
        "script:test:index-runtime"
      ],
      [
        "tools/skill-updater/tests/installation.test.ts",
        "script:test:skill-updater"
      ]
    ] as const) {
      const plan = await prepareChangedFixtureActivation(fixture, input);
      assert.ok(plan.activeCheckIds.includes(consumer), input);
      assert.ok(plan.activeCheckIds.includes("script:test:check"), input);
      for (const unrelated of [
        "script:validate",
        "script:test:generated-file",
        "test:change-plan:lifecycle-finalize"
      ]) {
        assert.equal(
          plan.decisions.find(({ checkId }) => checkId === unrelated)?.action,
          "reuse",
          `${input}: ${unrelated}`
        );
      }
    }
  });
});

test("incremental Gate retains layout additions deletions renames and resource kind changes", async () => {
  await withImpactFixture(async (fixture) => {
    const changedLayout = async () => {
      const plan = await prepareFixtureActivation(fixture);
      assert.ok(plan.activeCheckIds.includes("script:validate"));
      assert.equal(
        (await publishFixtureReceipts(fixture, plan)).published,
        true
      );
    };
    await publishFixtureReceipts(
      fixture,
      await prepareFixtureActivation(fixture)
    );
    await writeImpactFixture(
      fixture.directory,
      "skills/example/SKILL.md",
      "entry\n"
    );
    await changedLayout();
    await fs.rm(path.join(fixture.directory, "skills/example/SKILL.md"));
    await changedLayout();
    await fs.rename(
      path.join(fixture.directory, "skills/example"),
      path.join(fixture.directory, "skills/renamed")
    );
    await changedLayout();
    const resource = path.join(fixture.directory, "skills/renamed/assets");
    await fs.mkdir(resource);
    await changedLayout();
    await fs.rmdir(resource);
    await fs.writeFile(resource, "not a directory\n");
    await changedLayout();
    await fs.rm(resource);
    await changedLayout();
    for (const forbidden of ["skill-package.hash", "skill-package-lock.json"]) {
      await writeImpactFixture(
        fixture.directory,
        forbidden,
        "forbidden state\n"
      );
      await changedLayout();
      await fs.rm(path.join(fixture.directory, forbidden));
      await changedLayout();
    }
  });
});

test("incremental Gate captures ignored local inputs and rejects drift outside a narrowed consumer", async () => {
  await withImpactFixture(async (fixture) => {
    await writeImpactFixture(
      fixture.directory,
      ".gitignore",
      ".log/\n*.test.ts\n"
    );
    const local = "scripts/lib/generation/generated-file.test.ts";
    await writeImpactFixture(fixture.directory, local, "initial test\n");
    await publishFixtureReceipts(
      fixture,
      await prepareFixtureActivation(fixture)
    );
    await fs.rm(path.join(fixture.directory, local));
    const removed = await prepareFixtureActivation(fixture);
    assert.ok(removed.activeCheckIds.includes("script:test:generated-file"));
    await publishFixtureReceipts(fixture, removed);
    await writeImpactFixture(fixture.directory, local, "new ignored test\n");
    const added = await prepareFixtureActivation(fixture);
    assert.ok(added.activeCheckIds.includes("script:test:generated-file"));
    await publishFixtureReceipts(fixture, added);
    await fs.mkdir(
      path.join(fixture.directory, "scripts/lib/generation/runtime"),
      {
        recursive: true
      }
    );
    await fs.rename(
      path.join(fixture.directory, local),
      path.join(
        fixture.directory,
        "scripts/lib/generation/runtime/source-runtime.ts"
      )
    );
    const renamed = await prepareFixtureActivation(fixture);
    assert.ok(renamed.activeCheckIds.includes("script:test:generated-file"));
    await publishFixtureReceipts(fixture, renamed);
    const warm = await prepareFixtureActivation(fixture);
    assert.ok(!warm.activeCheckIds.includes("script:test:generated-file"));
    await writeImpactFixture(
      fixture.directory,
      "tools/shared/src/file-text-search/record-search-output.ts",
      "late change\n"
    );
    assert.deepEqual(await publishFixtureReceipts(fixture, warm), {
      published: false,
      reason: "workspace-drift"
    });
  });
});

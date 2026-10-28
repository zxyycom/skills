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
} from "./impact-test-support.ts";

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

test("incremental Gate scopes generated file primitives to their fixture and module closure", async () => {
  await withImpactFixture(async (fixture) => {
    for (const [input, action] of [
      ["scripts/lib/generated-file.test.ts", "execute"],
      ["scripts/lib/generated-file.ts", "execute"],
      ["scripts/lib/generated-typescript-declarations.ts", "execute"],
      ["scripts/lib/generated-file-header.ts", "execute"],
      ["scripts/lib/source-map.ts", "execute"],
      ["scripts/lib/source-runtime.ts", "execute"],
      ["scripts/lib/source-runtime-sync.ts", "execute"],
      ["scripts/lib/project.ts", "execute"],
      ["tools/shared/src/node/filesystem.ts", "execute"],
      ["tools/shared/src/file-text-search/record-search-output.ts", "reuse"],
      ["tools/novel-cards/src/index.ts", "reuse"],
      ["scripts/publish-skills.test.ts", "reuse"]
    ] as const) {
      const plan = await prepareChangedFixtureActivation(fixture, input);
      assert.equal(
        plan.decisions.find(
          ({ checkId }) => checkId === "script:test:generated-file"
        )?.action,
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
      ["tools/shared/tests/file-text-search-matching.test.ts", fileSearch],
      ["tools/shared/tests/file-text-search-limited.test.ts", fileSearch],
      [
        "tools/shared/tests/record-text-search.test.ts",
        "script:test:file-text-search"
      ],
      [
        "tools/shared/tests/record-text-search-safety.test.ts",
        "script:test:file-text-search"
      ],
      [
        "tools/shared/tests/version-control-pending-delta.test.ts",
        "script:test:version-control"
      ],
      [
        "tools/shared/tests/version-control-revision-batch.test.ts",
        "script:test:version-control"
      ],
      [
        "scripts/lib/skill-package-hash-batch-baseline.test.ts",
        "script:test:skill-package-hash"
      ],
      [
        "tools/shared/tests/relation-trace-selection.test.ts",
        "script:test:relation-graph"
      ],
      [
        "tools/shared/tests/version-control-pathspec-query.test.ts",
        "script:test:version-control"
      ],
      ["tools/index-runtime/tests/query.test.ts", "script:test:index-runtime"],
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
        "test:decision-records:lifecycle-and-recovery",
        "test:change-plan:lifecycle-finalize",
        "test:investigation-report:collection-and-resources"
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
    const local = "scripts/lib/generated-file.test.ts";
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
    await fs.rename(
      path.join(fixture.directory, local),
      path.join(fixture.directory, "scripts/lib/source-runtime.ts")
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

test("incremental Gate routes domain capability inputs only to their declared subscribers", async () => {
  await withImpactFixture(async (fixture) => {
    for (const [input, checkId] of [
      [
        "tools/decision-records/tests/batch-lookup-cost.test.ts",
        "test:decision-records:lifecycle-and-recovery"
      ],
      [
        "tools/investigation-report/tests/candidate-resource-root.test.ts",
        "test:investigation-report:collection-and-resources"
      ],
      [
        "tools/investigation-report/tests/selector-batch-cost.test.ts",
        "test:investigation-report:index-and-query"
      ]
    ] as const) {
      const plan = await prepareChangedFixtureActivation(fixture, input);
      assert.equal(plan.kind, "incremental");
      assert.deepEqual(plan.snapshot.unclassifiedPaths, []);
      assert.ok(plan.activeCheckIds.includes(checkId), input);
    }
    for (const group of [
      {
        input: "tools/decision-records/src/decision-stage-prepare.ts",
        toolId: "decision-stage",
        execute: [
          "test:decision-records:record-and-established-graph",
          "test:decision-records:pending-stage",
          "test:decision-records:query-and-index-projection",
          "test:decision-records:lifecycle-and-recovery",
          "test:decision-records:public-distribution",
          "script:check:decisions"
        ],
        reuse: ["test:investigation-report:pending-stage"]
      },
      {
        input: "tools/investigation-report/src/cli-query-commands.ts",
        toolId: "investigation-cli",
        execute: [
          "test:investigation-report:collection-and-resources",
          "test:investigation-report:cli-contract",
          "script:check:investigations"
        ],
        reuse: [
          "test:investigation-report:index-and-query",
          "test:investigation-report:transactional-maintenance",
          "test:investigation-report:pending-stage"
        ]
      },
      {
        input: "tools/decision-records/tests/source-discovery.test.ts",
        toolId: "decision-record-tests",
        execute: ["test:decision-records:record-and-established-graph"],
        reuse: [
          "test:decision-records:query-and-index-projection",
          "test:decision-records:lifecycle-and-recovery",
          "test:decision-records:pending-stage",
          "test:decision-records:public-distribution",
          "test:decision-records:cli-contract",
          "script:check:decisions"
        ]
      },
      {
        input: "tools/decision-records/tests/query-loaded-snapshot.test.ts",
        toolId: "decision-query-tests",
        execute: ["test:decision-records:query-and-index-projection"],
        reuse: [
          "test:decision-records:record-and-established-graph",
          "test:decision-records:lifecycle-and-recovery",
          "test:decision-records:pending-stage",
          "test:decision-records:public-distribution",
          "test:decision-records:cli-contract",
          "script:check:decisions"
        ]
      },
      {
        input:
          "tools/investigation-report/tests/candidate-read-context.test.ts",
        toolId: "investigation-record-tests",
        execute: ["test:investigation-report:collection-and-resources"],
        reuse: [
          "test:investigation-report:index-and-query",
          "test:investigation-report:transactional-maintenance",
          "test:investigation-report:pending-stage",
          "test:investigation-report:cli-contract",
          "script:check:investigations"
        ]
      },
      {
        input: "tools/investigation-report/tests/current-index.test.ts",
        toolId: "investigation-query-tests",
        execute: ["test:investigation-report:index-and-query"],
        reuse: [
          "test:investigation-report:collection-and-resources",
          "test:investigation-report:transactional-maintenance",
          "test:investigation-report:pending-stage",
          "test:investigation-report:cli-contract",
          "script:check:investigations"
        ]
      },
      {
        input: "tools/investigation-report/src/query-search-content.ts",
        toolId: "investigation-query",
        execute: [
          "test:investigation-report:collection-and-resources",
          "test:investigation-report:index-and-query",
          "test:investigation-report:transactional-maintenance",
          "test:investigation-report:pending-stage",
          "test:investigation-report:cli-contract",
          "script:check:investigations"
        ],
        reuse: []
      },
      {
        input:
          "tools/investigation-report/tests/fixtures/staging-source-path/value.txt",
        toolId: "investigation-stage-tests",
        execute: ["test:investigation-report:pending-stage"],
        reuse: [
          "test:investigation-report:collection-and-resources",
          "test:investigation-report:index-and-query",
          "test:investigation-report:transactional-maintenance",
          "test:investigation-report:cli-contract",
          "script:check:investigations"
        ]
      }
    ]) {
      const plan = await prepareChangedFixtureActivation(fixture, group.input);
      assert.equal(plan.kind, "incremental");
      assert.deepEqual(plan.snapshot.unclassifiedPaths, []);
      assert.ok(plan.activeToolIds.includes(group.toolId));
      for (const checkId of group.execute)
        assert.equal(
          plan.decisions.find((decision) => decision.checkId === checkId)
            ?.action,
          "execute",
          checkId
        );
      for (const checkId of group.reuse)
        assert.equal(
          plan.decisions.find((decision) => decision.checkId === checkId)
            ?.action,
          "reuse",
          checkId
        );
    }
  });
});

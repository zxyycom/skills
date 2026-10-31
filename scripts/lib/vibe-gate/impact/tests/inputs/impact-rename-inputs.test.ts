import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  captureFixtureCommand,
  prepareFixtureActivation,
  publishFixtureReceipts,
  withImpactFixture,
  writeImpactFixture
} from "../impact-test-support.ts";

test("incremental Gate preserves tracked record rename ownership without full fallback", async () => {
  const cases = [
    [
      "decision-records",
      "src/decision-selected-sync.ts",
      "src/query/sync/decision-selected-sync.ts",
      "decision-query",
      "test:decision-records:query-and-index-projection"
    ],
    [
      "decision-records",
      "src/decision-source-membership.ts",
      "src/sources/decision-source-membership.ts",
      "decision-maintenance",
      "test:decision-records:lifecycle-and-recovery"
    ],
    [
      "decision-records",
      "src/cli-program.ts",
      "src/cli/program/cli-program.ts",
      "decision-cli",
      "test:decision-records:cli-contract"
    ],
    [
      "decision-records",
      "src/decision-stage-prepare.ts",
      "src/staging/decision-stage-prepare.ts",
      "decision-stage",
      "test:decision-records:pending-stage"
    ],
    [
      "investigation-report",
      "src/cli-parser.ts",
      "src/cli/cli-parser.ts",
      "investigation-cli",
      "test:investigation-report:cli-contract"
    ],
    [
      "investigation-report",
      "src/staging-options.ts",
      "src/staging/staging-options.ts",
      "investigation-stage",
      "test:investigation-report:pending-stage"
    ],
    [
      "decision-records",
      "tests/stage.test.ts",
      "tests/staging/stage.test.ts",
      "decision-stage-tests",
      "test:decision-records:pending-stage"
    ],
    [
      "decision-records",
      "tests/support.ts",
      "tests/support/support.ts",
      "decision-record-tests",
      "test:decision-records:record-and-established-graph"
    ],
    [
      "decision-records",
      "tests/cli-args/support.ts",
      "tests/cli/cli-args/support.ts",
      "decision-cli-tests",
      "test:decision-records:cli-contract"
    ],
    [
      "decision-records",
      "tests/index-maintenance/support.ts",
      "tests/queries/index-maintenance/support.ts",
      "decision-query-tests",
      "test:decision-records:query-and-index-projection"
    ],
    [
      "decision-records",
      "tests/lazy-relation-graph/context.test.ts",
      "tests/queries/lazy-relation-graph/context.test.ts",
      "decision-query-tests",
      "test:decision-records:query-and-index-projection"
    ],
    [
      "decision-records",
      "tests/source-frontmatter-reuse.test.ts",
      "tests/records/source-frontmatter-reuse.test.ts",
      "decision-record-tests",
      "test:decision-records:record-and-established-graph"
    ],
    [
      "decision-records",
      "tests/support-local-contracts.ts",
      "tests/support/support-local-contracts.ts",
      "decision-query-tests",
      "test:decision-records:query-and-index-projection"
    ],
    [
      "decision-records",
      "tests/configured-decision-directory.test.ts",
      "tests/cli/configured-decision-directory.test.ts",
      "decision-cli-tests",
      "test:decision-records:cli-contract"
    ],
    [
      "decision-records",
      "tests/native-creation-mode-probe.ts",
      "tests/transactions/native-creation-mode-probe.ts",
      "decision-maintenance-tests",
      "test:decision-records:lifecycle-and-recovery"
    ],
    [
      "investigation-report",
      "tests/native-creation-mode-probe.ts",
      "tests/transactions/native-creation-mode-probe.ts",
      "investigation-maintenance-tests",
      "test:investigation-report:transactional-maintenance"
    ]
  ] as const;
  await withImpactFixture(async (fixture) => {
    for (const [domain, from, to, scope, consumer] of cases) {
      const oldPath = `tools/${domain}/${from}`;
      const newPath = `tools/${domain}/${to}`;
      await writeImpactFixture(fixture.directory, oldPath, "owned input\n");
      await captureFixtureCommand(
        "git",
        ["add", "--", oldPath],
        fixture.directory
      );
      assert.equal(
        (
          await publishFixtureReceipts(
            fixture,
            await prepareFixtureActivation(fixture)
          )
        ).published,
        true
      );
      await fs.mkdir(path.dirname(path.join(fixture.directory, newPath)), {
        recursive: true
      });
      await fs.rename(
        path.join(fixture.directory, oldPath),
        path.join(fixture.directory, newPath)
      );
      const plan = await prepareFixtureActivation(fixture);
      assert.equal(plan.kind, "incremental");
      assert.deepEqual(plan.snapshot.unclassifiedPaths, [], oldPath);
      assert.equal(
        plan.snapshot.files.find(({ path: file }) => file === oldPath)?.kind,
        "missing"
      );
      assert.equal(
        plan.snapshot.files.find(({ path: file }) => file === newPath)?.kind,
        "file"
      );
      assert.ok(plan.activeToolIds.includes(scope), newPath);
      assert.equal(
        plan.decisions.find(({ checkId }) => checkId === consumer)?.action,
        "execute"
      );
      const unrelated =
        domain === "decision-records"
          ? "test:investigation-report:index-and-query"
          : "test:decision-records:query-and-index-projection";
      assert.equal(
        plan.decisions.find(({ checkId }) => checkId === unrelated)?.action,
        "reuse"
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

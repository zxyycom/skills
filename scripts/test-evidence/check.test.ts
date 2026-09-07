import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { syncTestEvidenceIndex } from "../../tools/test-evidence/src/cli.ts";
import { checkRepositoryTestEvidence } from "./check.ts";
import { createRepositoryTestEvidenceSnapshot } from "./snapshot.ts";
import { withSnapshotFixture } from "./test-fixture.ts";

test("registration identities retain a direct file and full test name", async () => {
  await withSnapshotFixture(
    { "test:locator": "bun test ./tests/locator.test.ts" },
    {
      "tests/locator.test.ts": [
        'import test from "node:test";',
        'test("full registration name", () => {});',
        ""
      ].join("\n")
    },
    async (root) => {
      const snapshot = await createRepositoryTestEvidenceSnapshot({
        workspaceRoot: root
      });
      assert.deepEqual(snapshot.entities, [
        {
          id: "test:2a3d620856de173fa17082eb2b6b5dfa8491f20a96d5bf1a0c1cc5c6e66fb4ef",
          locators: [
            'bun test --test-name-pattern="^full registration name$" ./tests/locator.test.ts',
            "bun test ./tests/locator.test.ts :: tests/locator.test.ts > full registration name",
            "tests/locator.test.ts > full registration name"
          ],
          name: "full registration name"
        }
      ]);
    }
  );
});

test("project check rejects a registered test without a Case", async () => {
  await withSnapshotFixture(
    {
      "test:fixture":
        "bun test ./tests/covered.test.ts ./tests/uncovered.test.ts"
    },
    {
      "tests/covered.test.ts":
        'import test from "node:test";\ntest("covered", () => {});\n',
      "tests/uncovered.test.ts":
        'import test from "node:test";\ntest("uncovered", () => {});\n'
    },
    async (root) => {
      const snapshot = await createRepositoryTestEvidenceSnapshot({
        workspaceRoot: root
      });
      const covered = snapshot.entities.find(
        (entity) => entity.name === "covered"
      );
      assert.ok(covered);
      const cases = path.join(root, "docs", "test-evidence", "cases");
      await fs.mkdir(cases, { recursive: true });
      await fs.writeFile(
        path.join(cases, "fixture.md"),
        `### Case PROJECT-TEST-COVERAGE-001: only one test has a Case\n\nTests:\n- \`${covered.id}\`\n\nContract:\n- test coverage is checked\n\nProves:\n- an uncovered test blocks the project check\n`
      );
      const synced = await syncTestEvidenceIndex({
        mode: "write",
        workspaceRoot: root
      });
      assert.equal(synced.status, "ok", JSON.stringify(synced));
      const result = await checkRepositoryTestEvidence(root);
      assert.equal(result.status, "error");
      assert.equal(result.entityCount, 2);
      assert.deepEqual(
        result.diagnostics.map((diagnostic) => diagnostic.code),
        ["project.entity-without-case"]
      );
      const uncovered = snapshot.entities.find(
        (entity) => entity.name === "uncovered"
      );
      assert.ok(uncovered);
      await fs.writeFile(
        path.join(cases, "uncovered.md"),
        `### Case PROJECT-TEST-COVERAGE-002: the remaining test has a Case\n\nTests:\n- \`${uncovered.id}\`\n\nContract:\n- every registered test has a Case\n\nProves:\n- complete coverage passes the project check\n`
      );
      assert.equal(
        (await syncTestEvidenceIndex({ mode: "write", workspaceRoot: root }))
          .status,
        "ok"
      );
      assert.deepEqual(await checkRepositoryTestEvidence(root), {
        diagnostics: [],
        entityCount: 2,
        status: "ok"
      });
    }
  );
});

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { taskContent, withTempWorkspace } from "./helpers.ts";
import { callCli, requireRecord } from "./cli-test-support.ts";

import { verifyCliMutationRejections } from "./cli-mutation-support.ts";
test("CLI rejects ambiguous lease and revision pairs plus invalid control reasons", async () =>
  await verifyCliMutationRejections());

test("CLI apply resolves aliases and rolls back every operation when one fails", async () => {
  await withTempWorkspace(async (root) => {
    await callCli(root, ["index", "init"]);
    const validRequestPath = path.join(root, "valid-apply.json");
    await fs.writeFile(
      validRequestPath,
      `${JSON.stringify(
        {
          expectedRevision: 0,
          operations: [
            {
              kind: "create-task",
              alias: "constructor",
              content: taskContent("parent"),
              control: { mode: "queued" }
            },
            {
              kind: "create-task",
              alias: "child",
              parentId: "@constructor",
              content: taskContent("child")
            }
          ]
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    const applied = await callCli(root, ["apply", "--file", validRequestPath]);
    assert.equal(applied.result.ok, true);
    if (applied.result.ok) {
      const data = requireRecord(applied.result.data, "apply data");
      assert.equal(applied.result.revision, 1);
      assert.deepEqual(data.aliases, {
        child: "task-000002",
        constructor: "task-000001"
      });
    }

    const duplicateAliasPath = path.join(root, "duplicate-alias.json");
    await fs.writeFile(
      duplicateAliasPath,
      `${JSON.stringify(
        {
          expectedRevision: 1,
          operations: [
            {
              kind: "create-task",
              alias: "constructor",
              content: taskContent("first duplicate")
            },
            {
              kind: "create-task",
              alias: "constructor",
              content: taskContent("second duplicate")
            }
          ]
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    const duplicateAlias = await callCli(root, [
      "apply",
      "--file",
      duplicateAliasPath
    ]);
    assert.equal(duplicateAlias.result.ok, false);
    if (!duplicateAlias.result.ok) {
      assert.equal(duplicateAlias.result.error.code, "REQUEST_INVALID");
    }

    const longAliasPath = path.join(root, "long-alias.json");
    await fs.writeFile(
      longAliasPath,
      `${JSON.stringify(
        {
          expectedRevision: 1,
          operations: [
            {
              kind: "create-task",
              alias: "a".repeat(81),
              content: taskContent("long alias")
            }
          ]
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    const longAlias = await callCli(root, ["apply", "--file", longAliasPath]);
    assert.equal(longAlias.result.ok, false);
    if (!longAlias.result.ok) {
      assert.equal(longAlias.result.error.code, "REQUEST_INVALID");
    }

    const invalidRequestPath = path.join(root, "rollback-apply.json");
    await fs.writeFile(
      invalidRequestPath,
      `${JSON.stringify(
        {
          expectedRevision: 1,
          operations: [
            {
              kind: "create-task",
              alias: "temporary",
              content: taskContent("temporary")
            },
            {
              kind: "set-dependency",
              taskId: "@temporary",
              dependencyId: "task-999999",
              present: true
            }
          ]
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    const rejected = await callCli(root, [
      "apply",
      "--file",
      invalidRequestPath
    ]);
    assert.equal(rejected.result.ok, false);
    if (!rejected.result.ok) {
      assert.equal(rejected.result.error.code, "TASK_NOT_FOUND");
    }
    const info = await callCli(root, ["index", "info"]);
    assert.equal(info.result.ok, true);
    if (info.result.ok) {
      const data = requireRecord(info.result.data, "index info data");
      assert.equal(info.result.revision, 1);
      assert.equal(data.nextTaskId, 3);
    }
  });
});

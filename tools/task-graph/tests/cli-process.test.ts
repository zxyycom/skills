import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  prepareRootNativeRuntime,
  taskContent,
  withTempWorkspace
} from "./helpers.ts";
import {
  callCli,
  callProcessCli,
  parseJsonCall,
  requireRecord
} from "./cli-test-support.ts";

test("process CLI apply accepts a JSON request from stdin without extra output", async () => {
  await withTempWorkspace(async (root) => {
    const toolHome = path.join(root, "tool-home");
    await prepareRootNativeRuntime(toolHome);
    await callCli(root, ["index", "init"]);
    const request = `${JSON.stringify({
      expectedRevision: 0,
      operations: [
        {
          kind: "create-task",
          alias: "stdin-task",
          content: taskContent("stdin task"),
          control: { mode: "queued" }
        }
      ]
    })}\n`;
    const invoked = await callProcessCli(["apply", "--root", root], request, {
      ...process.env,
      TASK_GRAPH_TOOL_HOME: toolHome
    });
    assert.equal(invoked.exitCode, 0);
    assert.equal(invoked.stderr, "");
    assert.ok(invoked.stdout.endsWith("\n"));
    assert.equal(invoked.stdout.slice(0, -1).includes("\n"), false);
    const result = parseJsonCall({
      exitCode: invoked.exitCode,
      output: invoked.stdout
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      const data = requireRecord(result.data, "apply data");
      assert.equal(result.revision, 1);
      assert.deepEqual(data.aliases, { "stdin-task": "task-000001" });
    }
  });
});

test("independent Node CLI claims serialize and only one excluded task wins", async () => {
  await withTempWorkspace(async (root) => {
    const toolHome = path.join(root, "tool-home");
    await prepareRootNativeRuntime(toolHome);
    await callCli(root, ["index", "init"]);
    const requestPath = path.join(root, "excluded-tasks.json");
    await fs.writeFile(
      requestPath,
      `${JSON.stringify(
        {
          expectedRevision: 0,
          operations: [
            {
              kind: "create-task",
              alias: "left",
              content: taskContent("left"),
              control: { mode: "queued" }
            },
            {
              kind: "create-task",
              alias: "right",
              content: taskContent("right"),
              control: { mode: "queued" }
            },
            {
              kind: "set-exclusion",
              taskId: "@left",
              excludedTaskId: "@right",
              present: true
            }
          ]
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    const applied = await callCli(root, ["apply", "--file", requestPath]);
    assert.equal(applied.result.ok, true);
    const environment = { ...process.env, TASK_GRAPH_TOOL_HOME: toolHome };
    const claims = await Promise.all([
      callProcessCli(
        ["claim", "task-000001", "--actor", "left-worker", "--root", root],
        "",
        environment
      ),
      callProcessCli(
        ["claim", "task-000002", "--actor", "right-worker", "--root", root],
        "",
        environment
      )
    ]);
    assert.equal(claims.filter(({ exitCode }) => exitCode === 0).length, 1);
    assert.equal(claims.filter(({ exitCode }) => exitCode === 1).length, 1);
    for (const claim of claims) {
      assert.equal(claim.stderr, "");
      assert.equal(claim.stdout.endsWith("\n"), true);
      assert.equal(claim.stdout.slice(0, -1).includes("\n"), false);
    }
    const failure = claims.find(({ exitCode }) => exitCode === 1);
    assert.ok(failure !== undefined);
    const failureResult = parseJsonCall({
      exitCode: failure.exitCode,
      output: failure.stdout
    });
    assert.equal(failureResult.ok, false);
    if (!failureResult.ok) {
      assert.equal(failureResult.error.code, "STATE_CONFLICT");
      assert.equal(failureResult.revision, 2);
    }
    const info = await callCli(root, ["index", "info"]);
    assert.equal(info.result.revision, 2);
  });
});

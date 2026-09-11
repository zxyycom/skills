import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { withTempWorkspace } from "./helpers.ts";
import { callCli, callRawCli, parseJsonCall } from "./cli-test-support.ts";

import { verifyCliFailures } from "./cli-failures-support.ts";
test("CLI success and predictable schema, state, conflict, and file failures use one envelope", async () =>
  await verifyCliFailures());

test("CLI index info preserves the unsupported schema error code", async () => {
  await withTempWorkspace(async (root) => {
    const indexPath = path.join(
      root,
      "docs",
      "task-graph",
      "task-graph-index.json"
    );
    await fs.mkdir(path.dirname(indexPath), { recursive: true });
    await fs.writeFile(
      indexPath,
      `${JSON.stringify(
        {
          schemaVersion: 1,
          revision: 0,
          nextIds: { scope: 1, task: 1 },
          scopes: {}
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    const checked = await callCli(root, ["index", "info"]);
    assert.equal(checked.exitCode, 1);
    assert.equal(checked.result.ok, false);
    if (!checked.result.ok) {
      assert.equal(checked.result.error.code, "SCHEMA_UNSUPPORTED");
      assert.equal(checked.result.revision, null);
    }
  });
});

test("CLI maps path failures to JSON exit one with empty stderr", async () => {
  await withTempWorkspace(async (root) => {
    const rootFile = path.join(root, "not-a-directory");
    await fs.writeFile(rootFile, "ordinary file\n", "utf8");
    const failure = await callRawCli(rootFile, ["index", "info"]);
    assert.equal(failure.exitCode, 1);
    const result = parseJsonCall(failure);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(
        result.error.code === "INDEX_NOT_FOUND" ||
          result.error.code === "INDEX_READ_FAILED"
      );
    }
  });
});

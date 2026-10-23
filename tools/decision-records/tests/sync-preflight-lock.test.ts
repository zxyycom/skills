import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { executeDecisionQuery } from "../src/decision-query-service.ts";
import { runSourceCli, withFixtureWorkspace } from "./support.ts";

test("Decision sync preflight validates without acquiring a busy mutation lock", async () => {
  await withFixtureWorkspace("sync-readonly-lock", async (workspaceRoot) => {
    const index = path.join(
      workspaceRoot,
      "docs/decisions/decision-index.json"
    );
    const lock = path.join(
      workspaceRoot,
      "docs/.decision-index.json.mutation.lock"
    );
    const before = await fs.readFile(index);
    await fs.writeFile(lock, "another writer");
    const query = await executeDecisionQuery({
      command: "sync-index",
      preflight: true,
      location: { workspaceRoot, decisionsDir: "docs/decisions" }
    });
    assert.equal(query.status, "ok", JSON.stringify(query));
    const cli = await runSourceCli([
      "sync-index",
      "--preflight",
      "--root",
      workspaceRoot
    ]);
    assert.equal(cli.exitCode, 0, cli.stderr);
    const write = await runSourceCli(["sync-index", "--root", workspaceRoot]);
    assert.equal(write.exitCode, 1);
    assert.match(write.stderr, /lock/);
    assert.deepEqual(await fs.readFile(index), before);
    assert.equal(await fs.readFile(lock, "utf8"), "another writer");
  });
});

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { generatedCliPath, withFixtureWorkspace } from "./support.ts";

function runNodeCli(args: readonly string[]) {
  return spawnSync("node", [generatedCliPath, ...args], {
    encoding: "utf8",
    timeout: 20_000
  });
}

test("generated Decision Records CLI preserves the Node success and failure protocol", () =>
  withFixtureWorkspace("node-cli-protocol", async (workspaceRoot) => {
    const success = runNodeCli(["check", "--root", workspaceRoot]);
    assert.equal(success.status, 0, success.stderr);
    assert.match(success.stdout, /Decision records check passed/);
    assert.equal(success.stderr, "");

    const failure = runNodeCli(["evolve"]);
    assert.equal(failure.status, 2);
    assert.equal(failure.stdout, "");
    assert.match(failure.stderr, /required option '--successor/);
  }));

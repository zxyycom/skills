import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { defineConfig } from "@zxyycom/vibe-check";
import { createPackageScriptCheck } from "./lib/vibe-gate/checks/package-script.ts";
import { commandText } from "./lib/vibe-gate.ts";
import {
  outcomeFor,
  runDefinition,
  withTemporaryDirectory
} from "./vibe-check-test-support.ts";

test("project command runs from project root with inherited environment and full transcript without publishing child text", async () => {
  await withTemporaryDirectory("gate-command-project-", async (directory) => {
    await fs.writeFile(
      path.join(directory, "package.json"),
      JSON.stringify({ scripts: { typecheck: "node probe.js" } })
    );
    await fs.writeFile(
      path.join(directory, "probe.js"),
      'process.stdout.write(process.cwd()); process.stderr.write(process.env.PATH ? "ambient-present" : "ambient-missing"); process.exit(7)'
    );
    const result = await runDefinition(
      defineConfig({ checks: [createPackageScriptCheck("typecheck")] }),
      directory
    );
    const outcome = outcomeFor(result, "script:typecheck");
    assert.equal(outcome.status, "failed");
    if (outcome.status !== "failed")
      throw new Error("expected command failure");
    assert.equal(outcome.data.exitCode, 7);
    assert.deepEqual(Object.keys(outcome.data), ["exitCode"]);
    const artifactRoot = path.join(directory, ".gate-test-artifacts");
    const directories = await fs.readdir(artifactRoot);
    assert.equal(directories.length, 1);
    const artifact = directories[0];
    assert.ok(artifact);
    const transcript = await fs.readFile(
      path.join(artifactRoot, artifact, "process.log"),
      "utf8"
    );
    assert.match(transcript, /ambient-present/u);
    assert.ok(transcript.includes(directory));
    assert.equal(
      JSON.stringify(result.snapshot).includes("ambient-present"),
      false
    );
  });
});

test("direct rerun formatting preserves argv boundaries", () => {
  assert.equal(
    commandText({ command: "bun", args: ["test", "a file's.ts"] }),
    `bun test 'a file'"'"'s.ts'`
  );
});

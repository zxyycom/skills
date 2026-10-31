import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs/promises";
import path from "node:path";

import { runInvestigationReportCheckCli } from "../../../src/cli.ts";

import { initializeGit } from "../../support/git-support.ts";
import {
  investigationRoot,
  withTempRoot
} from "../../support/fixture-support.ts";
import { writeCollection } from "../../support/collection-support.ts";

test("investigation stage second-phase read failure retains private-safe category operation target and recovery", async () => {
  await withTempRoot("phase-failure-facts", async (root) => {
    await writeCollection(root, [{ id: "one" }]);
    initializeGit(root);
    const source = path.join(investigationRoot(root), "one.md");
    const before = await fs.readFile(path.join(root, ".git/index"));
    const original = fs.readFile;
    let reads = 0,
      stdout = "",
      stderr = "";
    fs.readFile = (async (...args: Parameters<typeof fs.readFile>) => {
      if (args[0] === source && ++reads === 2)
        throw Object.assign(
          new Error(
            "denied /private/source token=ghp_123456789012345678901234567890"
          ),
          { code: "EACCES" }
        );
      return await original(...args);
    }) as typeof fs.readFile;
    try {
      const exit = await runInvestigationReportCheckCli(
        ["--root", root, "stage", "one", "--scope", "domain"],
        {
          io: {
            stdout: (value) => {
              stdout += value;
            },
            stderr: (value) => {
              stderr += value;
            }
          }
        }
      );
      assert.equal(exit, 1);
      assert.equal(stdout, "");
      assert.match(stderr, /state: source-drift/u);
      assert.match(stderr, /causeCategory: access-denied/u);
      assert.match(stderr, /operation: read a workspace file/u);
      assert.match(stderr, /docs\/investigations\/one\.md/u);
      assert.match(stderr, /restore access required/u);
      assert.ok(!/private|ghp_|scope: Pending/u.test(stderr));
      assert.deepEqual(await original(path.join(root, ".git/index")), before);
    } finally {
      fs.readFile = original;
    }
  });
});

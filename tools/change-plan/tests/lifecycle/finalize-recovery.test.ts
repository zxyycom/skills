import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { finalizeChangePlanDirectory } from "../../src/finalize.ts";
import { completedTasks, git, withTempRoot, writePlan } from "../support.ts";

test("finalize preserves a recoverable tombstone after cleanup fails", async () => {
  await withTempRoot("finalize-cleanup", async (root) => {
    const changes = path.join(root, "changes");
    const change = await writePlan(changes, "cleanup-plan", {
      tasks: completedTasks
    });
    await fs.writeFile(path.join(change, "check.sh"), "#!/bin/sh\nexit 0\n");
    await fs.chmod(path.join(change, "check.sh"), 0o755);
    git(root, ["add", "."]);
    git(root, ["commit", "--quiet", "-m", "record cleanup plan"]);
    const head = git(root, ["rev-parse", "HEAD"]);
    const names = (await fs.readdir(change)).sort();
    const originalMembers = await Promise.all(
      names.map(async (name) => ({
        name,
        bytes: await fs.readFile(path.join(change, name)),
        executable:
          ((await fs.stat(path.join(change, name))).mode & 0o100) !== 0
      }))
    );
    const originalUnlink = fs.unlink.bind(fs);
    let injected = false;
    Object.defineProperty(fs, "unlink", {
      configurable: true,
      value: async (...arguments_: Parameters<typeof fs.unlink>) => {
        if (!injected) {
          injected = true;
          throw new Error("injected cleanup failure");
        }
        return await originalUnlink(...arguments_);
      },
      writable: true
    });
    let result;
    try {
      result = await finalizeChangePlanDirectory(change);
    } finally {
      Object.defineProperty(fs, "unlink", {
        configurable: true,
        value: originalUnlink,
        writable: true
      });
    }
    assert.equal(result.outcome, "committed-cleanup-pending");
    assert.equal(result.changed, true);
    assert.notEqual(result.tombstoneDirectory, null);
    assert.equal(result.headCommit, head);
    for (const directory of [change, result.tombstoneDirectory!]) {
      assert.deepEqual((await fs.readdir(directory)).sort(), names);
      for (const member of originalMembers) {
        assert.deepEqual(
          await fs.readFile(path.join(directory, member.name)),
          member.bytes
        );
        assert.equal(
          ((await fs.stat(path.join(directory, member.name))).mode & 0o100) !==
            0,
          member.executable
        );
      }
    }
  });
});

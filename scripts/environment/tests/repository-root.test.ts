import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { requireSuccess, run } from "./environment-test-process.ts";
import { createRepository } from "./environment-test-repository.ts";

function discoverRoots(cwd: string) {
  return run(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      'import { discoverMainWorktreeRoot, getCurrentTaskGraphRoot } from "./scripts/setup-repository.js"; console.log(JSON.stringify([discoverMainWorktreeRoot(process.cwd()), getCurrentTaskGraphRoot(process.cwd())]));'
    ],
    cwd
  );
}

test(
  "task root resolves ordinary and absorbed submodule main worktrees from linked worktrees",
  { timeout: 30000 },
  async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "skills roots "));
    try {
      const source = await createRepository(tempRoot, "source");
      const parent = await createRepository(tempRoot, "parent");
      const submodule = path.join(parent, "nested skills");
      requireSuccess(
        run(
          "git",
          [
            "-c",
            "protocol.file.allow=always",
            "submodule",
            "add",
            source,
            "nested skills"
          ],
          parent
        ),
        "add submodule"
      );

      for (const main of [source, submodule]) {
        const linked = `${main} linked`;
        requireSuccess(
          run("git", ["worktree", "add", "-b", "worker", linked], main),
          "add linked worktree"
        );
        for (const cwd of [main, linked]) {
          const roots = discoverRoots(cwd);
          requireSuccess(roots, "discover task roots");
          assert.deepEqual(JSON.parse(roots.stdout), [main, main]);
        }

        if (main === submodule) {
          requireSuccess(
            run("git", ["sparse-checkout", "set", "docs", "scripts"], main),
            "enable sparse checkout"
          );
          assert.equal(
            run("git", ["config", "--local", "--get", "core.worktree"], main)
              .status,
            1
          );
          assert.equal(
            run(
              "git",
              [
                "config",
                "--local",
                "--bool",
                "--get",
                "extensions.worktreeConfig"
              ],
              main
            ).stdout.trim(),
            "true"
          );
          assert.equal(
            run(
              "git",
              ["config", "--worktree", "--get", "core.worktree"],
              linked
            ).status,
            1
          );
          for (const cwd of [main, linked]) {
            const roots = discoverRoots(cwd);
            requireSuccess(roots, "discover roots after sparse checkout");
            assert.deepEqual(JSON.parse(roots.stdout), [main, main]);
          }
        }

        await fs.rm(
          path.join(main, "docs", "task-graph", "task-graph-index.json")
        );
        const missing = discoverRoots(linked);
        assert.notEqual(missing.status, 0);
        assert.match(
          missing.stderr,
          /the current project does not contain the task index/u
        );
      }
    } finally {
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  }
);

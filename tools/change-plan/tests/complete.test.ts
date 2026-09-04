import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  ensureChangeTombstoneRoot,
  executePreparedChangeDeletion,
  prepareChangeDeletion
} from "../src/change-deletion.ts";
import { completeChangePlanDirectory } from "../src/complete.ts";
import { completedTasks, withTempRoot, writePlan } from "./support.ts";

function commitAll(root: string, message: string): void {
  execFileSync("git", ["-C", root, "add", "."], { encoding: "utf8" });
  execFileSync("git", ["-C", root, "commit", "--quiet", "-m", message], {
    encoding: "utf8"
  });
}

test("complete preflight is read-only and complete removes a HEAD-exact finished plan", async () => {
  await withTempRoot("complete-success", async (root) => {
    const changes = path.join(root, "changes");
    const change = await writePlan(changes, "finished-plan", {
      tasks: completedTasks
    });
    await fs.mkdir(path.join(change, "evidence"));
    await fs.writeFile(
      path.join(change, "evidence", "result.txt"),
      "recorded\n"
    );
    await fs.writeFile(
      path.join(change, "evidence", "check.sh"),
      "#!/bin/sh\n"
    );
    await fs.chmod(path.join(change, "evidence", "check.sh"), 0o755);
    commitAll(root, "record finished plan");

    const preflight = await completeChangePlanDirectory(change, {
      preflight: true
    });
    assert.equal(preflight.outcome, "preflight");
    assert.equal(preflight.changed, false);
    assert.equal(await fs.stat(change).then(() => true), true);
    await assert.rejects(
      fs.access(path.join(changes, ".change-plan-tombstones"))
    );

    const completed = await completeChangePlanDirectory(change);
    assert.equal(completed.outcome, "completed", completed.error ?? "");
    assert.equal(completed.changed, true);
    assert.notEqual(completed.headCommit, null);
    assert.equal(completed.tombstoneDirectory, null);
    await assert.rejects(fs.access(change));
    assert.equal(
      (
        await fs.stat(path.join(changes, ".change-plan-tombstones"))
      ).isDirectory(),
      true
    );
  });
});

test("complete rejects an incomplete or non-HEAD-exact change without moving it", async () => {
  await withTempRoot("complete-gates", async (root) => {
    const changes = path.join(root, "changes");
    const incomplete = await writePlan(changes, "incomplete-plan");
    const taskGate = await completeChangePlanDirectory(incomplete, {
      preflight: true
    });
    assert.equal(taskGate.outcome, "no-change");
    assert.match(taskGate.error ?? "", /all tasks/u);

    const exact = await writePlan(changes, "recorded-plan", {
      tasks: completedTasks
    });
    commitAll(root, "record plan");
    await fs.writeFile(path.join(exact, "untracked.txt"), "unknown\n");
    const unknown = await completeChangePlanDirectory(exact, {
      preflight: true
    });
    assert.equal(unknown.outcome, "no-change");
    assert.match(unknown.error ?? "", /unknown or empty/u);
    assert.equal(await fs.stat(exact).then(() => true), true);
  });
});

test("complete preserves a recoverable tombstone after cleanup fails", async () => {
  await withTempRoot("complete-cleanup", async (root) => {
    const changes = path.join(root, "changes");
    const change = await writePlan(changes, "cleanup-plan", {
      tasks: completedTasks
    });
    commitAll(root, "record cleanup plan");
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
      result = await completeChangePlanDirectory(change);
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
    await fs.access(change);
    await fs.access(result.tombstoneDirectory!);
  });
});

test("complete rejects content, mode, ignored, empty-directory, and symbolic-link drift without moving", async () => {
  await withTempRoot("complete-physical-drift", async (root) => {
    const changes = path.join(root, "changes");
    const changed = await writePlan(changes, "changed-plan", {
      tasks: completedTasks
    });
    const executable = await writePlan(changes, "executable-plan", {
      tasks: completedTasks
    });
    const ignored = await writePlan(changes, "ignored-plan", {
      tasks: completedTasks
    });
    const empty = await writePlan(changes, "empty-plan", {
      tasks: completedTasks
    });
    const linked = await writePlan(changes, "linked-plan", {
      tasks: completedTasks
    });
    await fs.writeFile(
      path.join(root, ".gitignore"),
      "ignored-plan/ignored.txt\n"
    );
    commitAll(root, "record physical drift fixtures");

    await fs.writeFile(path.join(changed, "proposal.md"), "changed\n");
    await assert.rejects(
      prepareChangeDeletion(changed, changes),
      /workspace file differs/u
    );

    await fs.chmod(path.join(executable, "proposal.md"), 0o755);
    await assert.rejects(
      prepareChangeDeletion(executable, changes),
      /workspace file differs/u
    );

    await fs.writeFile(path.join(ignored, "ignored.txt"), "ignored\n");
    const ignoredResult = await completeChangePlanDirectory(ignored, {
      preflight: true
    });
    assert.equal(ignoredResult.outcome, "no-change");
    assert.match(ignoredResult.error ?? "", /unknown or empty/u);

    await fs.mkdir(path.join(empty, "empty"));
    const emptyResult = await completeChangePlanDirectory(empty, {
      preflight: true
    });
    assert.equal(emptyResult.outcome, "no-change");
    assert.match(emptyResult.error ?? "", /unknown or empty/u);

    await fs.symlink(
      path.join(root, ".gitignore"),
      path.join(linked, "outside")
    );
    const linkResult = await completeChangePlanDirectory(linked, {
      preflight: true
    });
    assert.equal(linkResult.outcome, "no-change");
    assert.match(linkResult.error ?? "", /symbolic link/u);
    for (const change of [changed, executable, ignored, empty, linked]) {
      await fs.access(change);
    }
  });
});

test("complete rejects Git symlink and submodule tree entries without moving", async () => {
  await withTempRoot("complete-git-tree-types", async (root) => {
    const changes = path.join(root, "changes");
    const symlink = await writePlan(changes, "symlink-plan", {
      tasks: completedTasks
    });
    await fs.symlink("proposal.md", path.join(symlink, "link"));
    const submodule = await writePlan(changes, "submodule-plan", {
      tasks: completedTasks
    });
    commitAll(root, "record regular fixtures");
    const head = execFileSync("git", ["-C", root, "rev-parse", "HEAD"], {
      encoding: "utf8"
    }).trim();
    execFileSync(
      "git",
      [
        "-C",
        root,
        "update-index",
        "--add",
        "--cacheinfo",
        `160000,${head},changes/submodule-plan/child`
      ],
      { encoding: "utf8" }
    );
    execFileSync(
      "git",
      ["-C", root, "commit", "--quiet", "-m", "record gitlink"],
      {
        encoding: "utf8"
      }
    );

    await assert.rejects(
      prepareChangeDeletion(symlink, changes),
      /symbolic link/u
    );
    await assert.rejects(
      prepareChangeDeletion(submodule, changes),
      /unsupported change deletion member/u
    );
    await fs.access(symlink);
    await fs.access(submodule);
  });
});

test("prepared deletion revalidates tombstone target, members, and HEAD before deletion", async () => {
  await withTempRoot("complete-revalidation", async (root) => {
    const changes = path.join(root, "changes");
    const change = await writePlan(changes, "revalidated-plan", {
      tasks: completedTasks
    });
    commitAll(root, "record revalidation plan");

    let preparation = await prepareChangeDeletion(change, changes);
    await ensureChangeTombstoneRoot(preparation);
    preparation = await prepareChangeDeletion(change, changes);
    await fs.mkdir(preparation.tombstoneDirectory);
    const targetConflict = await executePreparedChangeDeletion(preparation);
    assert.equal(targetConflict.outcome, "no-change");
    assert.match(targetConflict.error ?? "", /target appeared/u);
    await fs.rmdir(preparation.tombstoneDirectory);

    preparation = await prepareChangeDeletion(change, changes);
    const proposalPath = path.join(change, "proposal.md");
    const proposal = await fs.readFile(proposalPath, "utf8");
    await fs.writeFile(proposalPath, `${proposal}changed\n`);
    const memberDrift = await executePreparedChangeDeletion(preparation);
    assert.equal(memberDrift.outcome, "no-change");
    assert.match(memberDrift.error ?? "", /file changed|members changed/u);
    await fs.writeFile(proposalPath, proposal);

    preparation = await prepareChangeDeletion(change, changes);
    execFileSync(
      "git",
      ["-C", root, "commit", "--quiet", "--allow-empty", "-m", "advance HEAD"],
      {
        encoding: "utf8"
      }
    );
    const headDrift = await executePreparedChangeDeletion(preparation);
    assert.equal(headDrift.outcome, "no-change");
    assert.match(headDrift.error ?? "", /HEAD changed/u);
    await fs.access(change);
  });
});

test("prepared deletion claims the tombstone without overwriting a concurrent target", async () => {
  await withTempRoot("complete-target-race", async (root) => {
    const changes = path.join(root, "changes");
    const change = await writePlan(changes, "raced-plan", {
      tasks: completedTasks
    });
    commitAll(root, "record raced plan");

    let preparation = await prepareChangeDeletion(change, changes);
    await ensureChangeTombstoneRoot(preparation);
    preparation = await prepareChangeDeletion(change, changes);

    const originalMkdir = fs.mkdir.bind(fs);
    let injected = false;
    Object.defineProperty(fs, "mkdir", {
      configurable: true,
      value: async (...arguments_: Parameters<typeof fs.mkdir>) => {
        if (!injected && arguments_[0] === preparation.tombstoneDirectory) {
          injected = true;
          await originalMkdir(...arguments_);
          await fs.writeFile(
            path.join(preparation.tombstoneDirectory, "foreign.txt"),
            "foreign\n"
          );
          return undefined;
        }
        return await originalMkdir(...arguments_);
      },
      writable: true
    });
    let result;
    try {
      result = await executePreparedChangeDeletion(preparation);
    } finally {
      Object.defineProperty(fs, "mkdir", {
        configurable: true,
        value: originalMkdir,
        writable: true
      });
    }

    assert.equal(result.outcome, "no-change");
    assert.equal(result.changed, false);
    assert.equal(result.tombstoneDirectory, preparation.tombstoneDirectory);
    assert.match(result.error ?? "", /without overwrite|pending inspection/u);
    await fs.access(change);
    assert.equal(
      await fs.readFile(
        path.join(preparation.tombstoneDirectory, "foreign.txt"),
        "utf8"
      ),
      "foreign\n"
    );
  });
});

test("complete stops when the Plan lifecycle changes while tombstone setup runs", async () => {
  await withTempRoot("complete-lifecycle-race", async (root) => {
    const changes = path.join(root, "changes");
    const change = await writePlan(changes, "lifecycle-plan", {
      tasks: completedTasks
    });
    commitAll(root, "record lifecycle plan");
    const tasksPath = path.join(change, "tasks.md");
    const originalTasks = await fs.readFile(tasksPath, "utf8");
    const tombstoneRoot = path.join(changes, ".change-plan-tombstones");
    const originalMkdir = fs.mkdir.bind(fs);
    let injected = false;
    Object.defineProperty(fs, "mkdir", {
      configurable: true,
      value: async (...arguments_: Parameters<typeof fs.mkdir>) => {
        const result = await originalMkdir(...arguments_);
        if (!injected && arguments_[0] === tombstoneRoot) {
          injected = true;
          await fs.writeFile(
            tasksPath,
            originalTasks.replace("- [x] 1.1", "- [ ] 1.1")
          );
          commitAll(root, "change lifecycle during completion");
        }
        return result;
      },
      writable: true
    });
    let result;
    try {
      result = await completeChangePlanDirectory(change);
    } finally {
      Object.defineProperty(fs, "mkdir", {
        configurable: true,
        value: originalMkdir,
        writable: true
      });
    }
    assert.equal(result.outcome, "no-change");
    assert.equal(result.changed, false);
    assert.match(result.error ?? "", /lifecycle changed/u);
    await fs.access(change);
  });
});

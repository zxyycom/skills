import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  requireSuccess,
  run,
  workspaceRoot
} from "./environment-test-process.ts";
import {
  assertHookExecutes,
  assertHooksAreUsable,
  createHashHookRepository,
  createRepository,
  gitCommitConfig,
  repositoryHookNames
} from "./environment-test-repository.ts";
import {
  createFakeToolPath,
  runEnvironment
} from "./environment-test-tools.ts";

test("environment setup enables repository hooks in a fresh clone", async () => {
  const tempRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "skills environment clone ")
  );
  try {
    const source = await createRepository(tempRoot, "source repository");
    const clone = path.join(tempRoot, "fresh clone");
    requireSuccess(
      run(
        "git",
        ["-c", "core.autocrlf=true", "clone", "--no-local", source, clone],
        tempRoot
      ),
      "git clone"
    );
    const fakeTools = await createFakeToolPath(tempRoot);

    const setup = runEnvironment(clone, "setup", fakeTools);
    requireSuccess(setup, "environment setup");
    assert.equal(
      run(
        "git",
        ["config", "--local", "--get", "core.hooksPath"],
        clone
      ).stdout.trim(),
      ".githooks"
    );
    for (const hookName of repositoryHookNames) {
      assert.equal(
        (
          await fs.readFile(path.join(clone, ".githooks", hookName), "utf8")
        ).includes("\r"),
        false,
        `${hookName} must remain LF-only when checkout conversion is enabled`
      );
    }
    await assertHooksAreUsable(clone);

    assertHookExecutes(clone);
    assert.equal(
      await fs.readFile(path.join(clone, ".hook-ran"), "utf8"),
      "executed\n"
    );
    requireSuccess(
      run(
        "git",
        [
          ...gitCommitConfig,
          "commit",
          "--no-verify",
          "--allow-empty",
          "-m",
          "post hook check"
        ],
        clone
      ),
      "commit through post-commit"
    );
    assert.equal(
      await fs.readFile(path.join(clone, ".post-hook-ran"), "utf8"),
      "executed\n"
    );
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test("repository hook setup rejects non-regular hook paths", async () => {
  const tempRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "skills invalid repository hook ")
  );
  try {
    const root = await createRepository(tempRoot, "repository");
    const preCommit = path.join(root, ".githooks", "pre-commit");
    const postCommit = path.join(root, ".githooks", "post-commit");
    await fs.chmod(preCommit, 0o600);
    const preCommitMode = (await fs.stat(preCommit)).mode;
    await fs.rm(postCommit);
    await fs.mkdir(postCommit);

    const setup = run(
      process.execPath,
      [path.join(root, "scripts", "setup-git-hooks.js")],
      root
    );

    assert.equal(setup.status, 1);
    assert.match(setup.stderr, /post-commit hook must be a regular file/u);
    assert.equal((await fs.stat(preCommit)).mode, preCommitMode);
    assert.equal(
      run("git", ["config", "--local", "--get", "core.hooksPath"], root).status,
      1
    );
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test("environment setup is idempotent in a linked worktree and keeps the main task root", async () => {
  const tempRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "skills environment worktree ")
  );
  try {
    const main = await createRepository(tempRoot, "main repository");
    const linked = path.join(tempRoot, "linked worker");
    requireSuccess(
      run("git", ["worktree", "add", "-b", "worker", linked], main),
      "git worktree add"
    );
    for (const hookName of repositoryHookNames) {
      await fs.chmod(path.join(linked, ".githooks", hookName), 0o600);
    }
    const fakeTools = await createFakeToolPath(tempRoot);

    requireSuccess(
      runEnvironment(linked, "setup", fakeTools),
      "first linked worktree setup"
    );
    requireSuccess(
      runEnvironment(linked, "setup", fakeTools),
      "repeated linked worktree setup"
    );
    assert.equal(
      run("git", ["worktree", "list", "--porcelain"], linked).stdout.split(
        "\n",
        1
      )[0],
      `worktree ${main}`
    );
    await assertHooksAreUsable(linked);
    assertHookExecutes(linked);
    assert.equal(
      await fs.readFile(path.join(linked, ".hook-ran"), "utf8"),
      "executed\n"
    );
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test("real hash pre-commit succeeds in a linked worktree with isolated Git environment", async () => {
  const tempRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "skills real hash hook ")
  );
  try {
    const main = await createHashHookRepository(tempRoot, "main repository");
    const linked = path.join(tempRoot, "linked worker");
    requireSuccess(
      run("git", ["worktree", "add", "-b", "worker", linked], main),
      "git worktree add"
    );
    await fs.symlink(
      path.join(workspaceRoot, "node_modules"),
      path.join(linked, "node_modules"),
      process.platform === "win32" ? "junction" : "dir"
    );
    requireSuccess(
      run("git", ["config", "--local", "core.hooksPath", ".githooks"], linked),
      "configure hooksPath"
    );

    const commit = run(
      "git",
      [...gitCommitConfig, "commit", "--allow-empty", "-m", "hook regression"],
      linked
    );
    requireSuccess(commit, "linked worktree commit with real hash hook");
    assert.equal(
      await fs.readFile(path.join(linked, ".hash-hook-ran"), "utf8"),
      "executed\n"
    );
    assert.equal(
      run("git", ["log", "-1", "--format=%s"], linked).stdout.trim(),
      "hook regression"
    );
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

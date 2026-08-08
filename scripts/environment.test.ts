import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import type { SpawnSyncReturns } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const workspaceRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

type CommandResult = SpawnSyncReturns<string>;

function run(
  command: string,
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv = process.env
): CommandResult {
  return spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env,
    stdio: "pipe",
    windowsHide: true
  });
}

function requireSuccess(result: CommandResult, label: string): void {
  assert.equal(
    result.status,
    0,
    `${label} failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`
  );
}

async function writeExecutable(filePath: string, source: string): Promise<void> {
  await fs.writeFile(filePath, source, "utf8");
  await fs.chmod(filePath, 0o755);
}

async function createRepository(parent: string, name: string): Promise<string> {
  const root = path.join(parent, name);
  await fs.mkdir(path.join(root, "scripts"), { recursive: true });
  await fs.mkdir(path.join(root, ".githooks"), { recursive: true });
  await fs.mkdir(path.join(root, "docs", "task-graph"), { recursive: true });
  await fs.mkdir(
    path.join(root, "skills", "task-graph", "scripts"),
    { recursive: true }
  );

  for (const script of [
    "environment.js",
    "setup-git-hooks.js",
    "setup-repository.js",
    "task-graph.js"
  ]) {
    await fs.copyFile(
      path.join(workspaceRoot, "scripts", script),
      path.join(root, "scripts", script)
    );
  }

  await fs.writeFile(
    path.join(root, "package.json"),
    `${JSON.stringify({
      engines: { bun: ">=1.3" },
      packageManager: "pnpm@11.7.0",
      private: true,
      scripts: {
        "task-graph": "node scripts/task-graph.js"
      },
      type: "module"
    }, null, 2)}\n`,
    "utf8"
  );
  await fs.writeFile(
    path.join(root, "pnpm-lock.yaml"),
    "lockfileVersion: '9.0'\n",
    "utf8"
  );
  await fs.writeFile(
    path.join(root, "docs", "task-graph", "task-graph-index.json"),
    "{}\n",
    "utf8"
  );
  await fs.writeFile(
    path.join(root, ".githooks", "pre-commit"),
    "#!/bin/sh\nprintf 'executed\\n' > .hook-ran\nexit 1\n",
    "utf8"
  );
  await fs.chmod(path.join(root, ".githooks", "pre-commit"), 0o644);
  await fs.writeFile(
    path.join(root, "skills", "task-graph", "scripts", "task-graph.mjs"),
    [
      "#!/usr/bin/env node",
      "console.log(JSON.stringify({ argv: process.argv.slice(2), cwd: process.cwd() }));",
      ""
    ].join("\n"),
    "utf8"
  );

  requireSuccess(run("git", ["init", "-b", "main"], root), "git init");
  requireSuccess(
    run("git", ["config", "user.name", "Environment Test"], root),
    "git config user.name"
  );
  requireSuccess(
    run("git", ["config", "user.email", "environment@example.invalid"], root),
    "git config user.email"
  );
  requireSuccess(run("git", ["add", "."], root), "git add");
  requireSuccess(
    run("git", ["commit", "--no-verify", "-m", "fixture"], root),
    "git commit"
  );
  return root;
}

async function copyRepositoryPath(
  relativePath: string,
  targetRoot: string
): Promise<void> {
  const source = path.join(workspaceRoot, relativePath);
  const target = path.join(targetRoot, relativePath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.cp(source, target, { recursive: true });
}

async function createHashHookRepository(
  parent: string,
  name: string
): Promise<string> {
  const root = path.join(parent, name);
  await fs.mkdir(root, { recursive: true });
  for (const relativePath of [
    "scripts/hash-skills.ts",
    "scripts/lib/project.ts",
    "scripts/lib/skill-package-hash.ts",
    "tools/shared/src/markdown/frontmatter.ts",
    "tools/shared/src/node/filesystem.ts",
    "tools/shared/src/version-control",
    "tools/skill-package/src/version.ts"
  ]) {
    await copyRepositoryPath(relativePath, root);
  }

  await fs.mkdir(path.join(root, ".githooks"), { recursive: true });
  const hookSource = await fs.readFile(
    path.join(workspaceRoot, ".githooks", "pre-commit"),
    "utf8"
  );
  await fs.writeFile(
    path.join(root, ".githooks", "pre-commit"),
    `${hookSource.trimEnd()}\nprintf 'executed\\n' > .hash-hook-ran\n`,
    "utf8"
  );
  await fs.chmod(path.join(root, ".githooks", "pre-commit"), 0o755);
  await fs.writeFile(
    path.join(root, "package.json"),
    `${JSON.stringify({
      private: true,
      scripts: { "hash:skills": "bun scripts/hash-skills.ts" },
      type: "module"
    }, null, 2)}\n`,
    "utf8"
  );
  await fs.writeFile(
    path.join(root, ".gitignore"),
    "node_modules/\n.hash-hook-ran\n",
    "utf8"
  );
  await fs.mkdir(path.join(root, "skills", "alpha"), { recursive: true });
  await fs.writeFile(
    path.join(root, "skills", "alpha", "SKILL.md"),
    [
      "---",
      "name: alpha",
      "description: Linked worktree hook regression fixture.",
      "metadata:",
      "  version: \"1\"",
      "---",
      "",
      "# Alpha",
      ""
    ].join("\n"),
    "utf8"
  );

  requireSuccess(run("git", ["init", "-b", "main"], root), "git init");
  requireSuccess(
    run("git", ["config", "user.name", "Environment Test"], root),
    "git config user.name"
  );
  requireSuccess(
    run("git", ["config", "user.email", "environment@example.invalid"], root),
    "git config user.email"
  );
  requireSuccess(run("git", ["add", "."], root), "git add");
  requireSuccess(
    run("git", ["commit", "--no-verify", "-m", "fixture"], root),
    "git commit"
  );
  return root;
}

async function createFakeToolPath(parent: string): Promise<string> {
  const bin = path.join(parent, "fake tools");
  await fs.mkdir(bin, { recursive: true });
  const dispatcherPath = path.join(bin, "fake-tool.mjs");
  await fs.writeFile(
    dispatcherPath,
    [
      "const [tool, command] = process.argv.slice(2);",
      "if (tool === 'pnpm' && command === '--version') console.log('11.7.0');",
      "else if (tool === 'pnpm' && command === 'list') console.log('[{}]');",
      "else if (tool === 'pnpm' && command === 'install') process.exit(0);",
      "else if (tool === 'codegraph' && command === '--version') console.log('codegraph 1.2.3');",
      "else if (tool === 'codegraph' && command === 'status') console.log(JSON.stringify({ initialized: true, lastIndexed: 'fixture' }));",
      "else if (tool === 'codegraph' && (command === 'init' || command === 'sync')) process.exit(0);",
      "else { console.error(`unexpected ${tool} command: ${process.argv.slice(3).join(' ')}`); process.exit(2); }",
      ""
    ].join("\n"),
    "utf8"
  );

  for (const tool of ["pnpm", "codegraph"]) {
    if (process.platform === "win32") {
      const quoteBatch = (value: string): string =>
        `"${value.replaceAll("%", "%%").replaceAll("\"", "\"\"")}"`;
      await fs.writeFile(
        path.join(bin, `${tool}.cmd`),
        `@${quoteBatch(process.execPath)} ${quoteBatch(dispatcherPath)} ${tool} %*\r\n`,
        "utf8"
      );
    } else {
      const quoteShell = (value: string): string =>
        `'${value.replaceAll("'", `'\"'\"'`)}'`;
      await writeExecutable(
        path.join(bin, tool),
        [
          "#!/bin/sh",
          `exec ${quoteShell(process.execPath)} ${quoteShell(dispatcherPath)} ${tool} "$@"`,
          ""
        ].join("\n")
      );
    }
  }
  return bin;
}

function environmentWith(fakeToolPath: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    PATH: `${fakeToolPath}${path.delimiter}${process.env.PATH ?? ""}`
  };
}

function runEnvironment(
  root: string,
  action: "check" | "setup",
  fakeToolPath: string
): CommandResult {
  return run(
    process.execPath,
    [path.join(root, "scripts", "environment.js"), action],
    root,
    environmentWith(fakeToolPath)
  );
}

function assertHookExecutes(root: string): void {
  const result = run("git", ["commit", "--allow-empty", "-m", "hook check"], root);
  assert.notEqual(result.status, 0, "the fixture hook must block the commit");
}

async function assertHookIsUsable(root: string): Promise<void> {
  const hook = await fs.stat(path.join(root, ".githooks", "pre-commit"));
  assert.equal(hook.isFile(), true);
  if (process.platform !== "win32") {
    assert.notEqual(hook.mode & 0o111, 0);
  }
}

test("environment setup enables the pre-commit hook in a fresh clone", async () => {
  const tempRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "skills environment clone ")
  );
  try {
    const source = await createRepository(tempRoot, "source repository");
    const clone = path.join(tempRoot, "fresh clone");
    requireSuccess(run("git", ["clone", source, clone], tempRoot), "git clone");
    requireSuccess(
      run("git", ["config", "user.name", "Environment Test"], clone),
      "clone user.name"
    );
    requireSuccess(
      run("git", ["config", "user.email", "environment@example.invalid"], clone),
      "clone user.email"
    );
    const fakeTools = await createFakeToolPath(tempRoot);

    const setup = runEnvironment(clone, "setup", fakeTools);
    requireSuccess(setup, "environment setup");
    assert.equal(
      run("git", ["config", "--local", "--get", "core.hooksPath"], clone)
        .stdout.trim(),
      ".githooks"
    );
    assert.equal(
      run(
        "git",
        ["config", "--local", "--get", "skills.taskGraphRoot"],
        clone
      ).stdout.trim(),
      clone
    );
    await assertHookIsUsable(clone);

    assertHookExecutes(clone);
    assert.equal(
      await fs.readFile(path.join(clone, ".hook-ran"), "utf8"),
      "executed\n"
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
    await fs.chmod(path.join(linked, ".githooks", "pre-commit"), 0o600);
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
      run(
        "git",
        ["config", "--local", "--get", "skills.taskGraphRoot"],
        linked
      ).stdout.trim(),
      main
    );
    await assertHookIsUsable(linked);
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
      ["commit", "--allow-empty", "-m", "hook regression"],
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

test("environment check reports missing repository setup without writing it", async () => {
  const tempRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "skills environment check ")
  );
  try {
    const root = await createRepository(tempRoot, "unchecked repository");
    const fakeTools = await createFakeToolPath(tempRoot);
    const configBefore = run("git", ["config", "--local", "--list"], root)
      .stdout;
    const modeBefore = (await fs.stat(path.join(root, ".githooks", "pre-commit")))
      .mode;

    const check = runEnvironment(root, "check", fakeTools);

    assert.equal(check.status, 1);
    assert.match(check.stdout, /repository setup/u);
    assert.match(check.stdout, /environment\.js setup/u);
    assert.equal(
      run("git", ["config", "--local", "--list"], root).stdout,
      configBefore
    );
    assert.equal(
      (await fs.stat(path.join(root, ".githooks", "pre-commit"))).mode,
      modeBefore
    );
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test("task-graph package command requires and injects the configured main root", async () => {
  const tempRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "skills task launcher ")
  );
  try {
    const main = await createRepository(tempRoot, "main repository");
    const linked = path.join(tempRoot, "linked worker");
    requireSuccess(
      run("git", ["worktree", "add", "-b", "worker", linked], main),
      "git worktree add"
    );
    requireSuccess(
      run(
        process.execPath,
        [path.join(linked, "scripts", "setup-repository.js")],
        linked
      ),
      "repository setup"
    );

    const launched = run(
      "bun",
      ["run", "task-graph", "--", "task", "list"],
      linked
    );
    requireSuccess(launched, "task-graph package command");
    assert.deepEqual(JSON.parse(launched.stdout), {
      argv: ["task", "list", "--root", main],
      cwd: main
    });

    for (const overrideArgs of [
      ["--root", linked],
      [`--root=${linked}`],
      ["--index", linked],
      [`--index=${linked}`]
    ]) {
      const override = run(
        "bun",
        ["run", "task-graph", "--", "task", "list", ...overrideArgs],
        linked
      );
      assert.equal(override.status, 1);
      assert.match(override.stderr, /owns --root and --index/u);
    }

    requireSuccess(
      run(
        "git",
        ["config", "--local", "--unset-all", "skills.taskGraphRoot"],
        linked
      ),
      "unset task root"
    );
    const unconfigured = run(
      "bun",
      ["run", "task-graph", "--", "task", "list"],
      linked
    );
    assert.equal(unconfigured.status, 1);
    assert.match(unconfigured.stderr, /is not configured/u);
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test("task-graph package command rejects a stale configured main root", async () => {
  const tempRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "skills stale task root ")
  );
  try {
    const main = await createRepository(tempRoot, "current main repository");
    const linked = path.join(tempRoot, "linked worker");
    requireSuccess(
      run("git", ["worktree", "add", "-b", "worker", linked], main),
      "git worktree add"
    );
    const staleRoot = await createRepository(
      tempRoot,
      "former main repository with task index"
    );
    requireSuccess(
      run(
        "git",
        ["config", "--local", "skills.taskGraphRoot", staleRoot],
        linked
      ),
      "configure stale task root"
    );

    const launched = run(
      "bun",
      ["run", "task-graph", "--", "task", "list"],
      linked
    );
    assert.equal(launched.status, 1);
    assert.equal(launched.stdout, "");
    assert.match(launched.stderr, /does not match the current main worktree/u);
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

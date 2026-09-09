import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
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
const autoPushScript = path.join(workspaceRoot, "scripts", "auto-push.ts");
const postCommitHook = path.join(workspaceRoot, ".githooks", "post-commit");
const throttleRef = "refs/codex/auto-push/last-attempt";
const gitCommitConfig = [
  "-c",
  "user.email=auto-push@example.invalid",
  "-c",
  "user.name=Auto Push Test"
];

type AutoPushFixture = Readonly<{
  local: string;
  remote: string;
  root: string;
}>;

type AsyncCommandResult = Readonly<{
  status: number | null;
  stderr: string;
  stdout: string;
}>;

function run(
  command: string,
  args: readonly string[],
  cwd: string,
  input?: string
): SpawnSyncReturns<string> {
  return spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    input,
    stdio: input === undefined ? "pipe" : ["pipe", "pipe", "pipe"],
    windowsHide: true
  });
}

async function runAsync(
  command: string,
  args: readonly string[],
  cwd: string
): Promise<AsyncCommandResult> {
  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.once("error", reject);
    child.once("close", (status) => resolve({ status, stderr, stdout }));
  });
}

function requireSuccess(result: SpawnSyncReturns<string>, label: string): void {
  assert.equal(
    result.status,
    0,
    `${label} failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`
  );
}

function git(cwd: string, args: readonly string[]): SpawnSyncReturns<string> {
  return run("git", args, cwd);
}

async function commit(root: string, message: string): Promise<string> {
  await fs.writeFile(path.join(root, "content.txt"), `${message}\n`, "utf8");
  requireSuccess(git(root, ["add", "content.txt"]), `stage ${message}`);
  requireSuccess(
    git(root, [...gitCommitConfig, "commit", "--no-verify", "-m", message]),
    `commit ${message}`
  );
  const revision = git(root, ["rev-parse", "HEAD"]);
  requireSuccess(revision, `read ${message} revision`);
  return revision.stdout.trim();
}

function remoteMain(fixture: AutoPushFixture): string {
  const result = git(fixture.root, [
    `--git-dir=${fixture.remote}`,
    "rev-parse",
    "refs/heads/main"
  ]);
  requireSuccess(result, "read remote main");
  return result.stdout.trim();
}

function invokeAutoPush(root: string): SpawnSyncReturns<string> {
  return run("bun", [autoPushScript], root);
}

function setAttemptTimestamp(root: string, timestamp: number): void {
  setAttemptState(root, String(timestamp));
}

function setAttemptState(root: string, state: string): void {
  const object = run("git", ["hash-object", "-w", "--stdin"], root, state);
  requireSuccess(object, "write auto-push throttle object");
  requireSuccess(
    git(root, ["update-ref", throttleRef, object.stdout.trim()]),
    "update auto-push throttle ref"
  );
}

async function installAutoPushHook(root: string): Promise<void> {
  const hookDirectory = path.join(root, ".githooks");
  const scriptDirectory = path.join(root, "scripts");
  await fs.mkdir(hookDirectory, { recursive: true });
  await fs.mkdir(scriptDirectory, { recursive: true });
  await fs.copyFile(postCommitHook, path.join(hookDirectory, "post-commit"));
  await fs.copyFile(autoPushScript, path.join(scriptDirectory, "auto-push.ts"));
  await fs.chmod(path.join(hookDirectory, "post-commit"), 0o755);
  requireSuccess(
    git(root, ["config", "--local", "core.hooksPath", ".githooks"]),
    "enable auto-push hook"
  );
}

async function createFixture(): Promise<AutoPushFixture> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "skills auto-push "));
  const remote = path.join(root, "remote.git");
  const seed = path.join(root, "seed");
  const local = path.join(root, "local");
  await fs.mkdir(seed);
  requireSuccess(
    git(root, ["init", "--bare", "--initial-branch=main", remote]),
    "initialize bare remote"
  );
  requireSuccess(git(seed, ["init", "-b", "main"]), "initialize seed");
  await commit(seed, "seed");
  requireSuccess(
    git(seed, ["remote", "add", "origin", remote]),
    "add seed remote"
  );
  requireSuccess(
    git(seed, ["push", "origin", "refs/heads/main:refs/heads/main"]),
    "push seed"
  );
  requireSuccess(git(root, ["clone", remote, local]), "clone local");
  return { local, remote, root };
}

test("post-commit auto-push pushes main at most once per hour", async () => {
  const fixture = await createFixture();
  try {
    await installAutoPushHook(fixture.local);
    const first = await commit(fixture.local, "first");
    assert.equal(remoteMain(fixture), first);

    await commit(fixture.local, "second");
    assert.equal(remoteMain(fixture), first);

    setAttemptTimestamp(fixture.local, 0);
    const third = await commit(fixture.local, "third");
    assert.equal(remoteMain(fixture), third);
  } finally {
    await fs.rm(fixture.root, { recursive: true, force: true });
  }
});

test("post-commit auto-push serializes concurrent hourly attempts", async () => {
  const fixture = await createFixture();
  try {
    const localRevision = await commit(fixture.local, "local");

    const results = await Promise.all([
      runAsync("bun", [autoPushScript], fixture.local),
      runAsync("bun", [autoPushScript], fixture.local)
    ]);

    assert.deepEqual(
      results.map(({ status }) => status),
      [0, 0]
    );
    assert.equal(
      results.filter(({ stdout }) => stdout.includes("pushed origin/main"))
        .length,
      1
    );
    assert.equal(remoteMain(fixture), localRevision);
  } finally {
    await fs.rm(fixture.root, { recursive: true, force: true });
  }
});

test("post-commit auto-push leaves a conflicting remote main unchanged", async () => {
  const fixture = await createFixture();
  try {
    const rival = path.join(fixture.root, "rival");
    requireSuccess(
      git(fixture.root, ["clone", fixture.remote, rival]),
      "clone rival"
    );
    const rivalRevision = await commit(rival, "rival");
    requireSuccess(
      git(rival, ["push", "origin", "refs/heads/main:refs/heads/main"]),
      "push rival"
    );
    await installAutoPushHook(fixture.local);
    const localRevision = await commit(fixture.local, "local");

    assert.equal(remoteMain(fixture), rivalRevision);
    assert.equal(
      git(fixture.local, ["rev-parse", "HEAD"]).stdout.trim(),
      localRevision
    );
  } finally {
    await fs.rm(fixture.root, { recursive: true, force: true });
  }
});

test("post-commit auto-push fails closed for invalid throttle state", async () => {
  const fixture = await createFixture();
  try {
    const initialRemote = remoteMain(fixture);
    await commit(fixture.local, "local");
    setAttemptState(fixture.local, "invalid");

    const rejected = invokeAutoPush(fixture.local);

    assert.equal(rejected.status, 1);
    assert.match(rejected.stderr, /integer timestamp/u);
    assert.equal(remoteMain(fixture), initialRemote);
  } finally {
    await fs.rm(fixture.root, { recursive: true, force: true });
  }
});

test("post-commit auto-push skips commits outside main", async () => {
  const fixture = await createFixture();
  try {
    const initialRemote = remoteMain(fixture);
    requireSuccess(
      git(fixture.local, ["switch", "-c", "worker"]),
      "switch to worker"
    );
    await commit(fixture.local, "worker");

    const skipped = invokeAutoPush(fixture.local);

    requireSuccess(skipped, "worker auto-push");
    assert.equal(skipped.stdout, "");
    assert.equal(remoteMain(fixture), initialRemote);
    assert.equal(
      git(fixture.local, ["rev-parse", "--verify", "--quiet", throttleRef])
        .status,
      1
    );
  } finally {
    await fs.rm(fixture.root, { recursive: true, force: true });
  }
});

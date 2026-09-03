import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, test } from "node:test";
import { runWorkspaceOperation } from "../src/runtime.ts";
import {
  createBridgeFixture,
  fixtureSsh,
  type BridgeFixture
} from "./support.ts";

const fixtures: BridgeFixture[] = [];
afterEach(async () => {
  await Promise.all(fixtures.splice(0).map((fixture) => fixture.cleanup()));
});

async function fixture(): Promise<BridgeFixture> {
  const value = await createBridgeFixture();
  fixtures.push(value);
  return value;
}

function runtime(
  value: BridgeFixture,
  timeoutMs = 1_000
): Readonly<{ sshExecutable: string; timeoutMs: number }> {
  return { sshExecutable: fixtureSsh(value), timeoutMs };
}

test("workspace shell preserves multiline data until the fixed target shell consumes it", async () => {
  const value = await fixture();
  const result = await runWorkspaceOperation(
    "shell",
    {
      command: `printf 'quote=%s\\n' "a'b"\ncat <<'EOF'\n$HOME ; \`literal\`\nEOF\n`
    },
    value.bridgeConfig,
    runtime(value)
  );
  assert.equal(result.ok, true);
  assert.equal(result.stdout, "quote=a'b\n$HOME ; `literal`\n");
});

test("workspace shell distinguishes target exit, timeout, and SSH transport failure", async () => {
  const value = await fixture();
  const target = await runWorkspaceOperation(
    "shell",
    { command: "echo target; exit 7" },
    value.bridgeConfig,
    runtime(value)
  );
  assert.equal(target.failure_kind, "target_exit");
  assert.equal(target.target.exit_code, 7);
  assert.equal(target.stdout, "target\n");

  const target255 = await runWorkspaceOperation(
    "shell",
    { command: "exit 255" },
    value.bridgeConfig,
    runtime(value)
  );
  assert.equal(target255.failure_kind, "target_exit");
  assert.equal(target255.target.exit_code, 255);

  const startedAt = Date.now();
  const timeout = await runWorkspaceOperation(
    "shell",
    { command: "sleep 1" },
    value.bridgeConfig,
    runtime(value, 10)
  );
  assert.equal(timeout.failure_kind, "timeout");
  assert.equal(timeout.target.timed_out, true);
  assert.ok(
    Date.now() - startedAt < 500,
    "timeout must terminate the SSH process group within its bounded grace period"
  );

  const disconnected = await runWorkspaceOperation(
    "shell",
    { command: "true" },
    { ...value.bridgeConfig, backendHandle: "disconnect" },
    runtime(value)
  );
  assert.equal(disconnected.failure_kind, "transport_failure");
  assert.match(disconnected.stderr, /fixture disconnect/u);
});

test("workspace apply patch creates, updates, deletes, and atomically rejects a later invalid hunk", async () => {
  const value = await fixture();
  const create = await runWorkspaceOperation(
    "apply-patch",
    {
      patch:
        "diff --git a/new.txt b/new.txt\nnew file mode 100644\n--- /dev/null\n+++ b/new.txt\n@@ -0,0 +1 @@\n+created\n"
    },
    value.bridgeConfig,
    runtime(value)
  );
  assert.equal(create.ok, true);
  const update = await runWorkspaceOperation(
    "apply-patch",
    {
      patch:
        "diff --git a/tracked.txt b/tracked.txt\n--- a/tracked.txt\n+++ b/tracked.txt\n@@ -1 +1 @@\n-before\n+after\n"
    },
    value.bridgeConfig,
    runtime(value)
  );
  assert.equal(update.ok, true);
  const remove = await runWorkspaceOperation(
    "apply-patch",
    {
      patch:
        "diff --git a/new.txt b/new.txt\ndeleted file mode 100644\n--- a/new.txt\n+++ /dev/null\n@@ -1 +0,0 @@\n-created\n"
    },
    value.bridgeConfig,
    runtime(value)
  );
  assert.equal(remove.ok, true);
  const failing = await runWorkspaceOperation(
    "apply-patch",
    {
      patch:
        "diff --git a/tracked.txt b/tracked.txt\n--- a/tracked.txt\n+++ b/tracked.txt\n@@ -1 +1 @@\n-after\n+partial\ndiff --git a/missing.txt b/missing.txt\n--- a/missing.txt\n+++ b/missing.txt\n@@ -1 +1 @@\n-no\n+bad\n"
    },
    value.bridgeConfig,
    runtime(value)
  );
  assert.equal(failing.failure_kind, "target_exit");
  assert.equal(
    await fs.readFile(path.join(value.project, "tracked.txt"), "utf8"),
    "after\n"
  );
  await assert.rejects(fs.access(path.join(value.project, "new.txt")));
});

test("workspace apply patch rejects escape paths and oversized text before SSH", async () => {
  const value = await fixture();
  const escaped = await runWorkspaceOperation(
    "apply-patch",
    {
      patch:
        "diff --git a/../outside b/../outside\n--- a/../outside\n+++ b/../outside\n"
    },
    value.bridgeConfig,
    runtime(value)
  );
  assert.equal(escaped.failure_kind, "path_rejected");
  const oversized = await runWorkspaceOperation(
    "apply-patch",
    { patch: "x".repeat(64 * 1024 + 1) },
    value.bridgeConfig,
    runtime(value)
  );
  assert.equal(oversized.failure_kind, "text_too_large");
});

test("workspace put and get preserve binary and empty-file bytes with both endpoint hashes", async () => {
  const value = await fixture();
  await fs.writeFile(
    path.join(value.staging, "binary.bin"),
    Buffer.from([0, 255, 1, 2, 3])
  );
  await fs.writeFile(path.join(value.staging, "empty.bin"), Buffer.alloc(0));
  const binaryPut = await runWorkspaceOperation(
    "put-file",
    { sourcePath: "binary.bin", destinationPath: "from-agent.bin" },
    value.bridgeConfig,
    runtime(value)
  );
  assert.equal(binaryPut.ok, true);
  assert.equal(binaryPut.evidence?.bytes, 5);
  const emptyPut = await runWorkspaceOperation(
    "put-file",
    { sourcePath: "empty.bin", destinationPath: "empty.bin" },
    value.bridgeConfig,
    runtime(value)
  );
  assert.equal(emptyPut.ok, true);
  const get = await runWorkspaceOperation(
    "get-file",
    { sourcePath: "from-agent.bin", destinationPath: "roundtrip.bin" },
    value.bridgeConfig,
    runtime(value)
  );
  assert.equal(get.ok, true);
  assert.deepEqual(
    await fs.readFile(path.join(value.staging, "roundtrip.bin")),
    Buffer.from([0, 255, 1, 2, 3])
  );
  assert.equal(get.evidence?.sha256, binaryPut.evidence?.sha256);
});

test("workspace file transfer respects replace, rejects escapes, and cleans failed receives", async () => {
  const value = await fixture();
  await fs.writeFile(path.join(value.staging, "source.txt"), "new\n");
  await fs.writeFile(path.join(value.project, "destination.txt"), "old\n");
  const exists = await runWorkspaceOperation(
    "put-file",
    { sourcePath: "source.txt", destinationPath: "destination.txt" },
    value.bridgeConfig,
    runtime(value)
  );
  assert.equal(exists.failure_kind, "destination_exists");
  const replaced = await runWorkspaceOperation(
    "put-file",
    {
      sourcePath: "source.txt",
      destinationPath: "destination.txt",
      replace: true
    },
    value.bridgeConfig,
    runtime(value)
  );
  assert.equal(replaced.ok, true);
  assert.equal(
    await fs.readFile(path.join(value.project, "destination.txt"), "utf8"),
    "new\n"
  );
  const escaped = await runWorkspaceOperation(
    "get-file",
    { sourcePath: "../secret", destinationPath: "nope" },
    value.bridgeConfig,
    runtime(value)
  );
  assert.equal(escaped.failure_kind, "path_rejected");
  await fs.writeFile(path.join(value.staging, "existing.txt"), "existing\n");
  const getExists = await runWorkspaceOperation(
    "get-file",
    { sourcePath: "destination.txt", destinationPath: "existing.txt" },
    value.bridgeConfig,
    runtime(value)
  );
  assert.equal(getExists.failure_kind, "destination_exists");
  assert.equal(
    await fs.readFile(path.join(value.staging, "existing.txt"), "utf8"),
    "existing\n"
  );
  const temporaryEntries = (await fs.readdir(value.staging)).filter((name) =>
    name.includes(".mcpshell-")
  );
  assert.deepEqual(temporaryEntries, []);
});

test("workspace put reports an SSH spawn failure as transport failure", async () => {
  const value = await fixture();
  await fs.writeFile(path.join(value.staging, "source.txt"), "new\n");
  const result = await runWorkspaceOperation(
    "put-file",
    { destinationPath: "unwritten.txt", sourcePath: "source.txt" },
    value.bridgeConfig,
    { sshExecutable: "/definitely/not/a/command", timeoutMs: 1_000 }
  );
  assert.equal(result.failure_kind, "transport_failure");
  await assert.rejects(fs.access(path.join(value.project, "unwritten.txt")));
});

test("workspace put rejects an initial physical parent outside the project", async () => {
  const value = await fixture();
  const outside = path.join(path.dirname(value.project), "outside");
  await fs.mkdir(outside);
  await fs.symlink("../outside", path.join(value.project, "link"));
  await fs.writeFile(path.join(value.staging, "source.txt"), "new\n");
  const result = await runWorkspaceOperation(
    "put-file",
    { destinationPath: "link/escaped.txt", sourcePath: "source.txt" },
    value.bridgeConfig,
    runtime(value)
  );
  assert.equal(result.failure_kind, "path_rejected");
  assert.match(result.stderr, /destination escaped project root/u);
  await assert.rejects(fs.access(path.join(outside, "escaped.txt")));
});

test("workspace put binds its final commit to the verified parent during a symlink swap", async () => {
  const value = await fixture();
  const safeParent = path.join(value.project, "safe-parent");
  const outsideParent = path.join(
    path.dirname(value.project),
    "outside-parent"
  );
  const link = path.join(value.project, "linked-parent");
  await fs.mkdir(safeParent);
  await fs.mkdir(outsideParent);
  await fs.symlink(safeParent, link);
  const source = Buffer.alloc(8 * 1024 * 1024, 0x62);
  await fs.writeFile(path.join(value.staging, "source.bin"), source);
  const previous = {
    MCPSHELL_FIXTURE_SWAP_LINK: process.env.MCPSHELL_FIXTURE_SWAP_LINK,
    MCPSHELL_FIXTURE_SWAP_OUTSIDE: process.env.MCPSHELL_FIXTURE_SWAP_OUTSIDE,
    MCPSHELL_FIXTURE_SWAP_PARENT: process.env.MCPSHELL_FIXTURE_SWAP_PARENT
  };
  process.env.MCPSHELL_FIXTURE_SWAP_LINK = link;
  process.env.MCPSHELL_FIXTURE_SWAP_OUTSIDE = outsideParent;
  process.env.MCPSHELL_FIXTURE_SWAP_PARENT = safeParent;
  try {
    const result = await runWorkspaceOperation(
      "put-file",
      { destinationPath: "linked-parent/kept.bin", sourcePath: "source.bin" },
      { ...value.bridgeConfig, backendHandle: "swap" },
      runtime(value)
    );
    assert.equal(result.ok, true, result.stderr);
  } finally {
    for (const [name, previousValue] of Object.entries(previous)) {
      if (previousValue === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = previousValue;
      }
    }
  }
  assert.deepEqual(
    await fs.readFile(path.join(safeParent, "kept.bin")),
    source
  );
  await assert.rejects(fs.access(path.join(outsideParent, "kept.bin")));
});

test("workspace put reports a failed no-replace link without calling it an existing destination", async () => {
  const value = await fixture();
  await fs.writeFile(path.join(value.staging, "source.txt"), "new\n");
  const result = await runWorkspaceOperation(
    "put-file",
    { destinationPath: "new.txt", sourcePath: "source.txt" },
    { ...value.bridgeConfig, backendHandle: "link-failure" },
    runtime(value)
  );
  assert.equal(result.failure_kind, "target_exit");
  assert.match(result.stderr, /atomic no-replace link failed/u);
  assert.notEqual(result.failure_kind, "destination_exists");
  await assert.rejects(fs.access(path.join(value.project, "new.txt")));
});

test("workspace put rejects a verified parent moved outside the project and cleans its transfer", async () => {
  const value = await fixture();
  const parent = path.join(value.project, "moving-parent");
  const movedParent = path.join(path.dirname(value.project), "moved-parent");
  const source = Buffer.alloc(8 * 1024 * 1024, 0x63);
  await fs.mkdir(parent);
  await fs.writeFile(path.join(value.staging, "source.bin"), source);
  const previous = {
    MCPSHELL_FIXTURE_MOVE_OUTSIDE: process.env.MCPSHELL_FIXTURE_MOVE_OUTSIDE,
    MCPSHELL_FIXTURE_MOVE_PARENT: process.env.MCPSHELL_FIXTURE_MOVE_PARENT
  };
  process.env.MCPSHELL_FIXTURE_MOVE_PARENT = parent;
  process.env.MCPSHELL_FIXTURE_MOVE_OUTSIDE = movedParent;
  try {
    const result = await runWorkspaceOperation(
      "put-file",
      {
        destinationPath: "moving-parent/escaped.bin",
        sourcePath: "source.bin"
      },
      { ...value.bridgeConfig, backendHandle: "parent-move" },
      runtime(value)
    );
    assert.equal(result.failure_kind, "path_rejected");
    assert.match(result.stderr, /destination escaped project root/u);
  } finally {
    for (const [name, previousValue] of Object.entries(previous)) {
      if (previousValue === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = previousValue;
      }
    }
  }
  await assert.rejects(fs.access(path.join(movedParent, "escaped.bin")));
  assert.deepEqual(await fs.readdir(parent), []);
  assert.deepEqual(
    await fs.readFile(path.join(value.staging, "source.bin")),
    source
  );
});

test("workspace get reads a fixed physical source snapshot after its lexical parent swaps", async () => {
  const value = await fixture();
  const sourceParent = path.join(value.project, "safe-source");
  const outsideParent = path.join(
    path.dirname(value.project),
    "outside-source"
  );
  const link = path.join(value.project, "linked-source");
  await fs.mkdir(sourceParent);
  await fs.mkdir(outsideParent);
  await fs.writeFile(path.join(sourceParent, "secret.txt"), "inside\n");
  await fs.writeFile(path.join(outsideParent, "secret.txt"), "secret\n");
  await fs.symlink(sourceParent, link);
  const previous = {
    MCPSHELL_FIXTURE_GET_SWAP_LINK: process.env.MCPSHELL_FIXTURE_GET_SWAP_LINK,
    MCPSHELL_FIXTURE_GET_SWAP_OUTSIDE:
      process.env.MCPSHELL_FIXTURE_GET_SWAP_OUTSIDE
  };
  process.env.MCPSHELL_FIXTURE_GET_SWAP_LINK = link;
  process.env.MCPSHELL_FIXTURE_GET_SWAP_OUTSIDE = outsideParent;
  try {
    const result = await runWorkspaceOperation(
      "get-file",
      {
        destinationPath: "received.txt",
        sourcePath: "linked-source/secret.txt"
      },
      { ...value.bridgeConfig, backendHandle: "get-swap" },
      runtime(value)
    );
    assert.equal(result.ok, true, result.stderr);
  } finally {
    for (const [name, previousValue] of Object.entries(previous)) {
      if (previousValue === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = previousValue;
      }
    }
  }
  assert.equal(
    await fs.readFile(path.join(value.staging, "received.txt"), "utf8"),
    "inside\n"
  );
  assert.equal(await fs.readlink(link), outsideParent);
  assert.notEqual(
    await fs.readFile(path.join(value.staging, "received.txt"), "utf8"),
    "secret\n"
  );
});

test("workspace get commits to its canonical staging parent after a lexical destination swap", async () => {
  const value = await fixture();
  const safeParent = path.join(value.staging, "safe-destination");
  const outsideParent = path.join(
    path.dirname(value.staging),
    "outside-destination"
  );
  const link = path.join(value.staging, "linked-destination");
  await fs.mkdir(safeParent);
  await fs.mkdir(outsideParent);
  await fs.symlink(safeParent, link);
  const previous = {
    MCPSHELL_FIXTURE_DESTINATION_SWAP_LINK:
      process.env.MCPSHELL_FIXTURE_DESTINATION_SWAP_LINK,
    MCPSHELL_FIXTURE_DESTINATION_SWAP_OUTSIDE:
      process.env.MCPSHELL_FIXTURE_DESTINATION_SWAP_OUTSIDE
  };
  process.env.MCPSHELL_FIXTURE_DESTINATION_SWAP_LINK = link;
  process.env.MCPSHELL_FIXTURE_DESTINATION_SWAP_OUTSIDE = outsideParent;
  try {
    const result = await runWorkspaceOperation(
      "get-file",
      {
        destinationPath: "linked-destination/received.txt",
        sourcePath: "tracked.txt"
      },
      { ...value.bridgeConfig, backendHandle: "destination-swap" },
      runtime(value)
    );
    assert.equal(result.ok, true, result.stderr);
  } finally {
    for (const [name, previousValue] of Object.entries(previous)) {
      if (previousValue === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = previousValue;
      }
    }
  }
  assert.equal(
    await fs.readFile(path.join(safeParent, "received.txt"), "utf8"),
    "before\n"
  );
  await assert.rejects(fs.access(path.join(outsideParent, "received.txt")));
  assert.equal(await fs.readlink(link), outsideParent);
});

test("workspace put reports outcome unknown when final acknowledgment is lost", async () => {
  const value = await fixture();
  await fs.writeFile(path.join(value.staging, "source.txt"), "complete\n");
  const result = await runWorkspaceOperation(
    "put-file",
    { destinationPath: "possibly.txt", sourcePath: "source.txt" },
    { ...value.bridgeConfig, backendHandle: "marker-loss" },
    runtime(value)
  );
  assert.equal(result.failure_kind, "outcome_unknown");
  assert.equal(result.evidence?.destination, "possibly.txt");
  assert.equal(result.evidence?.bytes, 9);
  assert.match(String(result.evidence?.sha256), /^[a-f0-9]{64}$/u);
  assert.equal(
    await fs.readFile(path.join(value.project, "possibly.txt"), "utf8"),
    "complete\n"
  );
});

test("workspace put does not delete a replacement when final containment is unknown", async () => {
  const value = await fixture();
  const parent = path.join(value.project, "commit-parent");
  const movedParent = path.join(
    path.dirname(value.project),
    "moved-commit-parent"
  );
  const replacement = "replacement\n";
  await fs.mkdir(parent);
  await fs.writeFile(path.join(value.staging, "source.txt"), "original\n");
  const previous = {
    MCPSHELL_FIXTURE_COMMIT_DESTINATION:
      process.env.MCPSHELL_FIXTURE_COMMIT_DESTINATION,
    MCPSHELL_FIXTURE_COMMIT_OUTSIDE:
      process.env.MCPSHELL_FIXTURE_COMMIT_OUTSIDE,
    MCPSHELL_FIXTURE_COMMIT_PARENT: process.env.MCPSHELL_FIXTURE_COMMIT_PARENT,
    MCPSHELL_FIXTURE_COMMIT_REPLACEMENT:
      process.env.MCPSHELL_FIXTURE_COMMIT_REPLACEMENT
  };
  process.env.MCPSHELL_FIXTURE_COMMIT_DESTINATION = "complete.txt";
  process.env.MCPSHELL_FIXTURE_COMMIT_OUTSIDE = movedParent;
  process.env.MCPSHELL_FIXTURE_COMMIT_PARENT = parent;
  process.env.MCPSHELL_FIXTURE_COMMIT_REPLACEMENT = replacement;
  try {
    const result = await runWorkspaceOperation(
      "put-file",
      {
        destinationPath: "commit-parent/complete.txt",
        sourcePath: "source.txt"
      },
      { ...value.bridgeConfig, backendHandle: "post-commit-replace" },
      runtime(value)
    );
    assert.equal(result.failure_kind, "outcome_unknown");
    assert.equal(result.evidence?.destination, "commit-parent/complete.txt");
  } finally {
    for (const [name, previousValue] of Object.entries(previous)) {
      if (previousValue === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = previousValue;
      }
    }
  }
  assert.equal(
    await fs.readFile(path.join(movedParent, "complete.txt"), "utf8"),
    replacement
  );
});

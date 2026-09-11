import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { runWorkspaceOperation } from "../src/runtime.ts";
import { fixture, runtime } from "./runtime-test-support.ts";

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

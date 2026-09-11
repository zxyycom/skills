import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { runWorkspaceOperation } from "../src/runtime.ts";
import { fixture, runtime } from "./runtime-test-support.ts";

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

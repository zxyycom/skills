import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { runWorkspaceOperation } from "../src/runtime.ts";
import { fixture, runtime } from "./runtime-test-support.ts";

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

test("workspace selects operation-specific runtime deadlines", async () => {
  const value = await fixture();
  await fs.writeFile(path.join(value.staging, "source.txt"), "source\n");
  const originalSetTimeout = globalThis.setTimeout;
  const deadlines: number[] = [];
  globalThis.setTimeout = ((callback: () => void, delay?: number) => {
    deadlines.push(delay ?? 0);
    return originalSetTimeout(callback, delay);
  }) as typeof setTimeout;
  try {
    assert.equal(
      (
        await runWorkspaceOperation(
          "shell",
          { command: "true" },
          value.bridgeConfig,
          runtime(value)
        )
      ).ok,
      true
    );
    assert.equal(
      (
        await runWorkspaceOperation(
          "apply-patch",
          {
            patch:
              "diff --git a/tracked.txt b/tracked.txt\n--- a/tracked.txt\n+++ b/tracked.txt\n@@ -1 +1 @@\n-before\n+after\n"
          },
          value.bridgeConfig,
          runtime(value)
        )
      ).ok,
      true
    );
    assert.equal(
      (
        await runWorkspaceOperation(
          "put-file",
          { destinationPath: "source.txt", sourcePath: "source.txt" },
          value.bridgeConfig,
          runtime(value)
        )
      ).ok,
      true
    );
    assert.equal(
      (
        await runWorkspaceOperation(
          "get-file",
          { destinationPath: "received.txt", sourcePath: "tracked.txt" },
          value.bridgeConfig,
          runtime(value)
        )
      ).ok,
      true
    );
  } finally {
    globalThis.setTimeout = originalSetTimeout;
  }
  assert.deepEqual(deadlines, [110_000, 110_000, 290_000, 290_000]);
});

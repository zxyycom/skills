import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { syncTestEvidenceIndex } from "../src/cli.ts";

test("rejects a catalog path that cannot be inspected", async () => {
  const workspaceRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "test-evidence-config-path-")
  );
  try {
    const result = await syncTestEvidenceIndex({
      config: {
        catalogPath: "invalid\0catalog",
        indexPath: "docs/test-evidence/index.json",
        schemaVersion: 2
      },
      mode: "check",
      workspaceRoot
    });

    assert.equal(result.status, "error");
    assert.ok(result.diagnostics.some((entry) => (
      entry.code === "config.path-inspection-failed"
      && entry.blocking
    )));
  } finally {
    await fs.rm(workspaceRoot, { force: true, recursive: true });
  }
});

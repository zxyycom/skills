import assert from "node:assert/strict";
import { syncTestEvidenceIndex } from "../src/cli.ts";

export async function runConfigPathTests(workspaceRoot: string): Promise<void> {
  const result = await syncTestEvidenceIndex({
    config: {
      catalogPath: "invalid\0catalog.md",
      indexPath: "docs/test-evidence/index.json",
      schemaVersion: 1
    },
    mode: "check",
    workspaceRoot
  });

  assert.equal(result.status, "error");
  assert.ok(result.diagnostics.some((entry) => (
    entry.code === "config.path-inspection-failed"
    && entry.blocking
  )));
}

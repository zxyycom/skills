import assert from "node:assert/strict";
import { syncVerificationEvidenceIndex } from "../src/cli.ts";

export async function runConfigPathTests(workspaceRoot: string): Promise<void> {
  const result = await syncVerificationEvidenceIndex({
    config: {
      catalogPath: "invalid\0catalog.md",
      indexPath: "docs/verification/index.json",
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

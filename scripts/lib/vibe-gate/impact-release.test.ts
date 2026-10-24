import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { baseGateCheckIds, prepareGateActivation } from "./impact.ts";

test("non-repository fallback selects all receipt-managed base checks", async () => {
  const nonRepository = await fs.mkdtemp(
    path.join(os.tmpdir(), "skills-gate-no-git-")
  );
  try {
    const fallback = await prepareGateActivation({
      cacheDirectory: path.join(nonRepository, ".log"),
      release: false,
      workspaceRoot: nonRepository
    });
    assert.equal(fallback.kind, "fallback");
    assert.match(fallback.fallbackDetail, /git ls-files/u);
    assert.equal(fallback.activeCheckIds.length, baseGateCheckIds.length);
  } finally {
    await fs.rm(nonRepository, { force: true, recursive: true });
  }
});

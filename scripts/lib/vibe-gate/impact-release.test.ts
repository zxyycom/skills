import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { baseGateCheckIds, prepareGateActivation } from "./impact.ts";
import { withImpactFixture } from "./impact-test-support.ts";

test("release activation and non-repository fallback execute the complete catalog", async () => {
  await withImpactFixture(async (fixture) => {
    const release = await prepareGateActivation({
      cacheDirectory: fixture.cacheDirectory,
      captureDependencies: fixture.captureDependencies,
      release: true,
      workspaceRoot: fixture.directory
    });
    assert.equal(release.kind, "release");
    assert.equal(release.activeCheckIds.length, 62);
    assert.ok(
      release.decisions.every(({ reason }) => reason === "release-full")
    );
  });

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

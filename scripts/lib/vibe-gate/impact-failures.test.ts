import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { baseGateCheckIds } from "./impact.ts";
import {
  captureFixtureCommand,
  prepareFixtureActivation,
  publishFixtureReceipts,
  publishInitialFixtureReceipts,
  withImpactFixture
} from "./impact-test-support.ts";

test("incremental Gate fingerprints environment and toolchain identity", async () => {
  await withImpactFixture(async (fixture) => {
    await publishInitialFixtureReceipts(fixture);
    const changedEnvironment = { GATE_FIXTURE: "changed", _: "first-parent" };
    const environmentChange = await prepareFixtureActivation(fixture, {
      ...fixture.captureDependencies,
      environment: changedEnvironment
    });
    assert.equal(
      environmentChange.activeCheckIds.length,
      baseGateCheckIds.length
    );
    assert.deepEqual(
      await publishFixtureReceipts(
        fixture,
        environmentChange,
        fixture.passedCheckIds,
        { ...fixture.captureDependencies, environment: changedEnvironment }
      ),
      { published: true, receiptCount: 59 }
    );
    const shellBookkeepingChange = await prepareFixtureActivation(fixture, {
      ...fixture.captureDependencies,
      environment: { ...changedEnvironment, _: "second-parent" }
    });
    assert.deepEqual(shellBookkeepingChange.activeCheckIds, []);

    const changedToolchain = await prepareFixtureActivation(fixture, {
      ...fixture.captureDependencies,
      async captureCommand(command, arguments_, cwd) {
        return command === "bun" && arguments_[0] === "--version"
          ? Buffer.from("different Bun version")
          : await captureFixtureCommand(command, arguments_, cwd);
      },
      environment: changedEnvironment
    });
    assert.equal(changedToolchain.kind, "incremental");
    assert.equal(
      changedToolchain.activeCheckIds.length,
      baseGateCheckIds.length
    );
  });
});

test("incremental Gate falls back when the toolchain snapshot is unavailable", async () => {
  await withImpactFixture(async (fixture) => {
    const unavailable = await prepareFixtureActivation(fixture, {
      ...fixture.captureDependencies,
      async captureCommand(command, arguments_, cwd) {
        if (command === "scc") throw new Error("scc probe failed");
        return await captureFixtureCommand(command, arguments_, cwd);
      }
    });
    assert.equal(unavailable.kind, "fallback");
    assert.match(unavailable.fallbackDetail, /scc probe failed/u);
    assert.equal(unavailable.activeCheckIds.length, baseGateCheckIds.length);
  });
});

test("incremental Gate rejects corrupt and failed receipts", async () => {
  await withImpactFixture(async (fixture) => {
    await fs.mkdir(fixture.cacheDirectory, { recursive: true });
    await fs.writeFile(
      path.join(fixture.cacheDirectory, "receipts.json"),
      '{"formatVersion":"corrupt"}\n'
    );
    const corrupt = await prepareFixtureActivation(fixture);
    assert.equal(corrupt.activeCheckIds.length, baseGateCheckIds.length);
    assert.ok(
      corrupt.decisions.every(({ reason }) => reason === "cache-invalid")
    );
    assert.deepEqual(
      await publishFixtureReceipts(fixture, corrupt, new Set()),
      { published: false, reason: "check-not-passed" }
    );
    const afterFailedRun = await prepareFixtureActivation(fixture);
    assert.ok(
      afterFailedRun.decisions.every(({ reason }) => reason === "cache-invalid")
    );
  });
});

test("incremental Gate rejects unavailable, drifting, and unwritable publication", async () => {
  await withImpactFixture(async (fixture) => {
    await publishInitialFixtureReceipts(fixture);
    const beforeDrift = await prepareFixtureActivation(fixture);
    const unavailableFinalSnapshot = await publishFixtureReceipts(
      fixture,
      beforeDrift,
      fixture.passedCheckIds,
      {
        ...fixture.captureDependencies,
        async captureCommand(command, arguments_, cwd) {
          if (command === "scc") throw new Error("final scc probe failed");
          return await captureFixtureCommand(command, arguments_, cwd);
        }
      }
    );
    assert.equal(unavailableFinalSnapshot.published, false);
    assert.equal(unavailableFinalSnapshot.reason, "snapshot-unavailable");
    assert.ok("detail" in unavailableFinalSnapshot);
    await fs.appendFile(
      path.join(fixture.directory, "docs", "README.md"),
      "drift\n"
    );
    assert.deepEqual(await publishFixtureReceipts(fixture, beforeDrift), {
      published: false,
      reason: "workspace-drift"
    });

    const cacheFile = path.join(fixture.directory, "not-a-directory");
    await fs.writeFile(cacheFile, "occupied\n");
    const cacheFixture = { ...fixture, cacheDirectory: cacheFile };
    const unavailableCache = await prepareFixtureActivation(cacheFixture);
    const unavailablePublication = await publishFixtureReceipts(
      cacheFixture,
      unavailableCache
    );
    assert.equal(unavailablePublication.published, false);
    assert.equal(unavailablePublication.reason, "publication-failed");
    assert.ok("detail" in unavailablePublication);
  });
});

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { baseGateCheckIds, prepareGateActivation } from "../../impact.ts";
import {
  captureFixtureCommand,
  prepareFixtureActivation,
  publishFixtureReceipts,
  withImpactFixture,
  writeImpactFixture
} from "../impact-test-support.ts";

test("incremental Gate refuses invalid Git paths and exhausted input budgets", async () => {
  await withImpactFixture(async (fixture) => {
    for (const output of [
      Buffer.from("../outside\0"),
      Buffer.from([255, 0]),
      Buffer.from(
        Array.from({ length: 20_001 }, (_, i) => `tools/file-${i}.ts`).join(
          "\0"
        )
      )
    ]) {
      const plan = await prepareFixtureActivation(fixture, {
        ...fixture.captureDependencies,
        async captureCommand(command, args, cwd) {
          return command === "git" && args[0] === "ls-files"
            ? output
            : await captureFixtureCommand(command, args, cwd);
        }
      });
      assert.equal(plan.kind, "fallback");
      assert.equal(plan.activeCheckIds.length, baseGateCheckIds.length);
      assert.deepEqual(await publishFixtureReceipts(fixture, plan), {
        published: false,
        reason: "not-incremental"
      });
    }
    const huge = "tools/change-plan/tests/oversized.fixture";
    await writeImpactFixture(fixture.directory, huge, "");
    await fs.truncate(path.join(fixture.directory, huge), 536_870_913);
    const exceeded = await prepareFixtureActivation(fixture);
    assert.equal(exceeded.kind, "fallback");
    assert.ok(
      exceeded.kind === "fallback" &&
        exceeded.fallbackDetail.includes("byte count")
    );
  });
});

test(
  "incremental Gate treats unreadable disk inputs as unavailable not stable identities",
  { skip: process.platform === "win32" || process.getuid?.() === 0 },
  async () => {
    await withImpactFixture(async (fixture) => {
      const input = "tools/change-plan/tests/unreadable.fixture";
      await writeImpactFixture(fixture.directory, input, "secret fixture");
      const target = path.join(fixture.directory, input);
      await fs.chmod(target, 0);
      try {
        const plan = await prepareFixtureActivation(fixture);
        assert.equal(plan.kind, "fallback");
        assert.ok(
          plan.kind === "fallback" &&
            /EACCES|permission/iu.test(plan.fallbackDetail)
        );
        assert.equal(plan.activeCheckIds.length, baseGateCheckIds.length);
      } finally {
        await fs.chmod(target, 0o600);
      }
    });
  }
);

test("release full execution does not acquire or publish project input proofs", async () => {
  await withImpactFixture(async (fixture) => {
    const plan = await prepareGateActivation({
      release: true,
      workspaceRoot: fixture.directory,
      captureDependencies: {
        async captureCommand() {
          throw new Error("release must not probe receipts");
        }
      }
    });
    assert.equal(plan.kind, "release");
    assert.equal(plan.snapshot, null);
    assert.equal(plan.activeCheckIds.length, 63);
    assert.deepEqual(await publishFixtureReceipts(fixture, plan), {
      published: false,
      reason: "not-incremental"
    });
  });
});

test("incremental Gate refuses reintroduced retired record SDK inputs", async () => {
  await withImpactFixture(async (fixture) => {
    for (const input of [
      "tools/decision-records/src/unreviewed.ts",
      "tools/investigation-report/tests/unreviewed.test.ts",
      "tools/record-operations/src/unreviewed.ts"
    ]) {
      await writeImpactFixture(fixture.directory, input, "export {};\n");
      const plan = await prepareFixtureActivation(fixture);
      assert.equal(plan.kind, "incremental", input);
      if (plan.kind === "incremental") {
        assert.ok(plan.snapshot.unclassifiedPaths.includes(input), input);
        assert.ok(
          plan.decisions.every(
            ({ reason }) => reason === "conservative-fallback"
          )
        );
        assert.equal(
          (await publishFixtureReceipts(fixture, plan)).published,
          false
        );
      }
    }
  });
});

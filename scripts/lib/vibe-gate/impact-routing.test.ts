import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { baseGateCheckIds, captureGateWorkspaceSnapshot } from "./impact.ts";
import {
  prepareFixtureActivation,
  publishFixtureReceipts,
  publishInitialFixtureReceipts,
  withImpactFixture,
  writeImpactFixture
} from "./impact-test-support.ts";

test("incremental Gate invalidates Novel Cards consumers for representative shared and distributed inputs", async () => {
  await withImpactFixture(async (fixture) => {
    for (const source of [
      "tools/index-runtime/src/value.ts",
      "tools/shared/src/node/filesystem.ts",
      "scripts/lib/generated-file.ts",
      "scripts/lib/source-runtime.ts",
      "scripts/lib/source-runtime-sync.ts",
      "scripts/lib/skill-runtime.ts",
      "scripts/lib/native-cli-entry.ts",
      "skills/novel-cards/scripts/novel-cards.ts",
      "skills/novel-cards/scripts/runtime/value.ts",
      "skills/novel-cards/package.json",
      "skills/novel-cards/pnpm-lock.yaml",
      "tools/novel-cards/tests/fixtures/input.log"
    ]) {
      await writeImpactFixture(fixture.directory, source, "initial input\n");
      assert.equal(
        (
          await publishFixtureReceipts(
            fixture,
            await prepareFixtureActivation(fixture)
          )
        ).published,
        true
      );
      const warm = await prepareFixtureActivation(fixture);
      for (const checkId of [
        "script:check:skill-updaters",
        "test:novel-cards:card-and-query-contract"
      ]) {
        assert.equal(
          warm.decisions.find((item) => item.checkId === checkId)?.action,
          "reuse",
          source
        );
      }
      await writeImpactFixture(fixture.directory, source, "changed input\n");
      const changed = await prepareFixtureActivation(fixture);
      for (const checkId of [
        "script:check:skill-updaters",
        "test:novel-cards:card-and-query-contract"
      ]) {
        assert.equal(
          changed.decisions.find((item) => item.checkId === checkId)?.action,
          checkId === "test:novel-cards:card-and-query-contract" &&
            source.startsWith("scripts/")
            ? "reuse"
            : "execute",
          `${source}: ${checkId}`
        );
      }
    }
  });
});

test("incremental Gate propagates documentation and shared owner changes", async () => {
  await withImpactFixture(async (fixture) => {
    await publishInitialFixtureReceipts(fixture);
    await writeImpactFixture(
      fixture.directory,
      "docs/README.md",
      "# Changed\n"
    );
    const documentationChange = await prepareFixtureActivation(fixture);
    assert.equal(
      documentationChange.decisions.find(
        ({ checkId }) => checkId === "test:change-plan:lifecycle-finalize"
      )?.action,
      "reuse"
    );
    assert.ok(!documentationChange.activeCheckIds.includes("script:validate"));
    await publishFixtureReceipts(fixture, documentationChange);
    await writeImpactFixture(
      fixture.directory,
      "tools/shared/src/node/filesystem.ts",
      "export const shared = 2;\n"
    );
    const sharedChange = await prepareFixtureActivation(fixture);
    assert.equal(sharedChange.activeCheckIds.length, baseGateCheckIds.length);
  });
});

test("incremental Gate propagates skill-package and build-system changes", async () => {
  await withImpactFixture(async (fixture) => {
    for (const input of [
      "tools/skill-package/src/value.ts",
      "scripts/lib/skill-runtime.ts",
      "scripts/build/mcpshell-workspace-bridge.ts",
      "tools/skill-updater/src/cli.ts"
    ]) {
      await publishFixtureReceipts(
        fixture,
        await prepareFixtureActivation(fixture)
      );
      await writeImpactFixture(fixture.directory, input, "changed input\n");
      const changed = await prepareFixtureActivation(fixture);
      assert.ok(
        changed.activeCheckIds.includes("script:check:skill-updaters"),
        input
      );
      assert.equal(
        changed.activeCheckIds.includes("test:change-plan:lifecycle-finalize"),
        !input.startsWith("scripts/"),
        input
      );
      assert.equal(
        changed.activeCheckIds.includes("script:test:index-runtime"),
        input.startsWith("tools/skill-package/"),
        input
      );
    }
    // The unified generation provider covers every skill and domain adapter, not just former eight providers.
    for (const input of [
      "skills/common-denominator-design/package.json",
      "tools/mcpshell-workspace-bridge/references/mcpshell-tools.yaml",
      "tools/novel-cards/src/index.ts"
    ]) {
      await publishFixtureReceipts(
        fixture,
        await prepareFixtureActivation(fixture)
      );
      await writeImpactFixture(fixture.directory, input, "changed material\n");
      assert.ok(
        (await prepareFixtureActivation(fixture)).activeCheckIds.includes(
          "script:check:skill-updaters"
        ),
        input
      );
    }
  });
});

test("incremental Gate treats unknown paths and root configuration conservatively", async () => {
  await withImpactFixture(async (fixture) => {
    await publishInitialFixtureReceipts(fixture);
    await writeImpactFixture(
      fixture.directory,
      "unknown-owner.bin",
      "unknown\n"
    );
    const unknown = await prepareFixtureActivation(fixture);
    assert.equal(unknown.activeCheckIds.length, baseGateCheckIds.length);
    assert.ok(
      unknown.decisions.every(({ fingerprint }) => fingerprint === null)
    );
    assert.deepEqual(await publishFixtureReceipts(fixture, unknown), {
      published: false,
      reason: "inputs-unclosed"
    });
    assert.equal(
      (await prepareFixtureActivation(fixture)).activeCheckIds.length,
      baseGateCheckIds.length
    );
    await fs.rm(path.join(fixture.directory, "unknown-owner.bin"));
    await writeImpactFixture(
      fixture.directory,
      "package.json",
      '{"private":false}\n'
    );
    assert.equal(
      (await prepareFixtureActivation(fixture)).activeCheckIds.length,
      baseGateCheckIds.length
    );
    await writeImpactFixture(
      fixture.directory,
      "tools/unreviewed-owner/input.ts",
      "export {};\n"
    );
    assert.ok(
      (await prepareFixtureActivation(fixture)).decisions.every(
        ({ fingerprint }) => fingerprint === null
      )
    );
  });
});

test("incremental Gate reruns the Gate test suite when a semantic aggregation entry changes", async () => {
  await withImpactFixture(async (fixture) => {
    await publishInitialFixtureReceipts(fixture);
    await writeImpactFixture(
      fixture.directory,
      "tools/task-graph/tests/run.ts",
      'await import("./schema-index.test.ts");\n'
    );
    const changed = await prepareFixtureActivation(fixture);
    assert.equal(
      changed.decisions.find(({ checkId }) => checkId === "script:test:check")
        ?.reason,
      "inputs-changed"
    );
    assert.equal(
      changed.decisions.find(
        ({ checkId }) => checkId === "test:change-plan:lifecycle-finalize"
      )?.action,
      "reuse"
    );
  });
});

test("incremental Gate includes ignored fixtures and TS/MTS disk inputs", async () => {
  await withImpactFixture(async (fixture) => {
    await writeImpactFixture(
      fixture.directory,
      ".gitignore",
      ".log/\n*.fixture\n*.mts\n"
    );
    for (const input of [
      "tools/change-plan/tests/input.fixture",
      "tools/change-plan/src/input.mts",
      "tools/change-plan/tests/fixtures/node_modules/value.ts"
    ]) {
      await writeImpactFixture(fixture.directory, input, "original\n");
      await publishFixtureReceipts(
        fixture,
        await prepareFixtureActivation(fixture)
      );
      const before = await captureGateWorkspaceSnapshot(
        fixture.directory,
        fixture.captureDependencies
      );
      assert.ok(before.files.some(({ path: filePath }) => filePath === input));
      await writeImpactFixture(fixture.directory, input, "changed\n");
      const changed = await prepareFixtureActivation(fixture);
      assert.equal(
        changed.activeCheckIds.includes("test:change-plan:lifecycle-finalize"),
        !input.startsWith("scripts/"),
        input
      );
      if (input.endsWith(".mts"))
        assert.ok(changed.activeCheckIds.includes("script:typecheck"));
    }
  });
});

test("incremental Gate proves content across dirty clean commits deletion and path reintroduction", async () => {
  await withImpactFixture(async (fixture) => {
    await publishInitialFixtureReceipts(fixture);
    const input = "tools/change-plan/src/value.ts";
    await writeImpactFixture(
      fixture.directory,
      input,
      "export const value = 2;\n"
    );
    const dirty = await prepareFixtureActivation(fixture);
    assert.ok(
      dirty.activeCheckIds.includes("test:change-plan:lifecycle-finalize")
    );
    await publishFixtureReceipts(fixture, dirty);
    for (const args of [
      ["add", "."],
      ["commit", "--quiet", "--message", "same content"]
    ]) {
      assert.equal(
        spawnSync("git", args, { cwd: fixture.directory }).status,
        0
      );
    }
    assert.deepEqual(
      (await prepareFixtureActivation(fixture)).activeCheckIds,
      []
    );
    await fs.rm(path.join(fixture.directory, input));
    const deleted = await prepareFixtureActivation(fixture);
    assert.ok(
      deleted.activeCheckIds.includes("test:change-plan:lifecycle-finalize")
    );
    assert.ok(
      deleted.kind === "incremental" &&
        deleted.snapshot.files.some(
          (file) => file.path === input && file.kind === "missing"
        )
    );
    await publishFixtureReceipts(fixture, deleted);
    await writeImpactFixture(
      fixture.directory,
      "tools/change-plan/src/renamed.ts",
      "export const value = 2;\n"
    );
    assert.ok(
      (await prepareFixtureActivation(fixture)).activeCheckIds.includes(
        "test:change-plan:lifecycle-finalize"
      )
    );
  });
});

test("incremental Gate refuses symlink proofs and escaping ancestor reads", async () => {
  await withImpactFixture(async (fixture) => {
    await publishInitialFixtureReceipts(fixture);
    const link = path.join(
      fixture.directory,
      "tools/change-plan/tests/link.ts"
    );
    await fs.mkdir(path.dirname(link), { recursive: true });
    await fs.symlink("../src/value.ts", link);
    const linked = await prepareFixtureActivation(fixture);
    assert.ok(
      linked.decisions.every(({ fingerprint }) => fingerprint === null)
    );
    assert.deepEqual(await publishFixtureReceipts(fixture, linked), {
      published: false,
      reason: "inputs-unclosed"
    });
    await fs.rm(link);
    await fs.rename(
      path.join(fixture.directory, "tools/change-plan/src"),
      path.join(fixture.directory, "tools/change-plan/source")
    );
    await fs.symlink(
      "source",
      path.join(fixture.directory, "tools/change-plan/src")
    );
    const ancestor = await prepareFixtureActivation(fixture);
    assert.equal(ancestor.kind, "fallback");
    assert.ok(
      ancestor.kind === "fallback" &&
        ancestor.fallbackDetail.includes("symlink")
    );
  });
});

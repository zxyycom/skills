import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { defineConfig, run } from "@zxyycom/vibe-check";
import { createVibeNativeChecks } from "./checks/native.ts";
import { noOutput } from "../../vibe-check-test-support.ts";
import {
  readReceiptManifest,
  writeReceiptManifest
} from "./impact-receipts.ts";
import {
  prepareFixtureActivation,
  publishFixtureReceipts,
  publishInitialFixtureReceipts,
  withImpactFixture,
  writeImpactFixture
} from "./impact-test-support.ts";

const markdownIgnoreRules = ".log/\nignored-root.markdown\nignored-extra/\n";

test("incremental Markdown proof requires its own complete successful receipt", async () => {
  await withImpactFixture(async (fixture) => {
    await publishInitialFixtureReceipts(fixture);
    const { manifest } = await readReceiptManifest(fixture.cacheDirectory);
    assert.ok(manifest);
    await writeReceiptManifest(
      fixture.cacheDirectory,
      manifest.receipts.filter(({ checkId }) => checkId !== "markdown-lint")
    );
    const missing = await prepareFixtureActivation(fixture);
    assert.deepEqual(missing.activeCheckIds, ["markdown-lint"]);
    assert.deepEqual(
      await publishFixtureReceipts(fixture, missing, new Set()),
      {
        published: false,
        reason: "check-not-passed"
      }
    );
    assert.equal(
      (await prepareFixtureActivation(fixture)).decisions.find(
        ({ checkId }) => checkId === "markdown-lint"
      )?.action,
      "execute"
    );
  });
});

test("incremental Markdown proof refuses publication after ignored source membership drift", async () => {
  await withImpactFixture(async (fixture) => {
    await writeImpactFixture(
      fixture.directory,
      ".gitignore",
      markdownIgnoreRules
    );
    await writeImpactFixture(
      fixture.directory,
      "ignored-root.markdown",
      "# Original\n"
    );
    await publishInitialFixtureReceipts(fixture);
    const before = await prepareFixtureActivation(fixture);
    const receipts = await fs.readFile(
      path.join(fixture.cacheDirectory, "receipts.json")
    );
    await fs.rm(path.join(fixture.directory, "ignored-root.markdown"));
    assert.deepEqual(await publishFixtureReceipts(fixture, before), {
      published: false,
      reason: "workspace-drift"
    });
    assert.deepEqual(
      await fs.readFile(path.join(fixture.cacheDirectory, "receipts.json")),
      receipts
    );
  });
});

test("incremental Markdown proof cannot publish a passed receipt for an empty native source set", async () => {
  await withImpactFixture(async (fixture) => {
    await fs.rm(path.join(fixture.directory, "docs/README.md"));
    const first = await prepareFixtureActivation(fixture);
    assert.ok(first.activeCheckIds.includes("markdown-lint"));
    const lint = createVibeNativeChecks(fixture.directory, {
      incremental: true
    }).find(({ checkId }) => checkId === "markdown-lint");
    assert.ok(lint);
    const result = await run(
      defineConfig({
        checks: [lint],
        scheduler: { resourceCapacities: { "repository-scan": 2 } }
      }),
      {
        projectRoot: fixture.directory,
        flags: ["gate-tool:markdown-content"],
        checkArtifactBaseDirectory: path.join(
          fixture.directory,
          ".log/check-artifacts"
        ),
        outputs: noOutput
      }
    );
    assert.equal(result.kind, "completed");
    assert.equal(result.snapshot.checks[0]?.outcome.status, "not-applicable");
    const passedCheckIds = new Set(fixture.passedCheckIds);
    passedCheckIds.delete("markdown-lint");
    assert.deepEqual(
      await publishFixtureReceipts(fixture, first, passedCheckIds),
      {
        published: false,
        reason: "check-not-passed"
      }
    );
  });
});

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  prepareFixtureActivation,
  publishFixtureReceipts,
  publishInitialFixtureReceipts,
  withImpactFixture,
  writeImpactFixture
} from "../impact-test-support.ts";

const markdownIgnoreRules = ".log/\nignored-root.markdown\nignored-extra/\n";

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

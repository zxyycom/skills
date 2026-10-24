import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { defineConfig } from "@zxyycom/vibe-check";
import { createVibeNativeChecks } from "./lib/vibe-gate.ts";
import {
  outcomeFor,
  runDefinition,
  withTemporaryDirectory
} from "./vibe-check-test-support.ts";

test("project Markdown links cover the bounded package catalog without dropping findings or overflow", async () => {
  await withTemporaryDirectory("gate-markdown-capacity-", async (directory) => {
    const check = createVibeNativeChecks(directory).find(
      ({ checkId }) => checkId === "markdown-link-validation"
    );
    assert.ok(check);
    const definition = defineConfig({ checks: [check] });
    const source = path.join(directory, "source.md");
    const reference = "[destination](target.md#destination)\n";
    await fs.writeFile(path.join(directory, "target.md"), "# Destination\n");
    await fs.writeFile(source, reference.repeat(4_096));
    const complete = outcomeFor(
      await runDefinition(definition, directory),
      "markdown-link-validation"
    );
    assert.equal(complete.status, "passed");
    assert.equal(
      complete.status === "passed" && complete.data.targetReadCount,
      4_096
    );

    await fs.writeFile(
      source,
      reference.repeat(4_095) + "[missing](missing.md)\n"
    );
    const broken = outcomeFor(
      await runDefinition(definition, directory),
      "markdown-link-validation"
    );
    assert.equal(broken.status, "failed");
    assert.equal(broken.status === "failed" && broken.data.findingCount, 1);

    await fs.writeFile(source, reference.repeat(4_097));
    const overflow = outcomeFor(
      await runDefinition(definition, directory),
      "markdown-link-validation"
    );
    assert.equal(overflow.status, "unavailable");
    assert.equal(
      overflow.status === "unavailable" && overflow.reason.code,
      "target-read-limit-exceeded"
    );
  });
});

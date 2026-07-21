import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import * as v from "valibot";
import { collectRegexTestEntries } from "../src/regex-collector.ts";
import { testEntryInventorySchema } from "../src/schemas.ts";

export async function runRegexCollectorTests(): Promise<void> {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), "regex-collector-"));
  try {
    await fs.writeFile(
      path.join(workspaceRoot, "value_test.go"),
      [
        "const sample = `",
        "func TestInsideRawString(t *testing.T) {}",
        "`",
        "func TestReal(t *testing.T) {}"
      ].join("\n"),
      "utf8"
    );
    const common = await collectRegexTestEntries({ workspaceRoot });
    assert.equal(common.entries.length, 2);
    assert.deepEqual(common.entries.map((entry) => entry.line), [2, 4]);
    assert.equal(v.safeParse(testEntryInventorySchema, common).success, true);

    await fs.writeFile(
      path.join(workspaceRoot, "scenario.spec"),
      [
        "# @test-evidence main WB-CUSTOM-SCENARIO-001",
        "CASE first",
        "SKIP second"
      ].join("\n"),
      "utf8"
    );
    await fs.mkdir(path.join(workspaceRoot, "node_modules"), { recursive: true });
    await fs.writeFile(
      path.join(workspaceRoot, "node_modules", "hidden.spec"),
      "CASE dependency\n",
      "utf8"
    );
    await fs.mkdir(path.join(workspaceRoot, "ignored"), { recursive: true });
    await fs.writeFile(
      path.join(workspaceRoot, "ignored", "hidden.spec"),
      "CASE excluded\n",
      "utf8"
    );
    const custom = await collectRegexTestEntries({
      config: {
        builtinDetectors: [],
        excludeGlobs: ["**/ignored/**"],
        includeGlobs: ["**/*.spec"],
        patterns: [{
          id: "project:scenario",
          includeGlobs: ["**/*.spec"],
          language: "scenario",
          pattern: "^CASE\\s+"
        }],
        schemaVersion: 1
      },
      workspaceRoot
    });
    assert.deepEqual(custom.diagnostics, []);
    assert.equal(custom.entries.length, 1);
    assert.equal(custom.entries[0]?.language, "scenario");
    assert.deepEqual(custom.entries[0]?.detectorIds, ["project:scenario"]);
    assert.equal(custom.markers[0]?.targetEntryId, custom.entries[0]?.id);

    await fs.writeFile(
      path.join(workspaceRoot, "capture.spec"),
      "path from \"node:path\"\n",
      "utf8"
    );
    const captured = await collectRegexTestEntries({
      config: {
        builtinDetectors: [],
        includeGlobs: ["capture.spec"],
        patterns: [{
          id: "project:capture",
          includeGlobs: ["capture.spec"],
          language: "scenario",
          offsetGroup: 1,
          pattern: "path from \"node:(path)\""
        }],
        schemaVersion: 1
      },
      workspaceRoot
    });
    assert.deepEqual(captured.diagnostics, []);
    assert.equal(captured.entries[0]?.offset, 16);
    assert.equal(captured.entries[0]?.column, 17);

    const reserved = await collectRegexTestEntries({
      config: {
        builtinDetectors: [],
        patterns: [{
          id: "builtin:future",
          includeGlobs: ["**/*.spec"],
          language: "scenario",
          pattern: "^CASE\\s+"
        }],
        schemaVersion: 1
      },
      workspaceRoot
    });
    assert.ok(reserved.diagnostics.some((diagnostic) =>
      diagnostic.code === "collector.detector-id-reserved"
    ));
    assert.deepEqual(reserved.entries, []);
  } finally {
    await fs.rm(workspaceRoot, { force: true, recursive: true });
  }
}

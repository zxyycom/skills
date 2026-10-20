import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { test } from "node:test";
import {
  buildStateIndexFromSnapshot,
  expectationOf,
  parseStateIndex,
  serializeStateIndex
} from "../../index-runtime/src/index.ts";
import { createInvestigationStateIndexDefinition } from "../src/investigation-index-definition.ts";
import { prepareInvestigationSources } from "../src/investigation-source-revision.ts";
import { parseInvestigationReport } from "../src/markdown.ts";
import { buildInvestigationReportState } from "../src/report-validation.ts";
import { investigationIndexFixture } from "./index-fixture.ts";
import { investigationIndexJsonSchema } from "../src/investigation-index-json-schema.ts";
import {
  queryInvestigationIndex,
  showInvestigationReport
} from "../src/query.ts";
import {} from "../src/report-path.ts";
import { synchronizeInvestigationIndex } from "../src/validation.ts";
import {
  reportMarkdown,
  jsonObjectMember,
  parseJsonObject,
  withTempRoot,
  writeCollection
} from "./v6-support.ts";

test("index and show resolve a report ID independently from its semantic sourcePath", async () => {
  await withTempRoot("semantic-source-path", async (root) => {
    await writeCollection(root, [
      { id: "stable-report", sourcePath: "semantic-finding.md" }
    ]);
    const result = await queryInvestigationIndex({ workspaceRoot: root });
    assert.deepEqual(
      result.entries.map((entry) => entry.id),
      ["stable-report"]
    );
    assert.equal(result.entries[0]?.state.sourcePath, "semantic-finding.md");
    const shown = await showInvestigationReport({
      id: "stable-report",
      workspaceRoot: root
    });
    assert.equal(shown.status, "ok");
    assert.match(shown.markdown ?? "", /^id: "stable-report"$/mu);
    await fs.rename(
      `${root}/docs/investigations/semantic-finding.md`,
      `${root}/docs/investigations/renamed-finding.md`
    );
    const stale = await showInvestigationReport({
      id: "stable-report",
      workspaceRoot: root
    });
    assert.equal(stale.status, "error");
    assert.deepEqual(
      (await synchronizeInvestigationIndex({ workspaceRoot: root })).errors,
      []
    );
    const refreshed = await queryInvestigationIndex({ workspaceRoot: root });
    assert.equal(refreshed.entries[0]?.state.sourcePath, "renamed-finding.md");
  });
});

test("index state projects strict empty metadata and sourcePath", () => {
  const source = {
    id: "report",
    sourcePath: "report.md",
    text: reportMarkdown({ id: "report" })
  };
  const prepared = prepareInvestigationSources([source]);
  const projected = buildInvestigationReportState(
    source.id,
    parseInvestigationReport(source.text, source.id),
    source.sourcePath
  );
  if (projected.status !== "valid") assert.fail(projected.errors.join("\n"));
  const definition = createInvestigationStateIndexDefinition();
  const built = buildStateIndexFromSnapshot(definition, {
    metadata: prepared.metadata,
    sourceRevision: prepared.revision,
    states: { report: projected.state }
  });
  assert.equal(built.status, "ok");
  if (built.status !== "ok")
    assert.fail("domain projection must build an index");
  const index = parseJsonObject(serializeStateIndex(built.value, definition));
  assert.deepEqual(index["metadata"], {});
  const entries = jsonObjectMember(index, "entries");
  const report = jsonObjectMember(entries, "report");
  assert.equal(report["sourcePath"], "report.md");
  assert.equal("state" in report, false);
  assert.equal("keys" in report, false);
  assert.equal("keyDefinitions" in index, false);
  assert.equal(index["schemaVersion"], 4);
  assert.deepEqual(investigationIndexJsonSchema.$defs.sourcePath, {
    pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*\\.md$",
    type: "string"
  });
  assert.equal(
    investigationIndexJsonSchema.$defs.state.properties.sourcePath.$ref,
    "#/$defs/sourcePath"
  );
  assert.ok(
    investigationIndexJsonSchema.$defs.state.required.includes("sourcePath")
  );
  assert.deepEqual(
    investigationIndexJsonSchema.$defs.relation.properties.summary,
    {
      maxLength: 40,
      minLength: 1,
      pattern: "^(?!\\s)(?!.*[\\r\\n])[\\s\\S]*\\S$",
      type: "string"
    }
  );
  assert.deepEqual(investigationIndexJsonSchema.$defs.relation.required, [
    "type",
    "target"
  ]);
});

test("index rejects legacy definitions", () => {
  const definition = createInvestigationStateIndexDefinition();
  const index = parseJsonObject(
    serializeStateIndex(
      investigationIndexFixture([{ id: "report" }]),
      definition
    )
  );
  index["definitionVersion"] = 5;
  const result = parseStateIndex({
    definition,
    expectation: expectationOf(definition),
    text: JSON.stringify(index),
    sourcePath: "investigation-index.json"
  });
  assert.equal(result.status, "error");
  assert.ok(
    result.diagnostics.some((item) => /definition/u.test(item.message))
  );
});

test("index rejects additional metadata", () => {
  const definition = createInvestigationStateIndexDefinition();
  const index = parseJsonObject(
    serializeStateIndex(
      investigationIndexFixture([{ id: "report" }]),
      definition
    )
  );
  jsonObjectMember(index, "metadata")["legacy"] = true;
  const result = parseStateIndex({
    definition,
    expectation: expectationOf(definition),
    text: JSON.stringify(index),
    sourcePath: "investigation-index.json"
  });
  assert.equal(result.status, "error");
  assert.ok(result.diagnostics.some((item) => /metadata/u.test(item.message)));
});

test("list serves the published snapshot without reading unreadable sources", async () => {
  await withTempRoot("stale", async (root) => {
    await writeCollection(root, [{ id: "report" }]);
    await fs.writeFile(
      `${root}/docs/investigations/report.md`,
      "changed",
      "utf8"
    );
    const result = await queryInvestigationIndex({ workspaceRoot: root });
    assert.deepEqual(result.errors, []);
    assert.deepEqual(
      result.entries.map((entry) => entry.id),
      ["report"]
    );
    assert.deepEqual(result.warnings, []);
  });
});

test("source revisions fingerprint report Markdown", async () => {
  await withTempRoot("revision", async (root) => {
    await writeCollection(root, [{ id: "report" }]);
    const indexPath = `${root}/docs/investigations/investigation-index.json`;
    const before = parseJsonObject(await fs.readFile(indexPath, "utf8"));
    await fs.appendFile(`${root}/docs/investigations/report.md`, "\n", "utf8");
    const drifted = await queryInvestigationIndex({ workspaceRoot: root });
    assert.deepEqual(drifted.errors, []);
    assert.deepEqual(drifted.warnings, []);
    assert.deepEqual(
      (await synchronizeInvestigationIndex({ workspaceRoot: root })).errors,
      []
    );
    const after = parseJsonObject(await fs.readFile(indexPath, "utf8"));
    assert.notDeepEqual(after["sourceRevision"], before["sourceRevision"]);
  });
});

test("full synchronization rejects an empty report collection", async () => {
  await withTempRoot("empty", async (root) => {
    const investigations = `${root}/docs/investigations`;
    await fs.mkdir(investigations, { recursive: true });
    const indexPath = `${investigations}/investigation-index.json`;
    const result = await synchronizeInvestigationIndex({ workspaceRoot: root });
    assert.ok(
      result.errors.some((error) => error.includes("at least one report"))
    );
    await assert.rejects(fs.access(indexPath));
  });
});

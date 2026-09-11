import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { test } from "node:test";
import { investigationIndexJsonSchema } from "../src/investigation-index-json-schema.ts";
import {
  queryInvestigationIndex,
  showInvestigationReport
} from "../src/query.ts";
import {} from "../src/report-path.ts";
import { synchronizeInvestigationIndex } from "../src/validation.ts";
import {
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

test("index state projects strict empty metadata and sourcePath", async () => {
  await withTempRoot("metadata", async (root) => {
    await writeCollection(root, [{ id: "report" }]);
    const index = parseJsonObject(
      await fs.readFile(
        `${root}/docs/investigations/investigation-index.json`,
        "utf8"
      )
    );
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
});

test("index rejects legacy definitions", async () => {
  await withTempRoot("legacy-definition", async (root) => {
    await writeCollection(root, [{ id: "report" }]);
    const file = `${root}/docs/investigations/investigation-index.json`;
    const index = parseJsonObject(await fs.readFile(file, "utf8"));
    index["definitionVersion"] = 5;
    await fs.writeFile(file, `${JSON.stringify(index)}\n`, "utf8");
    const result = await queryInvestigationIndex({ workspaceRoot: root });
    assert.ok(result.errors.some((error) => error.includes("definition")));
  });
});

test("index rejects additional metadata", async () => {
  await withTempRoot("additional-metadata", async (root) => {
    await writeCollection(root, [{ id: "report" }]);
    const file = `${root}/docs/investigations/investigation-index.json`;
    const index = parseJsonObject(await fs.readFile(file, "utf8"));
    jsonObjectMember(index, "metadata")["legacy"] = true;
    await fs.writeFile(file, `${JSON.stringify(index)}\n`, "utf8");
    const result = await queryInvestigationIndex({ workspaceRoot: root });
    assert.ok(result.errors.some((error) => error.includes("metadata")));
  });
});

test("index loading rejects stale report projections", async () => {
  await withTempRoot("stale", async (root) => {
    await writeCollection(root, [{ id: "report" }]);
    await fs.writeFile(
      `${root}/docs/investigations/report.md`,
      "changed",
      "utf8"
    );
    const result = await queryInvestigationIndex({ workspaceRoot: root });
    assert.ok(
      result.errors.some(
        (error) => error.includes("source") || error.includes("index")
      )
    );
  });
});

test("source revisions fingerprint report Markdown", async () => {
  await withTempRoot("revision", async (root) => {
    await writeCollection(root, [{ id: "report" }]);
    const indexPath = `${root}/docs/investigations/investigation-index.json`;
    const before = parseJsonObject(await fs.readFile(indexPath, "utf8"));
    await fs.appendFile(`${root}/docs/investigations/report.md`, "\n", "utf8");
    assert.ok(
      (await queryInvestigationIndex({ workspaceRoot: root })).errors.length > 0
    );
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

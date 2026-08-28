import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { test } from "node:test";
import {
  queryInvestigationIndex,
  showInvestigationReport,
  traceInvestigationReports
} from "../src/query.ts";
import { synchronizeInvestigationIndex } from "../src/validation.ts";
import {
  jsonObjectMember,
  parseJsonObject,
  withTempRoot,
  writeCollection
} from "./v6-support.ts";

test("list uses Investigation ID ordering and repeated tag filters use AND", async () => {
  await withTempRoot("tags", async (root) => {
    await writeCollection(root, [
      { id: "zulu-report.md", tags: ["alpha", "shared"] },
      { id: "alpha-report.md", tags: ["alpha", "shared"] },
      { id: "shared-report.md", tags: ["shared"] }
    ]);
    const result = await queryInvestigationIndex({
      tags: ["shared", "alpha"],
      workspaceRoot: root
    });
    assert.deepEqual(
      result.entries.map((entry) => entry.id),
      ["alpha-report.md", "zulu-report.md"]
    );
  });
});

test("list filters reports at an inclusive formedAt range", async () => {
  await withTempRoot("formed-at", async (root) => {
    await writeCollection(root, [
      { formedAt: "2026-08-28T09:59:59+00:00", id: "before.md" },
      { formedAt: "2026-08-28T10:00:00+00:00", id: "start.md" },
      { formedAt: "2026-08-28T11:00:00+00:00", id: "end.md" },
      { formedAt: "2026-08-28T11:00:01+00:00", id: "after.md" }
    ]);
    const result = await queryInvestigationIndex({
      formedAtFrom: "2026-08-28T10:00:00+00:00",
      formedAtTo: "2026-08-28T11:00:00+00:00",
      workspaceRoot: root
    });
    assert.deepEqual(
      result.entries.map((entry) => entry.id),
      ["end.md", "start.md"]
    );
  });
});

test("list filters reports by direct relation type", async () => {
  await withTempRoot("relation-type", async (root) => {
    await writeCollection(root, [
      { id: "base.md" },
      {
        id: "supplement.md",
        relations: [{ target: "base.md", type: "补充" }]
      },
      { id: "independent.md" }
    ]);
    const result = await queryInvestigationIndex({
      relationType: "补充",
      workspaceRoot: root
    });
    assert.deepEqual(
      result.entries.map((entry) => entry.id),
      ["supplement.md"]
    );
  });
});

test("list filters report title and question text", async () => {
  await withTempRoot("text", async (root) => {
    await writeCollection(root, [
      { id: "title.md", question: "unrelated", title: "Alpha subject" },
      { id: "question.md", question: "Alpha question", title: "Other" },
      { id: "other.md", question: "Other question", title: "Other" }
    ]);
    const result = await queryInvestigationIndex({
      text: "alpha",
      workspaceRoot: root
    });
    assert.deepEqual(
      result.entries.map((entry) => entry.id),
      ["question.md", "title.md"]
    );
  });
});

test("show and trace resolve reports by investigation id", async () => {
  await withTempRoot("show-trace", async (root) => {
    await writeCollection(root, [
      { id: "first-report.md" },
      {
        id: "second-report.md",
        relations: [{ target: "first-report.md", type: "补充" }]
      }
    ]);
    const shown = await showInvestigationReport({
      id: "second-report.md",
      workspaceRoot: root
    });
    assert.equal(shown.status, "ok");
    assert.match(shown.markdown ?? "", /^---/u);
    const trace = await traceInvestigationReports({
      direction: "successors",
      id: "first-report.md",
      workspaceRoot: root
    });
    assert.equal(trace.status, "ok");
    assert.deepEqual(trace.reportIds, ["first-report.md", "second-report.md"]);
    assert.equal(
      (
        await showInvestigationReport({
          id: "./second-report.md",
          workspaceRoot: root
        })
      ).status,
      "error"
    );
    assert.equal(
      (
        await traceInvestigationReports({
          id: " second-report.md ",
          workspaceRoot: root
        })
      ).status,
      "error"
    );
  });
});

test("index state projects strict empty metadata and no sourcePath", async () => {
  await withTempRoot("metadata", async (root) => {
    await writeCollection(root, [{ id: "report.md" }]);
    const index = parseJsonObject(
      await fs.readFile(
        `${root}/docs/investigations/investigation-index.json`,
        "utf8"
      )
    );
    assert.deepEqual(index["metadata"], {});
    const entries = jsonObjectMember(index, "entries");
    const report = jsonObjectMember(entries, "report.md");
    assert.equal("sourcePath" in jsonObjectMember(report, "state"), false);
  });
});

test("index rejects legacy definitions", async () => {
  await withTempRoot("legacy-definition", async (root) => {
    await writeCollection(root, [{ id: "report.md" }]);
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
    await writeCollection(root, [{ id: "report.md" }]);
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
    await writeCollection(root, [{ id: "report.md" }]);
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
    await writeCollection(root, [{ id: "report.md" }]);
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

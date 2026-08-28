import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { test } from "node:test";
import {
  queryInvestigationIndex,
  showInvestigationReport,
  traceInvestigationReports
} from "../src/query.ts";
import { withTempRoot, writeCollection } from "./v6-support.ts";

test("list uses Investigation ID ordering and repeated tag filters use AND", async () => {
  await withTempRoot("tags", async (root) => {
    await writeCollection(root, [
      { id: "zulu-report.md", tags: ["shared", "zulu"] },
      { id: "alpha-report.md", tags: ["alpha", "shared"] }
    ]);
    const result = await queryInvestigationIndex({
      tags: ["shared", "alpha"],
      workspaceRoot: root
    });
    assert.deepEqual(
      result.entries.map((entry) => entry.id),
      ["alpha-report.md"]
    );
  });
});

test("list filters formedAt relation type and title question text", async () => {
  await withTempRoot("query", async (root) => {
    await writeCollection(root, [
      {
        formedAt: "2026-08-28T10:00:00+00:00",
        id: "first-report.md",
        tags: ["shared"],
        title: "Alpha"
      },
      {
        formedAt: "2026-08-28T11:00:00+00:00",
        id: "second-report.md",
        relations: [{ target: "first-report.md", type: "补充" }],
        tags: ["shared"],
        title: "Beta"
      }
    ]);
    const result = await queryInvestigationIndex({
      formedAtFrom: "2026-08-28T10:30:00+00:00",
      relationType: "补充",
      text: "beta",
      workspaceRoot: root
    });
    assert.deepEqual(
      result.entries.map((entry) => entry.id),
      ["second-report.md"]
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
    const index = JSON.parse(
      await fs.readFile(
        `${root}/docs/investigations/investigation-index.json`,
        "utf8"
      )
    ) as {
      metadata: unknown;
      entries: Record<string, { state: Record<string, unknown> }>;
    };
    assert.deepEqual(index.metadata, {});
    assert.equal("sourcePath" in index.entries["report.md"]!.state, false);
  });
});

test("index rejects legacy definitions and additional metadata", async () => {
  await withTempRoot("legacy-index", async (root) => {
    await writeCollection(root, [{ id: "report.md" }]);
    const file = `${root}/docs/investigations/investigation-index.json`;
    const index = JSON.parse(await fs.readFile(file, "utf8")) as {
      definitionVersion: number;
      metadata: Record<string, unknown>;
    };
    index.definitionVersion = 5;
    index.metadata.legacy = true;
    await fs.writeFile(file, `${JSON.stringify(index)}\n`, "utf8");
    const result = await queryInvestigationIndex({ workspaceRoot: root });
    assert.ok(result.errors.length > 0);
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

test("source revisions fingerprint report Markdown and strict empty metadata only", async () => {
  await withTempRoot("revision", async (root) => {
    await writeCollection(root, [{ id: "report.md" }]);
    const index = JSON.parse(
      await fs.readFile(
        `${root}/docs/investigations/investigation-index.json`,
        "utf8"
      )
    ) as { sourceRevision: unknown };
    assert.ok(index.sourceRevision !== null);
  });
});

test("full synchronization rejects an empty report collection", async () => {
  await withTempRoot("empty", async (root) => {
    await fs.writeFile(`${root}/placeholder`, "x", "utf8");
    const result = await queryInvestigationIndex({ workspaceRoot: root });
    assert.ok(result.errors.length > 0);
  });
});

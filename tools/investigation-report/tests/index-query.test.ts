import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { test } from "node:test";
import { investigationIndexJsonSchema } from "../src/investigation-index-json-schema.ts";
import {
  queryInvestigationIndex,
  searchInvestigationReports,
  showInvestigationReport,
  traceInvestigationReports
} from "../src/query.ts";
import {
  normalizeInvestigationSelectorInput,
  parseDatedInvestigationId
} from "../src/report-path.ts";
import { synchronizeInvestigationIndex } from "../src/validation.ts";
import {
  jsonObjectMember,
  parseJsonObject,
  reportMarkdown,
  withTempRoot,
  writeCollection
} from "./v6-support.ts";

test("list uses Investigation ID ordering and repeated tag filters use AND", async () => {
  await withTempRoot("tags", async (root) => {
    await writeCollection(root, [
      { id: "zulu-report", tags: ["alpha", "shared"] },
      { id: "alpha-report", tags: ["alpha", "shared"] },
      { id: "shared-report", tags: ["shared"] }
    ]);
    const result = await queryInvestigationIndex({
      tags: ["shared", "alpha"],
      workspaceRoot: root
    });
    assert.deepEqual(
      result.entries.map((entry) => entry.id),
      ["alpha-report", "zulu-report"]
    );
  });
});

test("list filters reports at an inclusive formedAt range", async () => {
  await withTempRoot("formed-at", async (root) => {
    await writeCollection(root, [
      { formedAt: "2026-08-28T09:59:59+00:00", id: "before" },
      { formedAt: "2026-08-28T10:00:00+00:00", id: "start" },
      { formedAt: "2026-08-28T11:00:00+00:00", id: "end" },
      { formedAt: "2026-08-28T11:00:01+00:00", id: "after" }
    ]);
    const result = await queryInvestigationIndex({
      formedAtFrom: "2026-08-28T10:00:00+00:00",
      formedAtTo: "2026-08-28T11:00:00+00:00",
      workspaceRoot: root
    });
    assert.deepEqual(
      result.entries.map((entry) => entry.id),
      ["end", "start"]
    );
  });
});

test("list filters reports by direct relation type", async () => {
  await withTempRoot("relation-type", async (root) => {
    await writeCollection(root, [
      { id: "base" },
      {
        id: "supplement",
        relations: [{ target: "base", type: "补充" }]
      },
      { id: "independent" }
    ]);
    const result = await queryInvestigationIndex({
      relationType: "补充",
      workspaceRoot: root
    });
    assert.deepEqual(
      result.entries.map((entry) => entry.id),
      ["supplement"]
    );
  });
});

test("search finds formal Markdown with all, any, phrase, and structural filters", async () => {
  await withTempRoot("search", async (root) => {
    await writeCollection(root, [
      { id: "base", formedAt: "2026-08-28T10:00:00+00:00" },
      {
        id: "supplement",
        formedAt: "2026-08-28T12:00:00+00:00",
        relations: [{ target: "base", type: "补充" }],
        tags: ["alpha", "investigation-report"],
        title: "Alpha phrase title"
      },
      { id: "other", tags: ["other"] }
    ]);
    const all = await searchInvestigationReports({
      query: "Alpha 当前",
      workspaceRoot: root
    });
    assert.deepEqual(
      all.entries.map((entry) => entry.id),
      ["supplement"]
    );
    assert.equal(all.entries[0]?.sourcePath, "supplement.md");
    assert.ok((all.entries[0]?.previews.length ?? 0) > 0);
    const phrase = await searchInvestigationReports({
      match: "phrase",
      query: "Alpha phrase title",
      workspaceRoot: root
    });
    assert.deepEqual(
      phrase.entries.map((entry) => entry.id),
      ["supplement"]
    );
    const any = await searchInvestigationReports({
      match: "any",
      query: "absent Alpha",
      tags: ["alpha"],
      formedAtFrom: "2026-08-28T11:00:00+00:00",
      formedAtTo: "2026-08-28T12:00:00+00:00",
      relationType: "补充",
      workspaceRoot: root
    });
    assert.deepEqual(
      any.entries.map((entry) => entry.id),
      ["supplement"]
    );
  });
});

test("search excludes candidates, resources, and index bytes and falls back read-only", async () => {
  await withTempRoot("search-fallback", async (root) => {
    await writeCollection(root, [{ id: "formal" }]);
    const directory = `${root}/docs/investigations`;
    await fs.writeFile(
      `${directory}/_candidate.candidate`,
      reportMarkdown({ id: "candidate" }).replace(
        "已形成结果，仍保留适用条件和未知。",
        "candidate-only-term"
      ),
      "utf8"
    );
    await fs.mkdir(`${directory}/_resources/formal`, { recursive: true });
    await fs.writeFile(
      `${directory}/_resources/formal/evidence.txt`,
      "resource-only-term",
      "utf8"
    );
    assert.deepEqual(
      (
        await searchInvestigationReports({
          query: "candidate-only-term",
          workspaceRoot: root
        })
      ).entries,
      []
    );
    assert.deepEqual(
      (
        await searchInvestigationReports({
          query: "resource-only-term",
          workspaceRoot: root
        })
      ).entries,
      []
    );
    const indexPath = `${directory}/investigation-index.json`;
    await fs.rm(indexPath);
    const fallback = await searchInvestigationReports({
      query: "当前",
      workspaceRoot: root
    });
    assert.equal(fallback.status, "ok");
    assert.deepEqual(
      fallback.entries.map((entry) => entry.id),
      ["formal"]
    );
    assert.equal(fallback.warnings.length, 1);
    await assert.rejects(fs.access(indexPath));
  });
});

test("show and trace resolve reports by investigation id", async () => {
  await withTempRoot("show-trace", async (root) => {
    await writeCollection(root, [
      { id: "first-report" },
      {
        id: "second-report",
        relations: [
          { type: "补充", target: "first-report", summary: "补充可见依据" }
        ]
      }
    ]);
    const shown = await showInvestigationReport({
      id: "second-report",
      workspaceRoot: root
    });
    assert.equal(shown.status, "ok");
    assert.match(shown.markdown ?? "", /^---/u);
    assert.match(shown.markdown ?? "", /summary: "补充可见依据"/u);
    assert.deepEqual(shown.state?.relations, [
      { type: "补充", target: "first-report", summary: "补充可见依据" }
    ]);
    const trace = await traceInvestigationReports({
      direction: "successors",
      id: "first-report",
      workspaceRoot: root
    });
    assert.equal(trace.status, "ok");
    assert.deepEqual(trace.reportIds, ["first-report", "second-report"]);
    assert.deepEqual(trace.edges, [
      {
        source: "second-report",
        target: "first-report",
        type: "补充",
        summary: "补充可见依据"
      }
    ]);
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

test("ordinary Investigation selectors use the standard ID parser before name lookup", async () => {
  await withTempRoot("dated-selectors", async (root) => {
    const firstId = "260901-shared-topic";
    const secondId = "260902-shared-topic";
    const uniqueId = "260903-unique-topic";
    await writeCollection(root, [
      {
        formedAt: "2026-09-01T12:00:00+00:00",
        id: firstId,
        sourcePath: "first-semantic-name.md"
      },
      {
        formedAt: "2026-09-02T12:00:00+00:00",
        id: secondId,
        sourcePath: "second-semantic-name.md"
      },
      {
        formedAt: "2026-09-03T12:00:00+00:00",
        id: uniqueId,
        sourcePath: "unique-semantic-name.md"
      },
      { id: "991332-invalid-date", sourcePath: "invalid-date-name.md" }
    ]);

    const unique = await showInvestigationReport({
      id: "unique-topic.MD",
      workspaceRoot: root
    });
    assert.equal(unique.status, "ok");
    assert.equal(unique.id, uniqueId);
    const exact = await showInvestigationReport({
      id: `${firstId}.md`,
      workspaceRoot: root
    });
    assert.equal(exact.status, "ok");
    assert.equal(exact.id, firstId);
    const ambiguous = await showInvestigationReport({
      id: "shared-topic",
      workspaceRoot: root
    });
    assert.equal(ambiguous.status, "error");
    assert.match(
      ambiguous.errors.join("\n"),
      new RegExp(`${firstId}, ${secondId}`)
    );
    const invalidDateName = await showInvestigationReport({
      id: "991332-invalid-date",
      workspaceRoot: root
    });
    assert.equal(invalidDateName.status, "ok");
    const missingExact = await showInvestigationReport({
      id: "260904-shared-topic",
      workspaceRoot: root
    });
    assert.equal(missingExact.status, "error");
    assert.match(missingExact.errors.join("\n"), /does not exist/);
    assert.equal(normalizeInvestigationSelectorInput("topic.MD"), "topic");
    assert.equal(
      normalizeInvestigationSelectorInput("topic.md.md"),
      "topic.md"
    );
    assert.equal(parseDatedInvestigationId("991332-topic"), null);
    assert.equal(parseDatedInvestigationId("nested/topic"), null);
  });
});

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
    assert.equal(jsonObjectMember(report, "state")["sourcePath"], "report.md");
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

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
  runInvestigationCli,
  withTempRoot,
  writeCollection
} from "./v6-support.ts";

test("list uses recent formedAt ordering with an ID tie-break and repeated tag filters use AND", async () => {
  await withTempRoot("tags", async (root) => {
    await writeCollection(root, [
      {
        formedAt: "2026-08-28T13:00:00+00:00",
        id: "newest-report",
        tags: ["alpha", "shared"]
      },
      {
        formedAt: "2026-08-28T12:00:00+00:00",
        id: "zulu-report",
        tags: ["alpha", "shared"]
      },
      {
        formedAt: "2026-08-28T12:00:00+00:00",
        id: "alpha-report",
        tags: ["alpha", "shared"]
      },
      { id: "shared-report", tags: ["shared"] }
    ]);
    const result = await queryInvestigationIndex({
      tags: ["shared", "alpha"],
      workspaceRoot: root
    });
    assert.deepEqual(
      result.entries.map((entry) => entry.id),
      ["newest-report", "alpha-report", "zulu-report"]
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

test("list returns snapshot facets and renders bounded compact or detailed recent windows", async () => {
  await withTempRoot("list-facets-output", async (root) => {
    await writeCollection(
      root,
      Array.from({ length: 32 }, (_, index) => ({
        formedAt: new Date(Date.UTC(2024, index, 15, 12))
          .toISOString()
          .replace(".000Z", "+00:00"),
        id: `report-${String(index + 1).padStart(2, "0")}`,
        tags: ["shared", `topic-${String(index + 1).padStart(2, "0")}`],
        title: `报告 ${index + 1}`
      }))
    );
    const indexPath = `${root}/docs/investigations/investigation-index.json`;
    const before = await fs.readFile(indexPath, "utf8");

    const queried = await queryInvestigationIndex({ workspaceRoot: root });
    assert.equal(queried.errors.length, 0);
    assert.equal(queried.total, 32);
    assert.equal(queried.limit, 10);
    assert.deepEqual(
      queried.entries.map((entry) => entry.id),
      Array.from(
        { length: 10 },
        (_, index) => `report-${String(32 - index).padStart(2, "0")}`
      )
    );
    assert.equal(queried.facets?.recordCount, 32);
    assert.equal(queried.facets?.tags.length, 33);
    assert.equal(queried.facets?.formedAt.months.length, 32);

    const compact = await runInvestigationCli(root, ["list"]);
    assert.equal(compact.status, 0, compact.stderr);
    assert.match(compact.stdout, /^Index filters \(32 records\):/u);
    assert.match(
      compact.stdout,
      /tags: shared=32[\s\S]*topic-29=1; \+3 more tags/u
    );
    assert.doesNotMatch(compact.stdout, /topic-30=1/u);
    assert.match(
      compact.stdout,
      /months \(UTC\):[\s\S]*2025-11=1; \+22 more months/u
    );
    assert.doesNotMatch(compact.stdout, /2025-10=1/u);
    assert.equal(
      compact.stdout.split("\n").filter((line) => line.startsWith("- report-"))
        .length,
      10
    );
    assert.doesNotMatch(compact.stdout, /^  title:/mu);
    assert.match(
      compact.stdout,
      /Showing 10 of 32 matches \(offset 0, limit 10\); 22 remaining; next offset 10\./u
    );

    const detailed = await runInvestigationCli(root, [
      "list",
      "--detail",
      "--limit",
      "1"
    ]);
    assert.equal(detailed.status, 0, detailed.stderr);
    assert.match(detailed.stdout, /topic-01=1/u);
    assert.match(detailed.stdout, /2026-01=1/u);
    assert.match(detailed.stdout, /Latest matches:\nreport-32 /u);
    assert.match(detailed.stdout, /^  title: 报告 32$/mu);
    assert.match(detailed.stdout, /^  question: 当前问题是什么？$/mu);

    const outOfRange = await runInvestigationCli(root, [
      "list",
      "--offset",
      "99"
    ]);
    assert.equal(outOfRange.status, 0, outOfRange.stderr);
    assert.match(outOfRange.stdout, /^Index filters \(32 records\):/u);
    assert.match(outOfRange.stdout, /Latest matches:\n- none/u);
    assert.match(
      outOfRange.stdout,
      /Showing 0 of 32 matches \(offset 99, limit 10\); 0 remaining\./u
    );
    assert.equal(await fs.readFile(indexPath, "utf8"), before);
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

test("list and search combine direct relation selectors with existing query boundaries", async () => {
  await withTempRoot("related-query", async (root) => {
    await writeCollection(root, [
      {
        formedAt: "2026-08-28T09:00:00+00:00",
        id: "other",
        title: "other relation needle"
      },
      {
        formedAt: "2026-08-28T10:00:00+00:00",
        id: "predecessor",
        tags: ["alpha", "investigation-report"],
        title: "predecessor relation needle"
      },
      {
        formedAt: "2026-08-28T11:00:00+00:00",
        id: "center",
        relations: [{ target: "predecessor", type: "补充" }]
      },
      {
        formedAt: "2026-08-28T12:00:00+00:00",
        id: "successor",
        relations: [{ target: "center", type: "补充" }],
        tags: ["alpha", "beta", "investigation-report"],
        title: "successor relation needle"
      }
    ]);

    const listHelp = await runInvestigationCli(root, ["list", "--help"]);
    assert.match(listHelp.stdout, /--related-to <selector>/u);
    assert.match(listHelp.stdout, /--direction <direction>/u);
    const searchHelp = await runInvestigationCli(root, ["search", "--help"]);
    assert.match(searchHelp.stdout, /--related-to <selector>/u);

    const predecessors = await queryInvestigationIndex({
      direction: "predecessors",
      relatedTo: "center",
      workspaceRoot: root
    });
    assert.deepEqual(
      predecessors.entries.map((entry) => entry.id),
      ["predecessor"]
    );
    const successors = await queryInvestigationIndex({
      direction: "successors",
      relatedTo: "center",
      workspaceRoot: root
    });
    assert.deepEqual(
      successors.entries.map((entry) => entry.id),
      ["successor"]
    );
    const paged = await queryInvestigationIndex({
      limit: 1,
      offset: 1,
      relatedTo: "center",
      workspaceRoot: root
    });
    assert.equal(paged.total, 2);
    assert.deepEqual(
      paged.entries.map((entry) => entry.id),
      ["predecessor"]
    );
    assert.deepEqual(
      (
        await queryInvestigationIndex({
          relatedTo: "center",
          relationType: "补充",
          workspaceRoot: root
        })
      ).entries.map((entry) => entry.id),
      ["successor", "predecessor"]
    );
    assert.deepEqual(
      (
        await queryInvestigationIndex({
          relatedTo: "center",
          relationType: "复查",
          workspaceRoot: root
        })
      ).entries,
      []
    );
    assert.deepEqual(
      (
        await queryInvestigationIndex({
          formedAtFrom: "2026-08-28T11:00:00+00:00",
          relatedTo: "center",
          tags: ["alpha", "beta"],
          workspaceRoot: root
        })
      ).entries.map((entry) => entry.id),
      ["successor"]
    );
    assert.match(
      (
        await queryInvestigationIndex({
          direction: "both",
          workspaceRoot: root
        })
      ).errors.join("\n"),
      /direction requires relatedTo/u
    );
    assert.match(
      (
        await queryInvestigationIndex({
          relatedTo: "missing",
          workspaceRoot: root
        })
      ).errors.join("\n"),
      /does not exist/u
    );

    const content = await searchInvestigationReports({
      query: "relation needle",
      relatedTo: "center",
      workspaceRoot: root
    });
    assert.deepEqual(
      content.entries.map((entry) => entry.id),
      ["predecessor", "successor"]
    );
    const metadata = await searchInvestigationReports({
      in: "metadata",
      query: "relation needle",
      relatedTo: "center",
      workspaceRoot: root
    });
    assert.deepEqual(
      metadata.entries.map((entry) => entry.id),
      ["predecessor", "successor"]
    );
    for (const entry of metadata.entries) {
      assert.ok("matchedRelations" in entry);
      assert.deepEqual(entry.matchedRelations, []);
    }
    await fs.rm(`${root}/docs/investigations/investigation-index.json`);
    const fallback = await searchInvestigationReports({
      direction: "both",
      query: "relation needle",
      relatedTo: "center",
      workspaceRoot: root
    });
    assert.equal(fallback.status, "ok");
    assert.deepEqual(
      fallback.entries.map((entry) => entry.id),
      ["predecessor", "successor"]
    );
    assert.equal(fallback.warnings.length, 1);
    assert.deepEqual(
      (await synchronizeInvestigationIndex({ workspaceRoot: root })).errors,
      []
    );

    const cli = await runInvestigationCli(root, [
      "list",
      "--related-to",
      "center",
      "--direction",
      "predecessors"
    ]);
    assert.equal(cli.status, 0, cli.stderr);
    assert.match(cli.stdout, /^- predecessor /mu);
    assert.doesNotMatch(cli.stdout, /^- successor /mu);
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
    const allEntry = all.entries[0];
    assert.ok(
      allEntry !== undefined &&
        "previews" in allEntry &&
        allEntry.previews.length > 0
    );
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

test("search reads published metadata without reading report sources", async () => {
  await withTempRoot("search-metadata", async (root) => {
    await writeCollection(root, [
      {
        formedAt: "2026-08-28T10:00:00+00:00",
        id: "alpha",
        question: "Current indexed evidence",
        relations: [
          {
            summary: "Source relation summary",
            target: "zulu",
            type: "补充"
          }
        ],
        tags: ["indexed"],
        title: "Alpha metadata"
      },
      {
        formedAt: "2026-08-28T09:00:00+00:00",
        id: "zulu",
        question: "Other indexed evidence",
        tags: ["indexed"],
        title: "Limited metadata"
      }
    ]);
    const directory = `${root}/docs/investigations`;
    const indexPath = `${directory}/investigation-index.json`;
    const originalReadFile = fs.readFile;
    fs.readFile = (async (path, ...args) => {
      assert.equal(path, indexPath, "metadata search must read only its index");
      return await originalReadFile(path, ...args);
    }) as typeof fs.readFile;
    let all;
    let relation;
    let phrase;
    let limited;
    let relationTarget;
    let relationType;
    try {
      all = await searchInvestigationReports({
        in: "metadata",
        query: "Alpha Current",
        workspaceRoot: root
      });
      relation = await searchInvestigationReports({
        in: "metadata",
        query: "source relation",
        workspaceRoot: root
      });
      phrase = await searchInvestigationReports({
        in: "metadata",
        match: "phrase",
        query: "metadata Current",
        workspaceRoot: root
      });
      limited = await searchInvestigationReports({
        in: "metadata",
        limit: 1,
        match: "any",
        query: "Alpha Limited",
        workspaceRoot: root
      });
      relationTarget = await searchInvestigationReports({
        in: "metadata",
        query: "zulu",
        workspaceRoot: root
      });
      relationType = await searchInvestigationReports({
        in: "metadata",
        query: "补充",
        workspaceRoot: root
      });
    } finally {
      fs.readFile = originalReadFile;
    }
    assert.equal(all.status, "ok");
    assert.deepEqual(all.entries, [
      {
        formedAt: "2026-08-28T10:00:00+00:00",
        id: "alpha",
        matchedFields: ["id", "name", "title", "question"],
        matchedRelations: [],
        question: "Current indexed evidence",
        sourcePath: "alpha.md",
        tags: ["indexed"],
        title: "Alpha metadata"
      }
    ]);
    assert.equal(relation.status, "ok");
    assert.deepEqual(
      relation.entries.map((entry) => {
        assert.ok("matchedRelations" in entry);
        return {
          id: entry.id,
          matchedFields: entry.matchedFields,
          matchedRelations: entry.matchedRelations
        };
      }),
      [
        {
          id: "alpha",
          matchedFields: [],
          matchedRelations: [
            { summary: "Source relation summary", target: "zulu", type: "补充" }
          ]
        }
      ]
    );
    assert.equal(phrase.status, "ok");
    assert.deepEqual(phrase.entries, []);
    assert.equal(limited.status, "ok");
    assert.deepEqual(
      limited.entries.map((entry) => entry.id),
      ["alpha"]
    );
    assert.equal(relationTarget.status, "ok");
    assert.deepEqual(
      relationTarget.entries.map((entry) => entry.id),
      ["zulu"]
    );
    assert.equal(relationType.status, "ok");
    assert.deepEqual(relationType.entries, []);

    const defaultContent = await runInvestigationCli(root, [
      "search",
      "Current"
    ]);
    const explicitContent = await runInvestigationCli(root, [
      "search",
      "Current",
      "--in",
      "content"
    ]);
    const metadata = await runInvestigationCli(root, [
      "search",
      "Current",
      "--in",
      "metadata"
    ]);
    assert.equal(defaultContent.status, 0, defaultContent.stderr);
    assert.equal(explicitContent.status, 0, explicitContent.stderr);
    assert.equal(defaultContent.stdout, explicitContent.stdout);
    assert.equal(metadata.status, 0, metadata.stderr);
    assert.match(metadata.stdout, /matchedFields: question/u);
    assert.doesNotMatch(metadata.stdout, /^  \d+: /mu);

    await fs.rm(indexPath);
    const unavailable = await searchInvestigationReports({
      in: "metadata",
      query: "Alpha",
      workspaceRoot: root
    });
    assert.equal(unavailable.status, "error");
    assert.match(
      unavailable.diagnostics
        .map((diagnostic) => diagnostic.recovery)
        .join("\n"),
      /check.*sync-index/u
    );
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

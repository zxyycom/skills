import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { test } from "node:test";
import { searchInvestigationReports } from "../src/query.ts";
import {} from "../src/report-path.ts";
import {
  runInvestigationCli,
  withTempRoot,
  writeCollection
} from "./v6-support.ts";

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

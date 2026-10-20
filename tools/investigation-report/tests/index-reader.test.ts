import {
  investigationIndexFixture,
  searchIndexFixture
} from "./index-fixture.ts";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { test } from "node:test";
import { searchInvestigationReports } from "../src/query.ts";
import {} from "../src/report-path.ts";
import { withTempRoot } from "./fixture-support.ts";
import { writeCollection } from "./collection-support.ts";

test("metadata search reports its persisted-snapshot source boundary", async () => {
  await withTempRoot("search-metadata", async (root) => {
    const reports = [
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
    ] as const;
    await writeCollection(root, reports);
    const index = investigationIndexFixture(reports);
    const directory = `${root}/docs/investigations`;
    const indexPath = `${directory}/investigation-index.json`;
    const originalReadFile = fs.readFile;
    fs.readFile = (async (readPath: string, ...args) => {
      assert.ok(
        readPath === indexPath,
        `metadata search must only read its published index: ${readPath}`
      );
      return await originalReadFile(readPath, ...args);
    }) as typeof fs.readFile;
    let all;
    let relation;
    let phrase;
    let limited;
    let relationTarget;
    let relationType;
    try {
      const acquired = await searchInvestigationReports({
        in: "metadata",
        query: "Alpha",
        workspaceRoot: root
      });
      assert.equal(acquired.status, "ok");
      all = searchIndexFixture(index, {
        in: "metadata",
        query: "Alpha Current"
      });
      relation = searchIndexFixture(index, {
        in: "metadata",
        query: "source relation"
      });
      phrase = searchIndexFixture(index, {
        in: "metadata",
        match: "phrase",
        query: "metadata Current"
      });
      limited = searchIndexFixture(index, {
        in: "metadata",
        limit: 1,
        match: "any",
        query: "Alpha Limited"
      });
      relationTarget = searchIndexFixture(index, {
        in: "metadata",
        query: "zulu"
      });
      relationType = searchIndexFixture(index, {
        in: "metadata",
        query: "补充"
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

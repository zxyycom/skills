import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { test } from "node:test";
import { queryInvestigationIndex } from "../src/query.ts";
import {} from "../src/report-path.ts";
import {
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

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { test } from "node:test";
import {
  queryInvestigationIndex,
  searchInvestigationReports
} from "../src/query.ts";
import {} from "../src/report-path.ts";
import { synchronizeInvestigationIndex } from "../src/validation.ts";
import {
  runInvestigationCli,
  withTempRoot,
  writeCollection
} from "./v6-support.ts";

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

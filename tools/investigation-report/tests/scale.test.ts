import assert from "node:assert/strict";
import { test } from "node:test";
import { queryInvestigationIndex } from "../src/query.ts";
import { withTempRoot, writeCollection } from "./v6-support.ts";

test("indexes and queries one thousand independent reports by Investigation ID", async () => {
  await withTempRoot("scale", async (root) => {
    await writeCollection(
      root,
      Array.from({ length: 1000 }, (_, index) => ({
        id: `report-${String(index).padStart(4, "0")}.md`,
        tags: ["scale"]
      }))
    );
    const result = await queryInvestigationIndex({
      limit: 1000,
      tags: ["scale"],
      workspaceRoot: root
    });
    assert.equal(result.total, 1000);
    assert.equal(result.entries[0]?.id, "report-0000.md");
    assert.equal(result.entries.at(-1)?.id, "report-0999.md");
  });
});

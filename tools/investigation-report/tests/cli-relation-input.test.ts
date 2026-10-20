import assert from "node:assert/strict";
import { test } from "node:test";
import { runInvestigationReportCheckCli } from "../src/cli.ts";

import { setInvestigationRelations } from "../src/relation-transaction.ts";
import { withTempRoot } from "./fixture-support.ts";
import { writeCollection } from "./collection-support.ts";

test("set-relations parses complete source groups and rejects ambiguous grouping", async () => {
  await withTempRoot("groups", async (root) => {
    await writeCollection(root, [{ id: "base" }, { id: "next" }]);
    const invalid = await runInvestigationReportCheckCli([
      "set-relations",
      "--root",
      root,
      "--relation",
      "补充=base.md"
    ]);
    assert.equal(invalid, 2);
    const nonCanonicalSource = await setInvestigationRelations({
      replacements: [
        {
          relations: [{ target: "base", type: "补充" }],
          source: "./next.md"
        }
      ],
      workspaceRoot: root
    });
    assert.ok(
      nonCanonicalSource.errors.some((error) =>
        error.includes("source must use")
      )
    );
    const nonCanonicalTarget = await setInvestigationRelations({
      replacements: [
        {
          relations: [
            { target: "./base.md", type: "补充" },
            { target: " base.md ", type: "复查" }
          ],
          source: "next"
        }
      ],
      workspaceRoot: root
    });
    assert.ok(
      nonCanonicalTarget.errors.some((error) => error.includes("target"))
    );
  });
});

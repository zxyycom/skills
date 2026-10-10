import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import {
  listInvestigationCandidates,
  showInvestigationCandidate
} from "../src/candidate.ts";
import {
  investigationRoot,
  reportMarkdown,
  withTempRoot,
  writeCollection
} from "./v6-support.ts";

test("candidate read preparation failures report read-only access diagnostics", async () => {
  await withTempRoot("candidate-read-failure", async (root) => {
    await writeCollection(root, [{ id: "formal" }]);
    await fs.writeFile(
      path.join(investigationRoot(root), "_candidate.next"),
      reportMarkdown({ id: "next" })
    );
    const resourceRoot = path.join(investigationRoot(root), "_resources");
    const original = fs.lstat;
    fs.lstat = (async (...args: Parameters<typeof fs.lstat>) => {
      if (args[0] === resourceRoot)
        throw Object.assign(new Error("resource access denied"), {
          code: "EACCES"
        });
      return await original(...args);
    }) as typeof fs.lstat;
    try {
      const results = [
        await listInvestigationCandidates({ workspaceRoot: root }),
        await showInvestigationCandidate({ workspaceRoot: root, id: "next" })
      ];
      for (const result of results) {
        assert.equal(result.status, "error");
        assert.equal(result.diagnostics.length, 1);
        const diagnostic = result.diagnostics[0]!;
        assert.equal(
          diagnostic.code,
          "investigation-report.candidate-read-failed"
        );
        assert.equal(diagnostic.causeCategory, "access-denied");
        assert.equal(diagnostic.mutation, undefined);
        assert.equal(diagnostic.target, investigationRoot(root));
        assert.match(diagnostic.recovery, /retry the read/u);
      }
    } finally {
      fs.lstat = original;
    }
    assert.equal(
      await fs.readFile(
        path.join(investigationRoot(root), "_candidate.next"),
        "utf8"
      ),
      reportMarkdown({ id: "next" })
    );
  });
});

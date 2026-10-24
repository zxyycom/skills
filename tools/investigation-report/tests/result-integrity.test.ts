import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { createInvestigationCandidate } from "../src/candidate-create.ts";
import { runInvestigationReportCheckCli } from "../src/cli.ts";
import { traceInvestigationReports } from "../src/query-report.ts";
import { investigationRoot, withTempRoot } from "./fixture-support.ts";
import { writeCollection } from "./collection-support.ts";

test("investigation trace refuses a missing target and returns exact closed members for a valid graph", async () => {
  await withTempRoot("trace-result-integrity", async (root) => {
    await writeCollection(root, [
      { id: "base" },
      { id: "next", relations: [{ type: "补充", target: "base" }] }
    ]);
    const valid = await traceInvestigationReports({
      workspaceRoot: root,
      id: "next"
    });
    assert.equal(valid.status, "ok", JSON.stringify(valid));
    if (valid.status !== "ok") assert.fail("expected trace success");
    assert.deepEqual(
      valid.traceIds.filter((id) => valid.contextIds.includes(id)),
      []
    );
    assert.deepEqual(
      Object.keys(valid.entries).sort(),
      [...valid.traceIds, ...valid.contextIds].sort()
    );
    const indexPath = path.join(
      investigationRoot(root),
      "investigation-index.json"
    );
    const index = JSON.parse(await fs.readFile(indexPath, "utf8"));
    index.entries.next.relations[0].target = "missing";
    await fs.writeFile(indexPath, `${JSON.stringify(index, null, 2)}\n`);
    const invalid = await traceInvestigationReports({
      workspaceRoot: root,
      id: "next"
    });
    assert.equal(invalid.status, "error");
    assert.match(invalid.errors.join("\n"), /target does not exist: missing/u);
  });
});

test("investigation new retains created identity and path after lock release failure in API and CLI", async () => {
  await withTempRoot("new-result-integrity", async (root) => {
    const originalRm = fs.rm;
    fs.rm = async (...args) => {
      if (String(args[0]).endsWith(".investigation-index.json.mutation.lock"))
        throw new Error("injected lock cleanup failure");
      return await originalRm(...args);
    };
    try {
      const created = await createInvestigationCandidate({
        formedAt: "2026-10-23T12:00:00Z",
        id: "api-created",
        question: "Does the result preserve the creation fact?",
        relations: [],
        tags: ["test"],
        title: "API created",
        workspaceRoot: root
      });
      assert.equal(created.status, "error");
      assert.equal(created.changed, true);
      assert.ok(created.candidate !== null);
      assert.equal(created.candidate.id, "261023-api-created");
      assert.equal(
        await fs.readFile(created.candidate.path, "utf8"),
        created.candidate.markdown
      );
      assert.ok(
        created.diagnostics.some(({ code }) =>
          code.endsWith("collection-lock-release-failed")
        )
      );
      assert.equal("relationReview" in created, false);
      await originalRm(
        path.join(root, "docs/.investigation-index.json.mutation.lock")
      );
      let stdout = "";
      let stderr = "";
      const exit = await runInvestigationReportCheckCli(
        [
          "new",
          "cli-created",
          "--root",
          root,
          "--formed-at",
          "2026-10-23T12:00:00Z",
          "--title",
          "CLI created",
          "--question",
          "Does CLI preserve creation?",
          "--tag",
          "test"
        ],
        {
          io: {
            stdout: (text) => {
              stdout += text;
            },
            stderr: (text) => {
              stderr += text;
            }
          }
        }
      );
      assert.equal(exit, 1);
      assert.match(stdout, /candidate created: 261023-cli-created/u);
      assert.match(stdout, /path: .*_candidate\.cli-created\n/u);
      assert.match(stdout, /changed: true/u);
      assert.match(stderr, /collection-lock-release-failed/u);
      assert.doesNotMatch(stdout, /relationReview|publish preflight passed/u);
    } finally {
      fs.rm = originalRm;
    }
  });
});

test("investigation new retains created path but fails verification when a duplicate identity appears after publication", async () => {
  await withTempRoot("new-postwrite-duplicate", async (root) => {
    const link = fs.link;
    fs.link = async (from, to) => {
      await link(from, to);
      if (String(to).endsWith("_candidate.created"))
        await fs.copyFile(
          to,
          path.join(investigationRoot(root), "_candidate.other-locator")
        );
    };
    try {
      const result = await createInvestigationCandidate({
        workspaceRoot: root,
        id: "created",
        formedAt: "2026-10-23T12:00:00Z",
        title: "created",
        question: "Verify postwrite identity",
        tags: ["test"],
        relations: []
      });
      assert.equal(result.status, "error");
      assert.equal(result.changed, true);
      assert.ok(result.candidate !== null);
      assert.equal(result.candidate.id, "261023-created");
      assert.equal(
        await fs.readFile(result.candidate.path, "utf8"),
        result.candidate.markdown
      );
      assert.equal(result.candidate.readiness.scaffoldValid, false);
      assert.equal(
        result.diagnostics[0]?.mutation?.outcome,
        "partial-or-unknown"
      );
      assert.match(result.errors.join("; "), /more than one source path/i);
    } finally {
      fs.link = link;
    }
  });
});

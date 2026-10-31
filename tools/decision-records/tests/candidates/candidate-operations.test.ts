import fs from "node:fs/promises";
import path from "node:path";
import { runSourceCli, withTemporaryWorkspace } from "../support/support.ts";
import { isDecisionTag } from "../../src/collection/decision-path.ts";
import assert from "node:assert/strict";
import test from "node:test";
import { assertCandidateOperationContract } from "../../../record-operations/tests/candidate-contract.ts";
import { createDecisionCandidate } from "../../src/candidates/decision-candidate-service.ts";
import { executeDecisionQuery } from "../../src/query/decision-query-service.ts";
import { syncDecisionIndex } from "../../src/index/decision-state-index.ts";
import {
  candidateDecisionBody,
  decisionIdForTest
} from "../support/support-record-fixture.ts";

test("Decision candidate operations preserve drafting selection discovery and recovery boundaries", async () => {
  const tag = "candidate";
  assert.ok(isDecisionTag(tag));
  const location = (workspaceRoot: string) => ({
    workspaceRoot,
    decisionsDir: "docs/decisions"
  });
  await assertCandidateOperationContract({
    collection: "docs/decisions",
    indexFileName: "decision-index.json",
    candidate: (id, valid) => ({
      sourcePath: id + ".md",
      text: valid
        ? candidateDecisionBody({ id })
        : candidateDecisionBody({ id }).replace("## 决策", "## 非法章节")
    }),
    formal: (id) => ({
      sourcePath: id + ".md",
      text: candidateDecisionBody({ id })
        .replace("status: candidate", "status: active")
        .replace("alignment: null", "alignment: aligned")
        .replace("createdAt: null", "createdAt: 2026-10-21T00:00:00+00:00")
    }),
    create: async (root, name, targets) => {
      const result = await createDecisionCandidate({
        ...location(root),
        decisionId: decisionIdForTest(name),
        title: "候选操作契约",
        purpose: "核对起草范围",
        background: "保留可验证依据",
        decision: "明确候选结果",
        tags: [tag],
        relations: targets.map((target) => ({
          target: decisionIdForTest(target),
          type: "修订"
        }))
      });
      return {
        ok: result.status === "ok",
        ids: result.status === "ok" ? [result.decisionId] : []
      };
    },
    list: async (root) => {
      const result = await executeDecisionQuery({
        command: "candidates",
        location: location(root)
      });
      return {
        ok: result.status === "ok",
        ...(result.status === "ok" && result.command === "candidates"
          ? {
              ids: result.records.map(({ decisionId }) => decisionId),
              warnings: result.warnings
            }
          : {})
      };
    },
    show: async (root, decisionId) => {
      const result = await executeDecisionQuery({
        command: "show-candidate",
        location: location(root),
        decisionId
      });
      return {
        ok: result.status === "ok",
        ...(result.status === "ok" && result.command === "show-candidate"
          ? {
              ids: [result.record.decisionId],
              body: result.body,
              scaffoldValid: result.record.scaffoldValid,
              bodyReady: result.record.bodyReady
            }
          : {})
      };
    },
    queryCli: async (root, selector) => {
      const result = await runSourceCli(
        selector === undefined
          ? ["candidates", "--root", root]
          : ["show-candidate", selector, "--root", root]
      );
      return { ok: result.exitCode === 0, stdout: result.stdout };
    },
    createCli: async (root, target) => {
      const result = await runSourceCli([
        "new",
        "cli-draft",
        "--title",
        "候选操作契约",
        "--purpose",
        "核对起草范围",
        "--background",
        "保留可验证依据",
        "--decision",
        "明确候选结果",
        "--tag",
        "candidate",
        "--relation",
        "修订=" + target,
        "--root",
        root
      ]);
      return { ok: result.exitCode === 0, stdout: result.stdout };
    },
    sync: async (root) => {
      const synced = await syncDecisionIndex({
        decisionsDirectory: root + "/docs/decisions",
        mode: "write"
      });
      assert.equal(synced.status, "ok", JSON.stringify(synced));
    }
  });
});

test("Decision future-target scaffold stays readable while formal publication requires the target", async () => {
  await withTemporaryWorkspace(
    "future-target-lifecycle",
    async (workspaceRoot) => {
      const tag = "candidate";
      assert.ok(isDecisionTag(tag));
      const created = await createDecisionCandidate({
        workspaceRoot,
        decisionId: decisionIdForTest("future-check"),
        title: "未来关系候选",
        purpose: "验证起草范围",
        background: "尚未建立前序",
        decision: "保留未来声明",
        tags: [tag],
        relations: [
          { type: "修订", target: decisionIdForTest("261225-future") }
        ]
      });
      assert.equal(created.status, "ok");
      if (created.status !== "ok") assert.fail(JSON.stringify(created));
      const source = path.join(
        workspaceRoot,
        "docs/decisions",
        created.sourcePath
      );
      const completed = candidateDecisionBody({
        id: created.decisionId,
        relations: [{ type: "修订", target: "261225-future" }]
      });
      await fs.writeFile(source, completed);
      const shown = await executeDecisionQuery({
        command: "show-candidate",
        decisionId: created.decisionId,
        location: { workspaceRoot, decisionsDir: "docs/decisions" }
      });
      assert.equal(shown.status, "ok");
      assert.ok(shown.status === "ok" && shown.command === "show-candidate");
      assert.equal(shown.record.scaffoldValid, true);
      assert.equal(shown.record.bodyReady, true);
      const preflight = await runSourceCli([
        "publish",
        created.decisionId,
        "--alignment",
        "aligned",
        "--preflight",
        "--root",
        workspaceRoot
      ]);
      assert.equal(preflight.exitCode, 1);
      assert.match(preflight.stderr, /261225-future/);
      assert.match(preflight.stderr, /target does not exist/);
      assert.equal(await fs.readFile(source, "utf8"), completed);
      await assert.rejects(
        fs.stat(path.join(workspaceRoot, "docs/decisions/decision-index.json")),
        { code: "ENOENT" }
      );
    }
  );
});

await import("./candidate-operations/published-identities.test.ts");

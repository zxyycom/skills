import { runInvestigationCli } from "./cli-support.ts";
import assert from "node:assert/strict";
import test from "node:test";
import { assertCandidateOperationContract } from "../../record-operations/tests/candidate-contract.ts";
import {
  createInvestigationCandidate,
  listInvestigationCandidates,
  showInvestigationCandidate
} from "../src/candidate.ts";
import { synchronizeInvestigationIndex } from "../src/validation.ts";
import { reportMarkdown } from "./fixture-support.ts";

test("Investigation candidate operations preserve drafting selection discovery and recovery boundaries", async () => {
  await assertCandidateOperationContract({
    collection: "docs/investigations",
    indexFileName: "investigation-index.json",
    candidate: (id, valid) => ({
      sourcePath: "_candidate." + id,
      text: valid
        ? reportMarkdown({
            id,
            formedAt:
              "2026-10-" +
              (/^2610\d{2}-/.test(id) ? id.slice(4, 6) : "23") +
              "T00:00:00+00:00"
          })
        : reportMarkdown({
            id,
            formedAt:
              "2026-10-" +
              (/^2610\d{2}-/.test(id) ? id.slice(4, 6) : "23") +
              "T00:00:00+00:00"
          }).replace("## 调查结果与边界", "## 非法章节")
    }),
    formal: (id) => ({
      sourcePath: id + ".md",
      text: reportMarkdown({
        id,
        formedAt:
          "2026-10-" +
          (/^2610\d{2}-/.test(id) ? id.slice(4, 6) : "23") +
          "T00:00:00+00:00"
      })
    }),
    create: async (workspaceRoot, id, targets) => {
      const result = await createInvestigationCandidate({
        workspaceRoot,
        id,
        formedAt: "2026-10-23T00:00:00+00:00",
        title: "候选",
        question: "当前问题？",
        tags: ["candidate"],
        relations: targets.map((target) => ({ target, type: "补充" }))
      });
      return {
        ok: result.status === "ok",
        ids: result.candidate === null ? [] : [result.candidate.id]
      };
    },
    list: async (workspaceRoot) => {
      const result = await listInvestigationCandidates({ workspaceRoot });
      return {
        ok: result.status === "ok",
        ids: result.candidates.map(({ id }) => id),
        warnings: result.warnings
      };
    },
    show: async (workspaceRoot, id) => {
      const result = await showInvestigationCandidate({ workspaceRoot, id });
      return {
        ok: result.status === "ok",
        ...(result.candidate === null
          ? {}
          : {
              ids: [result.candidate.id],
              body: result.candidate.markdown ?? undefined,
              scaffoldValid: result.candidate.readiness.scaffoldValid,
              bodyReady: result.candidate.readiness.bodyReady
            })
      };
    },
    queryCli: async (root, selector) => {
      const result = await runInvestigationCli(
        root,
        selector === undefined ? ["candidates"] : ["show-candidate", selector]
      );
      return { ok: result.status === 0, stdout: result.stdout };
    },
    createCli: async (root, target) => {
      const result = await runInvestigationCli(root, [
        "new",
        "cli-draft",
        "--formed-at",
        "2026-10-23T00:00:00+00:00",
        "--title",
        "候选操作契约",
        "--question",
        "当前问题？",
        "--tag",
        "candidate",
        "--relation",
        "补充=" + target
      ]);
      return { ok: result.status === 0, stdout: result.stdout };
    },
    sync: async (workspaceRoot) => {
      const synced = await synchronizeInvestigationIndex({ workspaceRoot });
      assert.deepEqual(synced.errors, []);
    }
  });
});

import type { DecisionId, DecisionTag } from "./support.ts";
import {
  assert,
  createDecisionCandidate,
  currentDecisionId,
  decisionFilePath,
  fs,
  runSourceCli,
  test,
  withFixtureWorkspace
} from "./support.ts";

test("new binds a relation summary after resolving a direct predecessor selector", () =>
  withFixtureWorkspace("new-relation-summary", async (workspaceRoot) => {
    const candidateName = "new-relation-summary";
    const result = await runSourceCli([
      "new",
      candidateName,
      "--title",
      "创建带关系摘要的候选",
      "--purpose",
      "候选关系需要保留简短直接前序说明。",
      "--background",
      "关系目标与阅读性说明必须保持不同职责。",
      "--decision",
      "把摘要绑定到本次完整关系集合。",
      "--tag",
      "decision-records",
      "--relation",
      "修订=" + currentDecisionId,
      "--relation-summary",
      currentDecisionId + "=  创建=理由  ",
      "--root",
      workspaceRoot
    ]);
    assert.equal(result.exitCode, 0, result.stderr);
    const candidate = await fs.readFile(
      decisionFilePath(workspaceRoot, candidateName),
      "utf8"
    );
    assert.match(
      candidate,
      /type: 修订\n    target: use-generated-cli\n    summary: 创建=理由/u
    );
  }));

test("candidate API normalizes direct relation summaries without CLI-only inputs", () =>
  withFixtureWorkspace(
    "candidate-api-relation-summary",
    async (workspaceRoot) => {
      const created = await createDecisionCandidate({
        background: "程序化写入也必须应用 relation summary 契约。",
        decision: "在 API 边界规范化 relation summary。",
        decisionId: "candidate-api-relation-summary" as DecisionId,
        purpose: "程序化调用需要保持直接关系摘要。",
        relations: [
          {
            summary: "  直接调用=说明  ",
            target: currentDecisionId as DecisionId,
            type: "修订"
          }
        ],
        tags: ["decision-records" as DecisionTag],
        title: "程序化 relation summary",
        workspaceRoot
      });
      assert.equal(created.status, "ok");
      if (created.status !== "ok") return;
      const source = await fs.readFile(
        decisionFilePath(workspaceRoot, created.sourcePath),
        "utf8"
      );
      assert.match(source, /summary: 直接调用=说明/u);

      const invalid = await createDecisionCandidate({
        background: "程序化写入也必须应用 relation summary 契约。",
        decision: "在 API 边界拒绝超长 relation summary。",
        decisionId: "candidate-api-relation-summary-invalid" as DecisionId,
        purpose: "程序化调用需要拒绝无效关系摘要。",
        relations: [
          {
            summary: "😀".repeat(41),
            target: currentDecisionId as DecisionId,
            type: "修订"
          }
        ],
        tags: ["decision-records" as DecisionTag],
        title: "程序化 relation summary 拒绝",
        workspaceRoot
      });
      assert.equal(invalid.status, "error");
      assert.match(invalid.diagnostics[0]?.reason ?? "", /at most 40/u);
    }
  ));

import path from "node:path";
import {
  applyDecisionChanges,
  assert,
  archivedDecisionId,
  decisionFilePath,
  establishMaintenanceDecision,
  fs,
  maintenanceRelativePath,
  runSourceLifecycleCli,
  scanDecisionRecords,
  test,
  withFixtureWorkspace
} from "./support.ts";
import { prepareDecisionLifecycle } from "../../src/decision-lifecycle-service.ts";
import type { DecisionId } from "../../src/types.ts";

test("set-relations rejects drifted source bytes before writing anything", () =>
  withFixtureWorkspace("set-relations-drift", async (workspaceRoot) => {
    await establishMaintenanceDecision(workspaceRoot);
    const scan = await scanDecisionRecords({ workspaceRoot });
    const prepared = prepareDecisionLifecycle(
      scan,
      {
        action: "set-relations",
        preflight: false,
        relationOverrideGroups: [
          {
            relationOverride: {
              kind: "replace",
              relations: [
                { type: "修订", target: archivedDecisionId as DecisionId }
              ]
            },
            source: maintenanceRelativePath as DecisionId
          }
        ]
      },
      { historyBaseline: null }
    );
    assert.equal(prepared.status, "ok");
    const sourcePath = decisionFilePath(workspaceRoot, maintenanceRelativePath);
    const indexPath = path.join(
      workspaceRoot,
      "docs",
      "decisions",
      "decision-index.json"
    );
    const drifted = (await fs.readFile(sourcePath, "utf8")).replace(
      "验证 Markdown 生命周期独立定义候选和已建立状态。",
      "写前漂移的目的字段。"
    );
    await fs.writeFile(sourcePath, drifted, "utf8");
    const indexBefore = await fs.readFile(indexPath, "utf8");

    const result = await applyDecisionChanges({
      changes: prepared.changes,
      originalScan: scan,
      scanOptions: { workspaceRoot }
    });
    assert.equal(result.status, "error");
    assert.equal(result.outcome, "no-change");
    assert.ok(
      result.errors.some((error) => error.includes("changed after validation")),
      result.errors.join("; ")
    );
    assert.equal(await fs.readFile(sourcePath, "utf8"), drifted);
    assert.equal(await fs.readFile(indexPath, "utf8"), indexBefore);
  }));

test("set-relations succeeds again after the drift is rescanned", () =>
  withFixtureWorkspace("set-relations-drift-rescan", async (workspaceRoot) => {
    await establishMaintenanceDecision(workspaceRoot);
    const result = await runSourceLifecycleCli([
      "set-relations",
      "--source",
      maintenanceRelativePath,
      "--relation",
      "修订=" + archivedDecisionId,
      "--root",
      workspaceRoot
    ]);
    assert.equal(result.exitCode, 0, result.stderr);
    assert.match(
      await fs.readFile(
        decisionFilePath(workspaceRoot, maintenanceRelativePath),
        "utf8"
      ),
      new RegExp(`type: 修订\\n    target: ${archivedDecisionId}`)
    );
  }));

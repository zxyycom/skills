import { assertLifecycleRejected } from "../../lifecycle/evolution/domain-support.ts";
import { decisionIdForTest } from "../../support/support-record-fixture.ts";
import path from "node:path";
import {
  assert,
  archivedDecisionId,
  candidateDecisionBody,
  decisionFilePath,
  establishMaintenanceDecision,
  findIndexEntry,
  fs,
  maintenanceRelativePath,
  readIndex,
  runSourceLifecycleCli,
  test,
  withFixtureWorkspace
} from "./support.ts";

test("set-relations applies multiple sources in one transaction", () =>
  withFixtureWorkspace("set-relations-multi-source", async (workspaceRoot) => {
    const secondRelativePath = "use-second-relation-maintenance";
    await establishMaintenanceDecision(workspaceRoot);
    await fs.writeFile(
      decisionFilePath(workspaceRoot, secondRelativePath),
      candidateDecisionBody(),
      "utf8"
    );
    await runSourceLifecycleCli([
      "publish",
      secondRelativePath,
      "--alignment",
      "unaligned",
      "--root",
      workspaceRoot
    ]);

    const result = await runSourceLifecycleCli([
      "set-relations",
      "--source",
      secondRelativePath,
      "--relation",
      "修订=" + archivedDecisionId,
      "--source",
      maintenanceRelativePath,
      "--relation",
      "修订=" + archivedDecisionId,
      "--root",
      workspaceRoot
    ]);
    assert.equal(result.exitCode, 0, result.stderr);
    const index = await readIndex(workspaceRoot);
    assert.deepEqual(findIndexEntry(index, maintenanceRelativePath).relations, [
      { target: archivedDecisionId, type: "修订" }
    ]);
    assert.deepEqual(findIndexEntry(index, secondRelativePath).relations, [
      { target: archivedDecisionId, type: "修订" }
    ]);
  }));

test("set-relations rejects an invalid later source without writing the valid one", () =>
  withFixtureWorkspace("set-relations-atomic-reject", async (workspaceRoot) => {
    await establishMaintenanceDecision(workspaceRoot);
    const validPath = decisionFilePath(workspaceRoot, maintenanceRelativePath);
    const indexPath = path.join(
      workspaceRoot,
      "docs",
      "decisions",
      "decision-index.json"
    );
    const validBefore = await fs.readFile(validPath, "utf8");
    const indexBefore = await fs.readFile(indexPath, "utf8");

    const result = await runSourceLifecycleCli([
      "set-relations",
      "--source",
      maintenanceRelativePath,
      "--relation",
      "修订=" + archivedDecisionId,
      "--source",
      "missing-relation-maintenance-source",
      "--clear-relations",
      "--root",
      workspaceRoot
    ]);
    assert.equal(result.exitCode, 1);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /Decision does not exist/u);
    assert.equal(await fs.readFile(validPath, "utf8"), validBefore);
    assert.equal(await fs.readFile(indexPath, "utf8"), indexBefore);
  }));

test("set-relations rejects a graph-invalid replacement without writing", async () => {
  await assertLifecycleRejected(
    [
      { id: "source", status: "active" },
      { id: "target", status: "active" }
    ],
    {
      action: "set-relations",
      preflight: false,
      relationOverrideGroups: [
        {
          source: decisionIdForTest("source"),
          relationOverride: {
            kind: "replace",
            relations: [{ target: decisionIdForTest("target"), type: "修订" }]
          }
        }
      ]
    },
    /target must be archived/
  );
});

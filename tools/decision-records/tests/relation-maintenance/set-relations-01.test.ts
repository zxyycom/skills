import {
  assert,
  archivedDecisionId,
  decisionFilePath,
  establishMaintenanceDecision,
  findIndexEntry,
  fs,
  maintenanceRelativePath,
  readIndex,
  runSourceLifecycleCli,
  test,
  validateDecisionRecords,
  withFixtureWorkspace
} from "./support.ts";

test("set-relations replaces the complete relation set of an established decision and republishes the index", () =>
  withFixtureWorkspace("set-relations-replace", async (workspaceRoot) => {
    await establishMaintenanceDecision(workspaceRoot);
    const result = await runSourceLifecycleCli([
      "set-relations",
      "--source",
      maintenanceRelativePath,
      "--relation",
      "修订=" + archivedDecisionId,
      "--relation-summary",
      archivedDecisionId + "=修正关系说明",
      "--root",
      workspaceRoot
    ]);
    assert.equal(result.exitCode, 0, result.stderr);
    assert.match(result.stdout, /Set relations for /u);
    assert.match(result.stdout, /Relation review \(committed\):/u);
    assert.match(result.stdout, /action=replace/u);
    assert.match(result.stdout, /before relations: \[\]/u);
    assert.match(
      result.stdout,
      new RegExp(
        `${maintenanceRelativePath} --修订--> ${archivedDecisionId}: "修正关系说明"`
      )
    );
    const markdown = await fs.readFile(
      decisionFilePath(workspaceRoot, maintenanceRelativePath),
      "utf8"
    );
    assert.match(
      markdown,
      /type: 修订\n    target: 260710-use-source-cli\n    summary: 修正关系说明/u
    );
    const entry = findIndexEntry(
      await readIndex(workspaceRoot),
      maintenanceRelativePath
    );
    assert.deepEqual(entry.relations, [
      {
        summary: "修正关系说明",
        target: archivedDecisionId,
        type: "修订"
      }
    ]);
    assert.deepEqual(
      (await validateDecisionRecords({ workspaceRoot })).errors,
      []
    );
  }));

test("set-relations replaces summaries in place without merging the previous set", () =>
  withFixtureWorkspace(
    "set-relations-replace-summary",
    async (workspaceRoot) => {
      await establishMaintenanceDecision(workspaceRoot);
      const first = await runSourceLifecycleCli([
        "set-relations",
        "--source",
        maintenanceRelativePath,
        "--relation",
        "修订=" + archivedDecisionId,
        "--relation-summary",
        archivedDecisionId + "=第一版说明",
        "--root",
        workspaceRoot
      ]);
      assert.equal(first.exitCode, 0, first.stderr);
      const second = await runSourceLifecycleCli([
        "set-relations",
        "--source",
        maintenanceRelativePath,
        "--relation",
        "修订=" + archivedDecisionId,
        "--root",
        workspaceRoot
      ]);
      assert.equal(second.exitCode, 0, second.stderr);
      const markdown = await fs.readFile(
        decisionFilePath(workspaceRoot, maintenanceRelativePath),
        "utf8"
      );
      assert.doesNotMatch(markdown, /summary:/u);
      assert.match(second.stdout, /summary changed/u);
      assert.equal(
        (await validateDecisionRecords({ workspaceRoot })).errors.length,
        0
      );
    }
  ));

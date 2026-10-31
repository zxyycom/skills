import path from "node:path";
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
  withFixtureWorkspace
} from "./support.ts";

test("set-relations preflight reviews the complete grouping without writing", () =>
  withFixtureWorkspace("set-relations-preflight", async (workspaceRoot) => {
    await establishMaintenanceDecision(workspaceRoot);
    const markdownPath = decisionFilePath(
      workspaceRoot,
      maintenanceRelativePath
    );
    const indexPath = path.join(
      workspaceRoot,
      "docs",
      "decisions",
      "decision-index.json"
    );
    const indexBefore = await fs.readFile(indexPath, "utf8");
    const markdownBefore = await fs.readFile(markdownPath, "utf8");

    const result = await runSourceLifecycleCli([
      "set-relations",
      "--source",
      maintenanceRelativePath,
      "--relation",
      "修订=" + archivedDecisionId,
      "--preflight",
      "--root",
      workspaceRoot
    ]);
    assert.equal(result.exitCode, 0, result.stderr);
    assert.match(result.stdout, /Decision set-relations preflight passed:/u);
    assert.match(result.stdout, /Relation review \(preflight\):/u);
    assert.match(result.stdout, /action=replace/u);
    assert.match(
      result.stdout,
      /No Decision Markdown, derived index, or pending state was changed\./u
    );
    assert.equal(await fs.readFile(markdownPath, "utf8"), markdownBefore);
    assert.equal(await fs.readFile(indexPath, "utf8"), indexBefore);
  }));

test("set-relations clears one source and reports an unchanged source separately", () =>
  withFixtureWorkspace("set-relations-clear", async (workspaceRoot) => {
    await establishMaintenanceDecision(workspaceRoot, [
      { target: archivedDecisionId, type: "修订" }
    ]);
    const clearedPath = decisionFilePath(
      workspaceRoot,
      maintenanceRelativePath
    );
    const unchangedPath = decisionFilePath(workspaceRoot, "use-generated-cli");
    const unchangedBefore = await fs.readFile(unchangedPath, "utf8");

    const result = await runSourceLifecycleCli([
      "set-relations",
      "--source",
      maintenanceRelativePath,
      "--clear-relations",
      "--source",
      "use-generated-cli",
      "--relation",
      "修订=" + archivedDecisionId,
      "--root",
      workspaceRoot
    ]);
    assert.equal(result.exitCode, 0, result.stderr);
    assert.match(
      result.stdout,
      new RegExp(`- ${maintenanceRelativePath} action=replace`)
    );
    assert.match(result.stdout, /- use-generated-cli action=unchanged/u);
    const cleared = await fs.readFile(clearedPath, "utf8");
    assert.match(cleared, /relations: \[\]/u);
    assert.equal(
      findIndexEntry(await readIndex(workspaceRoot), maintenanceRelativePath)
        .relations.length,
      0
    );
    assert.deepEqual(
      findIndexEntry(await readIndex(workspaceRoot), "use-generated-cli")
        .relations,
      [{ target: archivedDecisionId, type: "修订" }]
    );
    assert.match(
      await fs.readFile(
        decisionFilePath(workspaceRoot, maintenanceRelativePath),
        "utf8"
      ),
      /relations: \[\]/u
    );
    assert.equal(await fs.readFile(unchangedPath, "utf8"), unchangedBefore);
  }));

import path from "node:path";
import {
  assert,
  archivedDecisionId,
  candidateDecisionBody,
  decisionFilePath,
  establishMaintenanceDecision,
  fs,
  maintenanceRelativePath,
  runSourceLifecycleCli,
  test,
  withFixtureWorkspace
} from "./support.ts";

test("set-relations maintains established decisions only", () =>
  withFixtureWorkspace(
    "set-relations-candidate-source",
    async (workspaceRoot) => {
      await establishMaintenanceDecision(workspaceRoot);
      const candidatePath = "use-candidate-relation-source";
      await fs.writeFile(
        decisionFilePath(workspaceRoot, candidatePath),
        candidateDecisionBody(),
        "utf8"
      );
      const candidateBefore = await fs.readFile(
        decisionFilePath(workspaceRoot, candidatePath),
        "utf8"
      );

      const result = await runSourceLifecycleCli([
        "set-relations",
        "--source",
        candidatePath,
        "--relation",
        "修订=" + archivedDecisionId,
        "--root",
        workspaceRoot
      ]);
      assert.equal(result.exitCode, 1);
      assert.equal(result.stdout, "");
      assert.match(
        result.stderr,
        /set-relations maintains established decisions only/u
      );
      assert.equal(
        await fs.readFile(
          decisionFilePath(workspaceRoot, candidatePath),
          "utf8"
        ),
        candidateBefore
      );
    }
  ));

test("set-relations rejects a summary that misses the final relation set", () =>
  withFixtureWorkspace(
    "set-relations-summary-mismatch",
    async (workspaceRoot) => {
      await establishMaintenanceDecision(workspaceRoot);
      const sourcePath = decisionFilePath(
        workspaceRoot,
        maintenanceRelativePath
      );
      const indexPath = path.join(
        workspaceRoot,
        "docs",
        "decisions",
        "decision-index.json"
      );
      const sourceBefore = await fs.readFile(sourcePath, "utf8");
      const indexBefore = await fs.readFile(indexPath, "utf8");

      const result = await runSourceLifecycleCli([
        "set-relations",
        "--source",
        maintenanceRelativePath,
        "--relation",
        "修订=" + archivedDecisionId,
        "--relation-summary",
        "use-generated-cli=失配说明",
        "--root",
        workspaceRoot
      ]);
      assert.equal(result.exitCode, 1);
      assert.equal(result.stdout, "");
      assert.match(
        result.stderr,
        /relation-summary target is not in the complete relation set/u
      );
      assert.equal(await fs.readFile(sourcePath, "utf8"), sourceBefore);
      assert.equal(await fs.readFile(indexPath, "utf8"), indexBefore);
    }
  ));

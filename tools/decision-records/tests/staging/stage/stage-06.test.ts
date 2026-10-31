import { withGitFixtureWorkspace } from "../../support/support-git-fixture.ts";
import { stageDecisionRecords } from "../../../src/staging/decision-stage-service.ts";
import {
  archivedDecisionId,
  assert,
  candidateDecisionBody,
  commitWorkspace,
  currentDecisionId,
  currentSourcePath,
  decisionFilePath,
  fs,
  initializeGitRepository,
  path,
  runGit,
  test,
  withTemporaryWorkspace,
  writeDecision,
  syncDecisionIndexBeforeStage
} from "./support.ts";

test("stage --scope index composes with a pending index that already differs from the revision", () =>
  withGitFixtureWorkspace(
    "stage-scope-index-conflict",
    async (workspaceRoot) => {
      const selectedPath = decisionFilePath(workspaceRoot, currentSourcePath);
      await fs.writeFile(
        selectedPath,
        (await fs.readFile(selectedPath, "utf8")).replace(
          "使用生成 CLI",
          "冲突范围修改 CLI"
        ),
        "utf8"
      );
      await syncDecisionIndexBeforeStage(workspaceRoot);
      const first = await stageDecisionRecords({
        decisionIds: [currentDecisionId],
        location: {
          workspaceRoot: workspaceRoot,
          decisionsDir: "docs/decisions"
        },
        scope: "index"
      });
      assert.equal(first.status, "ok", JSON.stringify(first));
      const second = await stageDecisionRecords({
        decisionIds: [archivedDecisionId],
        location: {
          workspaceRoot: workspaceRoot,
          decisionsDir: "docs/decisions"
        },
        scope: "index"
      });
      assert.equal(second.status, "ok", JSON.stringify(second));
      assert.match(
        runGit(workspaceRoot, ["show", ":docs/decisions/decision-index.json"]),
        /冲突范围修改 CLI/u
      );
    }
  ));

test("stage --scope domain preserves an unrelated pending index byte-for-byte after source drift is absent", () =>
  withTemporaryWorkspace(
    "stage-scope-first-collection",
    async (workspaceRoot) => {
      initializeGitRepository(workspaceRoot);
      await fs.writeFile(
        path.join(workspaceRoot, "README.md"),
        "baseline\n",
        "utf8"
      );
      commitWorkspace(workspaceRoot);
      const id = "use-first-domain-stage";
      await writeDecision(
        workspaceRoot,
        id,
        candidateDecisionBody()
          .replace("status: candidate", "status: active")
          .replace("alignment: null", "alignment: aligned")
          .replace("createdAt: null", "createdAt: 2026-08-15T00:00:00Z")
      );
      await syncDecisionIndexBeforeStage(workspaceRoot);
      const indexStaged = await stageDecisionRecords({
        decisionIds: [id],
        location: {
          workspaceRoot: workspaceRoot,
          decisionsDir: "docs/decisions"
        },
        scope: "index"
      });
      assert.equal(indexStaged.status, "ok", JSON.stringify(indexStaged));
      const stagedIndex = runGit(workspaceRoot, [
        "show",
        ":docs/decisions/decision-index.json"
      ]);
      const domainStaged = await stageDecisionRecords({
        decisionIds: [id],
        location: {
          workspaceRoot: workspaceRoot,
          decisionsDir: "docs/decisions"
        },
        scope: "domain"
      });
      assert.equal(domainStaged.status, "ok", JSON.stringify(domainStaged));
      assert.equal(
        runGit(workspaceRoot, ["show", ":docs/decisions/decision-index.json"]),
        stagedIndex
      );
      assert.match(
        runGit(workspaceRoot, ["show", `:docs/decisions/${id}.md`]),
        /使用 Markdown 建立状态/u
      );
    }
  ));

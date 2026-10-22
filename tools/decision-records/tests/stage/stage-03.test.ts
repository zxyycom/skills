import {
  stageSource,
  withStageBaseline,
  writeStageSources
} from "./domain-support.ts";
import { withGitFixtureWorkspace } from "../support-git-fixture.ts";
import { stageDecisionRecords } from "../../src/decision-stage-service.ts";
import {
  archivedDecisionId,
  archivedSourcePath,
  assert,
  candidateDecisionBody,
  currentDecisionId,
  currentSourcePath,
  decisionFilePath,
  fs,
  runGit,
  test,
  writeDecision,
  syncDecisionIndexBeforeStage
} from "./support.ts";

test("stage applies selected additions modifications deletions and explicit renames", () =>
  withGitFixtureWorkspace("stage-overlay", async (workspaceRoot) => {
    const modified = decisionFilePath(workspaceRoot, currentSourcePath);
    const deleted = decisionFilePath(workspaceRoot, archivedSourcePath);
    const addedId = "use-added-stage";
    await fs.writeFile(
      modified,
      (await fs.readFile(modified, "utf8"))
        .replace("使用生成 CLI", "使用修改 CLI")
        .replace(
          "relations:\n  - type: 修订\n    target: 260710-use-source-cli",
          "relations: []"
        ),
      "utf8"
    );
    await fs.rm(deleted);
    await writeDecision(
      workspaceRoot,
      addedId,
      candidateDecisionBody({ title: "使用新增 Stage" })
        .replace("status: candidate", "status: active")
        .replace("alignment: null", "alignment: aligned")
        .replace("createdAt: null", "createdAt: 2026-08-15T00:00:00Z")
    );
    await syncDecisionIndexBeforeStage(workspaceRoot);
    const staged = await stageDecisionRecords({
      decisionIds: [currentDecisionId, archivedDecisionId, addedId],
      location: { workspaceRoot: workspaceRoot, decisionsDir: "docs/decisions" }
    });
    assert.equal(staged.status, "ok", JSON.stringify(staged));
    const pending = runGit(workspaceRoot, ["diff", "--cached", "--name-only"]);
    assert.match(pending, new RegExp(currentDecisionId));
    assert.match(pending, new RegExp(archivedDecisionId));
    assert.match(pending, new RegExp(addedId));
    assert.match(pending, /decision-index\.json/);
  }));

test("stage rejects invalid duplicate and missing paths without changing the pending snapshot", async () => {
  for (const ids of [
    [currentDecisionId, currentDecisionId],
    ["../outside.md"]
  ]) {
    const result = await stageDecisionRecords({
      decisionIds: ids,
      location: {
        workspaceRoot: "missing-stage-root",
        decisionsDir: "docs/decisions"
      }
    });
    assert.equal(result.status, "error");
    if (result.status === "error") {
      assert.equal(result.exitCode, 2);
      assert.match(
        JSON.stringify(result.diagnostics),
        /must not be repeated|extensionless kebab-case/
      );
    }
  }
});

test("stage bootstraps a new Decision when revision contains only the derived index", async () => {
  await withStageBaseline("stage-index-only-baseline", [], async (root) => {
    await writeStageSources(root, [stageSource("selected")]);
    const result = await stageDecisionRecords({
      decisionIds: ["selected"],
      location: { workspaceRoot: root, decisionsDir: "docs/decisions" }
    });
    assert.equal(result.status, "ok", JSON.stringify(result));
    assert.match(
      runGit(root, ["show", ":docs/decisions/selected.md"]),
      /id: selected/
    );
    assert.match(
      runGit(root, ["show", ":docs/decisions/decision-index.json"]),
      /"selected"/
    );
  });
});

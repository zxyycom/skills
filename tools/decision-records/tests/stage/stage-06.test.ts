import { withGitFixtureWorkspace } from "../support-git-fixture.ts";
import { stageDecisionRecords } from "../../src/decision-stage-service.ts";
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

test("stage --scope index writes only the derived index projection", () =>
  withGitFixtureWorkspace("stage-scope-index", async (workspaceRoot) => {
    const selectedPath = decisionFilePath(workspaceRoot, currentSourcePath);
    await fs.writeFile(
      selectedPath,
      (await fs.readFile(selectedPath, "utf8")).replace(
        "使用生成 CLI",
        "索引范围修改 CLI"
      ),
      "utf8"
    );
    await syncDecisionIndexBeforeStage(workspaceRoot);
    const staged = await stageDecisionRecords({
      decisionIds: [currentDecisionId],
      location: {
        workspaceRoot: workspaceRoot,
        decisionsDir: "docs/decisions"
      },
      scope: "index"
    });
    assert.equal(staged.status, "ok", JSON.stringify(staged));
    assert.ok(staged.status === "ok" && staged.scope === "index");
    assert.deepEqual(
      runGit(workspaceRoot, ["diff", "--cached", "--name-only"]).trim(),
      "docs/decisions/decision-index.json"
    );
    const pendingIndex = JSON.parse(
      runGit(workspaceRoot, ["show", ":docs/decisions/decision-index.json"])
    );
    assert.equal(
      pendingIndex.entries[currentDecisionId].title,
      "索引范围修改 CLI"
    );
    assert.equal(
      runGit(workspaceRoot, [
        "diff",
        "--cached",
        "--",
        `docs/decisions/${currentSourcePath}`
      ]),
      ""
    );
  }));

test("stage --scope index rejects a pending index that already differs from the revision", () =>
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
      assert.equal(second.status, "error");
      assert.match(
        JSON.stringify(second),
        /pending decision index already differs from the current revision baseline/u
      );
    }
  ));

test("stage --scope domain writes only formal Markdown and preserves the pending index", () =>
  withGitFixtureWorkspace("stage-scope-domain", async (workspaceRoot) => {
    const selectedPath = decisionFilePath(workspaceRoot, currentSourcePath);
    await fs.writeFile(
      selectedPath,
      (await fs.readFile(selectedPath, "utf8")).replace(
        "使用生成 CLI",
        "领域范围修改 CLI"
      ),
      "utf8"
    );
    await syncDecisionIndexBeforeStage(workspaceRoot);
    const staged = await stageDecisionRecords({
      decisionIds: [currentDecisionId],
      location: {
        workspaceRoot: workspaceRoot,
        decisionsDir: "docs/decisions"
      },
      scope: "domain"
    });
    assert.equal(staged.status, "ok", JSON.stringify(staged));
    assert.ok(staged.status === "ok" && staged.scope === "domain");
    assert.ok(staged.status === "ok");
    assert.deepEqual(staged.callerOwnedPaths, [
      "docs/decisions/decision-index.json"
    ]);
    const pendingPaths = runGit(workspaceRoot, [
      "diff",
      "--cached",
      "--name-status"
    ]);
    assert.match(
      pendingPaths,
      new RegExp(`M\\tdocs/decisions/${currentSourcePath}`)
    );
    assert.equal(
      runGit(workspaceRoot, [
        "diff",
        "--cached",
        "--",
        "docs/decisions/decision-index.json"
      ]),
      ""
    );
  }));

test("stage --scope domain composes with a previous index scope into the all snapshot", () =>
  withGitFixtureWorkspace("stage-scope-compose", async (workspaceRoot) => {
    const selectedPath = decisionFilePath(workspaceRoot, currentSourcePath);
    await fs.writeFile(
      selectedPath,
      (await fs.readFile(selectedPath, "utf8")).replace(
        "使用生成 CLI",
        "组合范围修改 CLI"
      ),
      "utf8"
    );
    await syncDecisionIndexBeforeStage(workspaceRoot);
    const indexStaged = await stageDecisionRecords({
      decisionIds: [currentDecisionId],
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
      decisionIds: [currentDecisionId],
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
      runGit(workspaceRoot, ["show", `:docs/decisions/${currentSourcePath}`]),
      /组合范围修改 CLI/u
    );
    const pendingPaths = runGit(workspaceRoot, [
      "diff",
      "--cached",
      "--name-only"
    ]);
    assert.match(pendingPaths, /decision-index\.json/u);
    assert.match(pendingPaths, new RegExp(currentSourcePath));
  }));

test("stage --scope domain writes a deletion for a baseline-only ID without touching the pending index", () =>
  withGitFixtureWorkspace(
    "stage-scope-domain-deletion",
    async (workspaceRoot) => {
      await fs.rm(decisionFilePath(workspaceRoot, currentSourcePath));
      await syncDecisionIndexBeforeStage(workspaceRoot);
      const staged = await stageDecisionRecords({
        decisionIds: [currentDecisionId],
        location: {
          workspaceRoot: workspaceRoot,
          decisionsDir: "docs/decisions"
        },
        scope: "domain"
      });
      assert.equal(staged.status, "ok", JSON.stringify(staged));
      const pendingPaths = runGit(workspaceRoot, [
        "diff",
        "--cached",
        "--name-status",
        "--no-renames"
      ]);
      assert.match(
        pendingPaths,
        new RegExp(`D\\tdocs/decisions/${currentDecisionId}`)
      );
      assert.equal(
        runGit(workspaceRoot, [
          "diff",
          "--cached",
          "--",
          "docs/decisions/decision-index.json"
        ]),
        ""
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

import { withGitFixtureWorkspace } from "../support-git-fixture.ts";
import { assertLifecycleRejected } from "../evolution/domain-support.ts";
import { decisionIdForTest } from "../support-record-fixture.ts";
import {
  assert,
  assertRejectedDiscardPreserves,
  candidateDecisionBody,
  commitWorkspace,
  decisionFilePath,
  fileExists,
  fs,
  path,
  runGit,
  runSourceCli,
  test,
  withFixtureWorkspace
} from "./support.ts";

test("discard rejects candidates with invalid relation targets without mutation", () =>
  withFixtureWorkspace(
    "candidate-discard-invalid-relation",
    async (workspaceRoot) => {
      const indexPath = path.join(
        workspaceRoot,
        "docs",
        "decisions",
        "decision-index.json"
      );
      const invalidTargetRelativePath = "use-invalid-existing-discard-target";
      const invalidTargetPath = decisionFilePath(
        workspaceRoot,
        invalidTargetRelativePath
      );
      const invalidTargetText = candidateDecisionBody().replace(
        "\n## 目的\n- 验证 Markdown 生命周期独立定义候选和已建立状态。\n",
        "\n"
      );
      await fs.writeFile(invalidTargetPath, invalidTargetText, "utf8");

      const sourceRelativePath = "use-invalid-target-discard-source";
      const sourcePath = decisionFilePath(workspaceRoot, sourceRelativePath);
      await fs.writeFile(
        sourcePath,
        candidateDecisionBody({
          relations: [{ type: "修订", target: "missing-selected-target" }]
        }),
        "utf8"
      );

      await assertRejectedDiscardPreserves({
        decisionPath: sourcePath,
        expectedError: /missing-selected-target/,
        indexPath,
        relativePath: sourceRelativePath,
        workspaceRoot
      });
      assert.equal(
        await fs.readFile(invalidTargetPath, "utf8"),
        invalidTargetText
      );
    }
  ));

test("discard rejects a candidate that is still referenced without mutation", async () => {
  await assertLifecycleRejected(
    [
      { id: "target", status: "candidate" },
      { id: "source", relations: [{ type: "修订", target: "target" }] }
    ],
    {
      action: "discard",
      decisionId: decisionIdForTest("target"),
      deleteRecorded: true
    },
    /still referenced/
  );
});

test("discard rejects an established decision that is still referenced without mutation", async () => {
  await assertLifecycleRejected(
    [
      { id: "target", status: "archived" },
      { id: "source", relations: [{ type: "修订", target: "target" }] }
    ],
    {
      action: "discard",
      decisionId: decisionIdForTest("target"),
      deleteRecorded: true
    },
    /still referenced/
  );
});

test("discard fails closed when Git HEAD cannot be read", () =>
  withGitFixtureWorkspace(
    "candidate-discard-unreadable-head",
    async (workspaceRoot) => {
      const decisionsDirectory = path.join(workspaceRoot, "docs", "decisions");
      const indexPath = path.join(decisionsDirectory, "decision-index.json");
      const originalIndexText = await fs.readFile(indexPath, "utf8");
      const sourceRelativePath = "use-corrupt-head-discard-candidate";
      const sourcePath = decisionFilePath(workspaceRoot, sourceRelativePath);
      const sourceText = candidateDecisionBody();
      await fs.writeFile(sourcePath, sourceText, "utf8");
      commitWorkspace(workspaceRoot, "record discard candidate");
      const headReference = runGit(workspaceRoot, [
        "symbolic-ref",
        "--quiet",
        "HEAD"
      ]).trim();
      await fs.writeFile(
        path.join(workspaceRoot, ".git", ...headReference.split("/")),
        "not-a-commit\n",
        "utf8"
      );

      const discarded = await runSourceCli([
        "discard",
        sourceRelativePath,
        "--root",
        workspaceRoot
      ]);

      assert.equal(discarded.exitCode, 1);
      assert.match(discarded.stderr, /Failed to inspect Git HEAD/);
      assert.equal(await fs.readFile(sourcePath, "utf8"), sourceText);
      assert.equal(await fs.readFile(indexPath, "utf8"), originalIndexText);
    }
  ));

test("discard flag deletes a recorded decision without reading Git HEAD", () =>
  withGitFixtureWorkspace(
    "candidate-discard-flag-corrupt-head",
    async (workspaceRoot) => {
      const sourceRelativePath = "use-flagged-discard-candidate";
      const sourcePath = decisionFilePath(workspaceRoot, sourceRelativePath);
      await fs.writeFile(sourcePath, candidateDecisionBody(), "utf8");
      commitWorkspace(workspaceRoot, "record flagged discard candidate");
      const headReference = runGit(workspaceRoot, [
        "symbolic-ref",
        "--quiet",
        "HEAD"
      ]).trim();
      await fs.writeFile(
        path.join(workspaceRoot, ".git", ...headReference.split("/")),
        "not-a-commit\n",
        "utf8"
      );

      const discarded = await runSourceCli([
        "discard",
        sourceRelativePath,
        "--delete-recorded",
        "--root",
        workspaceRoot
      ]);

      assert.equal(discarded.exitCode, 0, discarded.stderr);
      assert.equal(await fileExists(sourcePath), false);
    }
  ));

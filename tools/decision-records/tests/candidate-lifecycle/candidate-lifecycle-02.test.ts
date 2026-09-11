import {
  assert,
  assertRejectedDiscardPreserves,
  candidateDecisionBody,
  commitWorkspace,
  currentRelativePath,
  decisionFilePath,
  fileExists,
  fs,
  path,
  runGit,
  runSourceCli,
  runSuccessfulSourceLifecycleCli,
  test,
  withFixtureWorkspace,
  withGitFixtureWorkspace
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
          relations: [{ type: "修订", target: invalidTargetRelativePath }]
        }),
        "utf8"
      );

      await assertRejectedDiscardPreserves({
        decisionPath: sourcePath,
        expectedError: /target is not a valid scanned decision/,
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

test("discard rejects a candidate that is still referenced without mutation", () =>
  withFixtureWorkspace(
    "candidate-discard-referenced",
    async (workspaceRoot) => {
      const indexPath = path.join(
        workspaceRoot,
        "docs",
        "decisions",
        "decision-index.json"
      );
      const targetRelativePath = "use-discard-candidate-target";
      const targetPath = decisionFilePath(workspaceRoot, targetRelativePath);
      const targetText = candidateDecisionBody();
      await fs.writeFile(targetPath, targetText, "utf8");

      const sourceRelativePath = "use-candidate-target-discard-source";
      const sourcePath = decisionFilePath(workspaceRoot, sourceRelativePath);
      const sourceText = candidateDecisionBody({
        relations: [{ type: "修订", target: targetRelativePath }]
      });
      await fs.writeFile(sourcePath, sourceText, "utf8");
      await assertRejectedDiscardPreserves({
        decisionPath: targetPath,
        expectedError: /still referenced/,
        indexPath,
        relativePath: targetRelativePath,
        workspaceRoot
      });
      assert.equal(await fs.readFile(targetPath, "utf8"), targetText);
      assert.equal(await fs.readFile(sourcePath, "utf8"), sourceText);
    }
  ));

test("discard rejects an established decision that is still referenced without mutation", () =>
  withFixtureWorkspace(
    "established-discard-referenced",
    async (workspaceRoot) => {
      const indexPath = path.join(
        workspaceRoot,
        "docs",
        "decisions",
        "decision-index.json"
      );
      const successorRelativePath = "use-established-discard-source";
      const successorPath = decisionFilePath(
        workspaceRoot,
        successorRelativePath
      );
      await fs.writeFile(
        successorPath,
        candidateDecisionBody({
          relations: [{ type: "修订", target: currentRelativePath }]
        }),
        "utf8"
      );
      await runSuccessfulSourceLifecycleCli([
        "activate",
        successorRelativePath,
        "--alignment",
        "aligned",
        "--root",
        workspaceRoot
      ]);

      const archivedTargetPath = decisionFilePath(
        workspaceRoot,
        "archive/" + currentRelativePath
      );
      const archivedTargetText = await fs.readFile(archivedTargetPath, "utf8");
      const successorText = await fs.readFile(successorPath, "utf8");
      const indexText = await fs.readFile(indexPath, "utf8");
      await assertRejectedDiscardPreserves({
        decisionPath: archivedTargetPath,
        expectedError: /still referenced/,
        indexPath,
        relativePath: currentRelativePath,
        workspaceRoot
      });
      assert.equal(
        await fs.readFile(archivedTargetPath, "utf8"),
        archivedTargetText
      );
      assert.equal(await fs.readFile(successorPath, "utf8"), successorText);
      assert.equal(await fs.readFile(indexPath, "utf8"), indexText);
    }
  ));

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
        "--delete-recorded-decision",
        "--root",
        workspaceRoot
      ]);

      assert.equal(discarded.exitCode, 0, discarded.stderr);
      assert.equal(await fileExists(sourcePath), false);
    }
  ));

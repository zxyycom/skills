import {
  applyDecisionChanges,
  assert,
  currentDecisionId,
  currentSourcePath,
  decisionFilePath,
  executeDecisionQuery,
  fs,
  isDecisionId,
  path,
  readDecisionStateSnapshot,
  replaceWithUnsafeEntry,
  scanDecisionRecords,
  test,
  unsafeEntries,
  withFixtureWorkspace
} from "./support.ts";

test("indexed source loading rejects symlink and non-regular decision files before reading them", async (t) => {
  for (const entry of unsafeEntries) {
    await withFixtureWorkspace(
      `indexed-source-${entry}`,
      async (workspaceRoot) => {
        const decisionsDirectory = path.join(
          workspaceRoot,
          "docs",
          "decisions"
        );
        const sourcePath = decisionFilePath(workspaceRoot, currentSourcePath);
        const outsidePath = path.join(workspaceRoot, "outside-decision.md");
        const outsideText = "outside decision content\n";
        await fs.writeFile(outsidePath, outsideText, "utf8");
        if (
          !(await replaceWithUnsafeEntry({ entry, outsidePath, sourcePath }))
        ) {
          t.skip("symlinks are unavailable on this platform");
          return;
        }

        await assert.rejects(
          readDecisionStateSnapshot(decisionsDirectory, [currentDecisionId]),
          /regular non-symbolic-link file/
        );
        assert.equal(await fs.readFile(outsidePath, "utf8"), outsideText);
      }
    );
  }
});

test("decision show rejects symlink and non-regular bodies without reading outside the decisions directory", async (t) => {
  for (const entry of unsafeEntries) {
    await withFixtureWorkspace(`query-body-${entry}`, async (workspaceRoot) => {
      const sourcePath = decisionFilePath(workspaceRoot, currentSourcePath);
      const outsidePath = path.join(workspaceRoot, "outside-decision.md");
      const outsideText = "outside decision content\n";
      await fs.writeFile(outsidePath, outsideText, "utf8");
      if (!(await replaceWithUnsafeEntry({ entry, outsidePath, sourcePath }))) {
        t.skip("symlinks are unavailable on this platform");
        return;
      }
      if (!isDecisionId(currentDecisionId)) {
        throw new Error("test fixture has an invalid Decision ID");
      }

      const result = await executeDecisionQuery({
        command: "show",
        decisionId: currentDecisionId,
        location: { decisionsDir: "docs/decisions", workspaceRoot }
      });
      assert.equal(result.status, "error");
      assert.equal(result.exitCode, 1);
      assert.ok(
        result.diagnostics.some(
          (diagnostic) =>
            diagnostic.code === "decision-records.decision-body-unavailable" &&
            diagnostic.target === currentSourcePath
        )
      );
      assert.equal(await fs.readFile(outsidePath, "utf8"), outsideText);
    });
  }
});

test("decision transactions reject symlink and non-regular sources before writing any target", async (t) => {
  for (const entry of unsafeEntries) {
    await withFixtureWorkspace(
      `transaction-source-${entry}`,
      async (workspaceRoot) => {
        const sourcePath = decisionFilePath(workspaceRoot, currentSourcePath);
        const sourceText = await fs.readFile(sourcePath, "utf8");
        const indexPath = path.join(
          workspaceRoot,
          "docs",
          "decisions",
          "decision-index.json"
        );
        const indexText = await fs.readFile(indexPath, "utf8");
        const outsidePath = path.join(workspaceRoot, "outside-decision.md");
        const outsideText = "outside decision content\n";
        await fs.writeFile(outsidePath, outsideText, "utf8");
        const originalScan = await scanDecisionRecords({ workspaceRoot });
        if (
          !(await replaceWithUnsafeEntry({ entry, outsidePath, sourcePath }))
        ) {
          t.skip("symlinks are unavailable on this platform");
          return;
        }

        const result = await applyDecisionChanges({
          changes: [
            {
              decisionPath: sourcePath,
              expectedText: sourceText,
              nextText: sourceText.replace(
                "alignment: aligned",
                "alignment: unaligned"
              )
            }
          ],
          originalScan,
          scanOptions: { workspaceRoot }
        });
        assert.ok(
          result.errors.some(
            (error) =>
              error.includes(
                "Failed to verify decision source before update"
              ) &&
              error.includes("regular non-symbolic-link file") &&
              error.includes("No files were written")
          )
        );
        assert.equal(await fs.readFile(indexPath, "utf8"), indexText);
        assert.equal(await fs.readFile(outsidePath, "utf8"), outsideText);
        const sourceEntry = await fs.lstat(sourcePath);
        assert.equal(sourceEntry.isDirectory(), entry === "directory");
        assert.equal(sourceEntry.isSymbolicLink(), entry === "symlink");
      }
    );
  }
});

test("scan reports an empty decision index as an actionable index diagnostic", () =>
  withFixtureWorkspace("scan-empty-index", async (workspaceRoot) => {
    const indexPath = path.join(
      workspaceRoot,
      "docs",
      "decisions",
      "decision-index.json"
    );
    await fs.writeFile(indexPath, "", "utf8");

    const scan = await scanDecisionRecords({ workspaceRoot });
    assert.equal(scan.indexExists, true);
    assert.ok(
      scan.indexErrors.some(
        (error) =>
          error.includes("decision-index.json") &&
          error.includes("JSON Parse error: Unexpected EOF")
      )
    );
  }));

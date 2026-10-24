import {
  applyDecisionChanges,
  interceptDecisionWrites,
  archivedDecisionId,
  assert,
  currentSourcePath,
  decisionFilePath,
  fs,
  path,
  scanDecisionRecords,
  test,
  withFixtureWorkspace
} from "./support.ts";

test("decision transaction stops with recovery diagnostics when a restore write also fails", () =>
  withFixtureWorkspace(
    "transaction-incomplete-recovery",
    async (workspaceRoot) => {
      const currentPath = decisionFilePath(workspaceRoot, currentSourcePath);
      const archivedPath = decisionFilePath(
        workspaceRoot,
        `archive/${archivedDecisionId}`
      );
      const indexPath = path.join(
        workspaceRoot,
        "docs",
        "decisions",
        "decision-index.json"
      );
      const currentBefore = await fs.readFile(currentPath, "utf8");
      const archivedBefore = await fs.readFile(archivedPath, "utf8");
      const indexBefore = await fs.readFile(indexPath, "utf8");
      let updateFailed = false;
      let restoreFailed = false;
      const restoreWrites = interceptDecisionWrites(async (file) => {
        if (path.resolve(file) === archivedPath && !updateFailed) {
          updateFailed = true;
          throw new Error("simulated transaction write failure");
        }
        if (
          path.resolve(file) === currentPath &&
          updateFailed &&
          !restoreFailed
        ) {
          restoreFailed = true;
          throw new Error("simulated restore write failure");
        }
      });
      let result: Awaited<ReturnType<typeof applyDecisionChanges>>;
      try {
        result = await applyDecisionChanges({
          changes: [
            {
              decisionPath: currentPath,
              expectedText: currentBefore,
              nextText: currentBefore.replace(
                "使用生成 CLI",
                "使用生成命令行工具"
              )
            },
            {
              decisionPath: archivedPath,
              expectedText: archivedBefore,
              nextText: archivedBefore.replace(
                "使用源码 CLI",
                "使用源码命令行工具"
              )
            }
          ],
          originalScan: await scanDecisionRecords({ workspaceRoot })
        });
      } finally {
        restoreWrites();
      }
      assert.equal(result!.status, "error");
      assert.equal(result!.outcome, "partial-or-unknown");
      assert.ok(
        result!.errors.some((error) =>
          error.includes("simulated transaction write failure")
        )
      );
      assert.ok(
        result!.errors.some((error) =>
          error.includes("simulated restore write failure")
        )
      );
      assert.notEqual(await fs.readFile(currentPath, "utf8"), currentBefore);
      assert.equal(await fs.readFile(archivedPath, "utf8"), archivedBefore);
      assert.equal(await fs.readFile(indexPath, "utf8"), indexBefore);
    }
  ));

test("decision transaction rejects a changed Markdown source before any write", () =>
  withFixtureWorkspace("transaction-source-conflict", async (workspaceRoot) => {
    const currentPath = decisionFilePath(workspaceRoot, currentSourcePath);
    const archivedPath = decisionFilePath(
      workspaceRoot,
      `archive/${archivedDecisionId}`
    );
    const indexPath = path.join(
      workspaceRoot,
      "docs",
      "decisions",
      "decision-index.json"
    );
    const currentBefore = await fs.readFile(currentPath, "utf8");
    const archivedBefore = await fs.readFile(archivedPath, "utf8");
    const indexBefore = await fs.readFile(indexPath, "utf8");
    const concurrent = currentBefore.replace(
      "使用生成 CLI",
      "并发修改生成 CLI"
    );
    const scan = await scanDecisionRecords({ workspaceRoot });
    await fs.writeFile(currentPath, concurrent, "utf8");
    const result = await applyDecisionChanges({
      changes: [
        {
          decisionPath: currentPath,
          expectedText: currentBefore,
          nextText: currentBefore
        },
        {
          decisionPath: archivedPath,
          expectedText: archivedBefore,
          nextText: archivedBefore.replace("使用源码 CLI", "使用源码命令行工具")
        }
      ],
      originalScan: scan
    });
    assert.equal(result.status, "error");
    assert.equal(result.outcome, "no-change");
    assert.ok(
      result.errors.some((error) => error.includes("changed after validation"))
    );
    assert.equal(await fs.readFile(currentPath, "utf8"), concurrent);
    assert.equal(await fs.readFile(archivedPath, "utf8"), archivedBefore);
    assert.equal(await fs.readFile(indexPath, "utf8"), indexBefore);
  }));

test("decision transaction rejects a changed index before any write", () =>
  withFixtureWorkspace("transaction-index-conflict", async (workspaceRoot) => {
    const currentPath = decisionFilePath(workspaceRoot, currentSourcePath);
    const indexPath = path.join(
      workspaceRoot,
      "docs",
      "decisions",
      "decision-index.json"
    );
    const currentBefore = await fs.readFile(currentPath, "utf8");
    const indexBefore = await fs.readFile(indexPath, "utf8");
    const scan = await scanDecisionRecords({ workspaceRoot });
    await fs.writeFile(indexPath, indexBefore + "\n", "utf8");
    const result = await applyDecisionChanges({
      changes: [
        {
          decisionPath: currentPath,
          expectedText: currentBefore,
          nextText: currentBefore.replace("使用生成 CLI", "使用生成命令行工具")
        }
      ],
      originalScan: scan
    });
    assert.equal(result.status, "error");
    assert.equal(result.outcome, "no-change");
    assert.ok(
      result.errors.some((error) => error.includes("changed after validation"))
    );
    assert.equal(await fs.readFile(currentPath, "utf8"), currentBefore);
    assert.equal(await fs.readFile(indexPath, "utf8"), indexBefore + "\n");
  }));

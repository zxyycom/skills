import {
  applyDecisionChanges,
  archivedDecisionId,
  assert,
  currentDecisionId,
  currentSourcePath,
  decisionFilePath,
  fileExists,
  fs,
  path,
  scanDecisionRecords,
  test,
  withFixtureWorkspace
} from "./support.ts";

test("transaction recovery restores source path target path and index after a post-write failure", () =>
  withFixtureWorkspace("transaction-move-recovery", async (workspaceRoot) => {
    const sourcePath = decisionFilePath(workspaceRoot, currentSourcePath);
    const targetPath = decisionFilePath(
      workspaceRoot,
      `archive/${currentDecisionId}`
    );
    const indexPath = path.join(
      workspaceRoot,
      "docs",
      "decisions",
      "decision-index.json"
    );
    const sourceBefore = await fs.readFile(sourcePath, "utf8");
    const indexBefore = await fs.readFile(indexPath, "utf8");
    const descriptor = Object.getOwnPropertyDescriptor(fs, "rename");
    assert.ok(descriptor);
    const originalRename = fs.rename.bind(fs);
    Object.defineProperty(fs, "rename", {
      ...descriptor,
      value: async (from: string, to: string): Promise<void> => {
        await originalRename(from, to);
        if (path.resolve(to) === indexPath) {
          throw Object.assign(
            new Error("simulated index replacement failure"),
            {
              code: "EIO"
            }
          );
        }
      }
    });
    try {
      const result = await applyDecisionChanges({
        changes: [
          {
            decisionPath: sourcePath,
            expectedText: sourceBefore,
            nextText: sourceBefore.replace(
              "status: active",
              "status: archived"
            ),
            targetPath
          }
        ],
        originalScan: await scanDecisionRecords({ workspaceRoot }),
        scanOptions: { workspaceRoot }
      });
      assert.equal(result.status, "error");
      assert.equal(result.outcome, "rolled-back");
      assert.ok(
        result.diagnostics.some(
          (diagnostic) =>
            diagnostic.code === "decision-records.transaction-failed" &&
            diagnostic.causeCategory === "unknown" &&
            diagnostic.detail === "simulated index replacement failure"
        )
      );
      assert.ok(
        result.errors.some((error) =>
          error.includes("simulated index replacement failure")
        )
      );
    } finally {
      Object.defineProperty(fs, "rename", descriptor);
    }
    assert.equal(await fileExists(sourcePath), true);
    assert.equal(await fileExists(targetPath), false);
    assert.equal(await fs.readFile(sourcePath, "utf8"), sourceBefore);
    assert.equal(await fs.readFile(indexPath, "utf8"), indexBefore);
  }));

test("decision transaction restores every changed Markdown file and index after a write failure", () =>
  withFixtureWorkspace("transaction-write-recovery", async (workspaceRoot) => {
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
    const descriptor = Object.getOwnPropertyDescriptor(fs, "rename");
    assert.ok(descriptor);
    const rename = fs.rename.bind(fs);
    Object.defineProperty(fs, "rename", {
      ...descriptor,
      value: async (from: string, to: string) => {
        await rename(from, to);
        if (path.resolve(to) === indexPath) {
          throw Object.assign(
            new Error("simulated index failure after replacement"),
            { code: "EIO" }
          );
        }
      }
    });
    try {
      const result = await applyDecisionChanges({
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
        originalScan: await scanDecisionRecords({ workspaceRoot }),
        scanOptions: { workspaceRoot }
      });
      assert.equal(result.status, "error");
      assert.equal(result.outcome, "rolled-back");
      assert.ok(
        result.diagnostics.some(
          (diagnostic) =>
            diagnostic.code === "decision-records.transaction-failed" &&
            diagnostic.causeCategory === "unknown" &&
            diagnostic.detail === "simulated index failure after replacement"
        )
      );
      assert.ok(
        result.errors.some((error) =>
          error.includes("simulated index failure after replacement")
        )
      );
    } finally {
      Object.defineProperty(fs, "rename", descriptor);
    }
    assert.equal(await fs.readFile(currentPath, "utf8"), currentBefore);
    assert.equal(await fs.readFile(archivedPath, "utf8"), archivedBefore);
    assert.equal(await fs.readFile(indexPath, "utf8"), indexBefore);
  }));

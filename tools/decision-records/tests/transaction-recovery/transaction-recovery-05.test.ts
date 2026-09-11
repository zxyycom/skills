import {
  applyDecisionChanges,
  assert,
  currentDecisionId,
  currentSourcePath,
  decisionFilePath,
  fs,
  path,
  runSourceCli,
  runSourceLifecycleCli,
  scanDecisionRecords,
  test,
  withFixtureWorkspace
} from "./support.ts";

test("decision transaction retains rolled-back when lock release fails after recovery", () =>
  withFixtureWorkspace(
    "collection-lock-release-rolled-back",
    async (workspaceRoot) => {
      const sourcePath = decisionFilePath(workspaceRoot, currentSourcePath);
      const indexPath = path.join(
        workspaceRoot,
        "docs",
        "decisions",
        "decision-index.json"
      );
      const sourceBefore = await fs.readFile(sourcePath, "utf8");
      const renameDescriptor = Object.getOwnPropertyDescriptor(fs, "rename");
      const removeDescriptor = Object.getOwnPropertyDescriptor(fs, "rm");
      assert.ok(renameDescriptor);
      assert.ok(removeDescriptor);
      const rename = fs.rename.bind(fs);
      const remove = fs.rm.bind(fs);
      let indexWriteFailed = false;
      let releaseBlocked = false;
      Object.defineProperty(fs, "rename", {
        ...renameDescriptor,
        value: async (...args: Parameters<typeof fs.rename>) => {
          await rename(...args);
          if (
            path.resolve(String(args[1])) === indexPath &&
            !indexWriteFailed
          ) {
            indexWriteFailed = true;
            throw new Error("simulated index write failure");
          }
        }
      });
      Object.defineProperty(fs, "rm", {
        ...removeDescriptor,
        value: async (...args: Parameters<typeof fs.rm>) => {
          if (
            String(args[0]).endsWith(".decision-index.json.mutation.lock") &&
            !releaseBlocked
          ) {
            releaseBlocked = true;
            throw Object.assign(new Error("simulated lock release failure"), {
              code: "EACCES"
            });
          }
          return await remove(...args);
        }
      });
      let result: Awaited<ReturnType<typeof applyDecisionChanges>>;
      try {
        result = await applyDecisionChanges({
          changes: [
            {
              decisionPath: sourcePath,
              expectedText: sourceBefore,
              nextText: sourceBefore.replace("使用生成 CLI", "回滚后的生成 CLI")
            }
          ],
          originalScan: await scanDecisionRecords({ workspaceRoot }),
          scanOptions: { workspaceRoot }
        });
      } finally {
        Object.defineProperty(fs, "rename", renameDescriptor);
        Object.defineProperty(fs, "rm", removeDescriptor);
      }
      assert.equal(indexWriteFailed, true);
      assert.equal(releaseBlocked, true);
      assert.equal(result!.status, "error");
      assert.equal(result!.outcome, "rolled-back");
      assert.ok(
        result!.diagnostics.some(
          (diagnostic) =>
            diagnostic.code ===
              "decision-records.collection-lock-release-failed" &&
            diagnostic.outcome === "rolled-back"
        )
      );
      assert.equal(await fs.readFile(sourcePath, "utf8"), sourceBefore);
      await fs.rm(
        path.join(workspaceRoot, "docs", ".decision-index.json.mutation.lock"),
        { force: true }
      );
    }
  ));

test("sync-index retains no-change when a current index lock release fails", () =>
  withFixtureWorkspace(
    "collection-lock-release-current",
    async (workspaceRoot) => {
      const descriptor = Object.getOwnPropertyDescriptor(fs, "rm");
      assert.ok(descriptor);
      const remove = fs.rm.bind(fs);
      let releaseBlocked = false;
      Object.defineProperty(fs, "rm", {
        ...descriptor,
        value: async (...args: Parameters<typeof fs.rm>) => {
          if (
            String(args[0]).endsWith(".decision-index.json.mutation.lock") &&
            !releaseBlocked
          ) {
            releaseBlocked = true;
            throw Object.assign(new Error("simulated lock release failure"), {
              code: "EACCES"
            });
          }
          return await remove(...args);
        }
      });
      let result: Awaited<ReturnType<typeof runSourceCli>>;
      try {
        result = await runSourceCli(["sync-index", "--root", workspaceRoot]);
      } finally {
        Object.defineProperty(fs, "rm", descriptor);
      }
      assert.equal(releaseBlocked, true);
      assert.equal(result!.exitCode, 1);
      assert.equal(result!.stdout, "");
      assert.match(
        result!.stderr,
        /code: decision-records\.collection-lock-release-failed/
      );
      assert.match(result!.stderr, /outcome: no-change/);
      assert.doesNotMatch(result!.stderr, /outcome: committed-cleanup-pending/);
      await fs.rm(
        path.join(workspaceRoot, "docs", ".decision-index.json.mutation.lock"),
        { force: true }
      );
    }
  ));

test("lifecycle rolls back and does not print success when its post-write index check fails", () =>
  withFixtureWorkspace("post-mutation-scan", async (workspaceRoot) => {
    const decisionsDirectory = path.join(workspaceRoot, "docs", "decisions");
    const indexPath = path.join(decisionsDirectory, "decision-index.json");
    const renameDescriptor = Object.getOwnPropertyDescriptor(fs, "rename");
    const readdirDescriptor = Object.getOwnPropertyDescriptor(fs, "readdir");
    assert.ok(renameDescriptor);
    assert.ok(readdirDescriptor);
    const rename = fs.rename.bind(fs);
    const readdir = fs.readdir.bind(fs);
    let indexWritten = false;
    let rootReadsAfterIndexWrite = 0;
    Object.defineProperty(fs, "rename", {
      ...renameDescriptor,
      value: async (...args: Parameters<typeof fs.rename>) => {
        await rename(...args);
        if (path.resolve(String(args[1])) === indexPath) {
          indexWritten = true;
        }
      }
    });
    Object.defineProperty(fs, "readdir", {
      ...readdirDescriptor,
      value: async (...args: Parameters<typeof fs.readdir>) => {
        if (
          indexWritten &&
          path.resolve(String(args[0])) === decisionsDirectory
        ) {
          rootReadsAfterIndexWrite += 1;
          if (rootReadsAfterIndexWrite === 2) {
            throw new Error("simulated post-mutation decision scan failure");
          }
        }
        return await readdir(...args);
      }
    });
    try {
      const result = await runSourceLifecycleCli([
        "archive",
        currentDecisionId,
        "--root",
        workspaceRoot
      ]);
      assert.equal(indexWritten, true);
      assert.equal(result.exitCode, 1);
      assert.equal(result.stdout, "");
      assert.match(result.stderr, /code: decision-records\.transaction-failed/);
      assert.match(result.stderr, /outcome: rolled-back/);
    } finally {
      Object.defineProperty(fs, "rename", renameDescriptor);
      Object.defineProperty(fs, "readdir", readdirDescriptor);
    }
  }));

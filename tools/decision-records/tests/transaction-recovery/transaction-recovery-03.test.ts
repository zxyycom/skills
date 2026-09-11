import {
  applyDecisionChanges,
  assert,
  currentDecisionId,
  currentSourcePath,
  decisionFilePath,
  findIndexEntry,
  fs,
  path,
  readIndex,
  runSourceCli,
  scanDecisionRecords,
  test,
  validateDecisionRecords,
  withFixtureWorkspace
} from "./support.ts";

test("sync-index fails while a decision transaction holds the collection lock", () =>
  withFixtureWorkspace("transaction-sync-index-lock", async (workspaceRoot) => {
    const currentPath = decisionFilePath(workspaceRoot, currentSourcePath);
    const indexPath = path.join(
      workspaceRoot,
      "docs",
      "decisions",
      "decision-index.json"
    );
    const currentBefore = await fs.readFile(currentPath, "utf8");
    const indexBefore = await fs.readFile(indexPath, "utf8");
    const descriptor = Object.getOwnPropertyDescriptor(fs, "writeFile");
    assert.ok(descriptor);
    const writeFile = fs.writeFile.bind(fs);
    let releaseWrite: () => void = () => {};
    let signalBlocked: () => void = () => {};
    let blocked = false;
    const writeBlocked = new Promise<void>((resolve) => {
      signalBlocked = resolve;
    });
    Object.defineProperty(fs, "writeFile", {
      ...descriptor,
      value: async (
        filePath: string,
        data: string,
        encoding: BufferEncoding
      ): Promise<void> => {
        if (!blocked && path.resolve(filePath) === currentPath) {
          blocked = true;
          signalBlocked();
          await new Promise<void>((resolve) => {
            releaseWrite = resolve;
          });
        }
        await writeFile(filePath, data, encoding);
      }
    });
    let transaction:
      | Promise<Awaited<ReturnType<typeof applyDecisionChanges>>>
      | undefined;
    try {
      transaction = applyDecisionChanges({
        changes: [
          {
            decisionPath: currentPath,
            expectedText: currentBefore,
            nextText: currentBefore.replace(
              "使用生成 CLI",
              "持锁时更新的生成 CLI"
            )
          }
        ],
        originalScan: await scanDecisionRecords({ workspaceRoot }),
        scanOptions: { workspaceRoot }
      });
      await writeBlocked;

      const blockedSync = await runSourceCli([
        "sync-index",
        "--root",
        workspaceRoot
      ]);
      assert.equal(blockedSync.exitCode, 1);
      assert.match(
        blockedSync.stderr,
        /code: decision-records\.collection-lock-busy/
      );
      assert.equal(await fs.readFile(indexPath, "utf8"), indexBefore);

      releaseWrite();
      assert.equal((await transaction).status, "ok");
    } finally {
      releaseWrite();
      Object.defineProperty(fs, "writeFile", descriptor);
    }

    const retriedSync = await runSourceCli([
      "sync-index",
      "--root",
      workspaceRoot
    ]);
    assert.equal(retriedSync.exitCode, 0, retriedSync.stderr);
    assert.equal(
      findIndexEntry(await readIndex(indexPath), currentDecisionId).title,
      "持锁时更新的生成 CLI"
    );
    assert.deepEqual(
      (await validateDecisionRecords({ workspaceRoot })).errors,
      []
    );
  }));

test("decision transaction fails while sync-index holds the collection lock", () =>
  withFixtureWorkspace("sync-index-transaction-lock", async (workspaceRoot) => {
    const currentPath = decisionFilePath(workspaceRoot, currentSourcePath);
    const indexPath = path.join(
      workspaceRoot,
      "docs",
      "decisions",
      "decision-index.json"
    );
    const currentBefore = await fs.readFile(currentPath, "utf8");
    const synchronizedSource = currentBefore.replace(
      "使用生成 CLI",
      "同步中的生成 CLI"
    );
    await fs.writeFile(currentPath, synchronizedSource, "utf8");
    const indexBefore = await fs.readFile(indexPath, "utf8");
    const descriptor = Object.getOwnPropertyDescriptor(fs, "rename");
    assert.ok(descriptor);
    const rename = fs.rename.bind(fs);
    let releaseRename: () => void = () => {};
    let signalBlocked: () => void = () => {};
    let blocked = false;
    const renameBlocked = new Promise<void>((resolve) => {
      signalBlocked = resolve;
    });
    Object.defineProperty(fs, "rename", {
      ...descriptor,
      value: async (from: string, to: string): Promise<void> => {
        if (!blocked && path.resolve(to) === indexPath) {
          blocked = true;
          signalBlocked();
          await new Promise<void>((resolve) => {
            releaseRename = resolve;
          });
        }
        await rename(from, to);
      }
    });
    let synchronization:
      | Promise<Awaited<ReturnType<typeof runSourceCli>>>
      | undefined;
    try {
      synchronization = runSourceCli(["sync-index", "--root", workspaceRoot]);
      await renameBlocked;

      const transactionResult = await applyDecisionChanges({
        changes: [
          {
            decisionPath: currentPath,
            expectedText: synchronizedSource,
            nextText: synchronizedSource.replace(
              "同步中的生成 CLI",
              "事务重试后的生成 CLI"
            )
          }
        ],
        originalScan: await scanDecisionRecords({ workspaceRoot }),
        scanOptions: { workspaceRoot }
      });
      assert.ok(
        transactionResult.status === "error" &&
          transactionResult.outcome === "no-change" &&
          transactionResult.diagnostics.some(
            (diagnostic) =>
              diagnostic.code === "decision-records.collection-lock-busy"
          )
      );
      assert.equal(await fs.readFile(currentPath, "utf8"), synchronizedSource);
      assert.equal(await fs.readFile(indexPath, "utf8"), indexBefore);

      releaseRename();
      assert.equal((await synchronization).exitCode, 0);
    } finally {
      releaseRename();
      Object.defineProperty(fs, "rename", descriptor);
    }

    assert.deepEqual(
      (await validateDecisionRecords({ workspaceRoot })).errors,
      []
    );
  }));

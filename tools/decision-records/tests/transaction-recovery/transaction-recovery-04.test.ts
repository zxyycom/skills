import {
  applyDecisionChanges,
  assert,
  currentSourcePath,
  decisionFilePath,
  fs,
  path,
  runSourceCli,
  scanDecisionRecords,
  test,
  withFixtureWorkspace
} from "./support.ts";

test("decision collection lock reports busy only for an existing lock", () =>
  withFixtureWorkspace("collection-lock-cause", async (workspaceRoot) => {
    const descriptor = Object.getOwnPropertyDescriptor(fs, "open");
    assert.ok(descriptor);
    const open = fs.open.bind(fs);
    for (const scenario of [
      { causeCategory: "busy", code: "EEXIST", suffix: "busy" },
      {
        causeCategory: "access-denied",
        code: "EACCES",
        suffix: "access-denied"
      },
      { causeCategory: null, code: "EIO", suffix: "unavailable" }
    ] as const) {
      Object.defineProperty(fs, "open", {
        ...descriptor,
        value: async (...args: Parameters<typeof fs.open>) => {
          if (
            args[1] === "wx" &&
            String(args[0]).endsWith(".decision-index.json.mutation.lock")
          ) {
            const error = Object.assign(new Error("simulated lock failure"), {
              code: scenario.code
            });
            throw error;
          }
          return await open(...args);
        }
      });
      try {
        const result = await runSourceCli([
          "sync-index",
          "--root",
          workspaceRoot
        ]);
        assert.equal(result.exitCode, 1);
        assert.equal(result.stdout, "");
        assert.match(
          result.stderr,
          new RegExp(
            "code: decision-records\\.collection-lock-" + scenario.suffix
          )
        );
        if (scenario.causeCategory === null) {
          assert.doesNotMatch(result.stderr, /causeCategory: busy/);
        } else {
          assert.match(
            result.stderr,
            new RegExp("causeCategory: " + scenario.causeCategory)
          );
        }
      } finally {
        Object.defineProperty(fs, "open", descriptor);
      }
    }
  }));

test("decision transaction reports committed cleanup pending when lock release fails", () =>
  withFixtureWorkspace("collection-lock-release", async (workspaceRoot) => {
    const sourcePath = decisionFilePath(workspaceRoot, currentSourcePath);
    const sourceBefore = await fs.readFile(sourcePath, "utf8");
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
          const error = Object.assign(
            new Error("simulated lock release failure"),
            {
              code: "EACCES"
            }
          );
          throw error;
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
            nextText: sourceBefore.replace("使用生成 CLI", "释放锁后的生成 CLI")
          }
        ],
        originalScan: await scanDecisionRecords({ workspaceRoot }),
        scanOptions: { workspaceRoot }
      });
    } finally {
      Object.defineProperty(fs, "rm", descriptor);
    }
    assert.equal(releaseBlocked, true);
    assert.equal(result!.status, "error");
    assert.equal(result!.outcome, "committed-cleanup-pending");
    assert.ok(
      result!.diagnostics.some(
        (diagnostic) =>
          diagnostic.code === "decision-records.collection-lock-release-failed"
      )
    );
    assert.match(await fs.readFile(sourcePath, "utf8"), /释放锁后的生成 CLI/);
    await fs.rm(
      path.join(workspaceRoot, "docs", ".decision-index.json.mutation.lock"),
      { force: true }
    );
  }));

test("decision transaction retains no-change when lock release fails after preflight", () =>
  withFixtureWorkspace(
    "collection-lock-release-no-change",
    async (workspaceRoot) => {
      const sourcePath = decisionFilePath(workspaceRoot, currentSourcePath);
      const sourceBefore = await fs.readFile(sourcePath, "utf8");
      const originalScan = await scanDecisionRecords({ workspaceRoot });
      await fs.writeFile(
        sourcePath,
        sourceBefore.replace("使用生成 CLI", "并发修改生成 CLI"),
        "utf8"
      );
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
      let result: Awaited<ReturnType<typeof applyDecisionChanges>>;
      try {
        result = await applyDecisionChanges({
          changes: [
            {
              decisionPath: sourcePath,
              expectedText: sourceBefore,
              nextText: sourceBefore.replace("使用生成 CLI", "完成更新生成 CLI")
            }
          ],
          originalScan,
          scanOptions: { workspaceRoot }
        });
      } finally {
        Object.defineProperty(fs, "rm", descriptor);
      }
      assert.equal(releaseBlocked, true);
      assert.equal(result!.status, "error");
      assert.equal(result!.outcome, "no-change");
      assert.ok(
        result!.diagnostics.some(
          (diagnostic) =>
            diagnostic.code === "decision-records.transaction-failed"
        )
      );
      assert.ok(
        result!.diagnostics.some(
          (diagnostic) =>
            diagnostic.code ===
              "decision-records.collection-lock-release-failed" &&
            diagnostic.outcome === "no-change"
        )
      );
      await fs.rm(
        path.join(workspaceRoot, "docs", ".decision-index.json.mutation.lock"),
        { force: true }
      );
    }
  ));

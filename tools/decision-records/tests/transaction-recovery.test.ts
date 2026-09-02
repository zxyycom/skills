import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { applyDecisionChanges } from "../src/decision-transaction.ts";
import { validateDecisionRecords } from "../src/index.ts";
import { scanDecisionRecords } from "../src/scan.ts";
import {
  archivedDecisionId,
  currentDecisionId,
  currentSourcePath,
  decisionFilePath,
  fileExists,
  findIndexEntry,
  readIndex,
  runSourceCli,
  runSourceLifecycleCli,
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

/** Keep the original transaction contracts independent from lifecycle move coverage. */
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
      const descriptor = Object.getOwnPropertyDescriptor(fs, "writeFile");
      assert.ok(descriptor);
      const writeFile = fs.writeFile.bind(fs);
      let updateFailed = false;
      let restoreFailed = false;
      Object.defineProperty(fs, "writeFile", {
        ...descriptor,
        value: async (file: string, data: string, encoding: BufferEncoding) => {
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
          await writeFile(file, data, encoding);
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
              nextText: archivedBefore
            }
          ],
          originalScan: await scanDecisionRecords({ workspaceRoot }),
          scanOptions: { workspaceRoot }
        });
      } finally {
        Object.defineProperty(fs, "writeFile", descriptor);
      }
      assert.equal(result!.status, "error");
      assert.equal(result!.outcome, "partial-or-unknown");
      assert.ok(
        result!.errors.some((error) =>
          error.includes("simulated transaction write failure")
        )
      );
      assert.ok(
        result!.errors.some(
          (error) =>
            error.includes("Failed to restore decision body") &&
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
      originalScan: scan,
      scanOptions: { workspaceRoot }
    });
    assert.equal(result.status, "error");
    assert.equal(result.outcome, "no-change");
    assert.ok(
      result.errors.some(
        (error) =>
          error.includes("changed after validation") &&
          error.includes("re-run the command")
      )
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
      originalScan: scan,
      scanOptions: { workspaceRoot }
    });
    assert.equal(result.status, "error");
    assert.equal(result.outcome, "no-change");
    assert.ok(
      result.errors.some(
        (error) =>
          error.includes("decision-index.json") &&
          error.includes("changed after validation")
      )
    );
    assert.equal(await fs.readFile(currentPath, "utf8"), currentBefore);
    assert.equal(await fs.readFile(indexPath, "utf8"), indexBefore + "\n");
  }));

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

test("lifecycle does not print success when its post-mutation scan fails", () =>
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
      assert.match(
        result.stderr,
        /code: decision-records\.post-mutation-scan-failed/
      );
      assert.match(result.stderr, /outcome: partial-or-unknown/);
    } finally {
      Object.defineProperty(fs, "rename", renameDescriptor);
      Object.defineProperty(fs, "readdir", readdirDescriptor);
    }
  }));

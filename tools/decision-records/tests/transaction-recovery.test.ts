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
    let failedAfterIndexWrite = false;
    Object.defineProperty(fs, "rename", {
      ...descriptor,
      value: async (from: string, to: string): Promise<void> => {
        await originalRename(from, to);
        if (path.resolve(to) === indexPath && !failedAfterIndexWrite) {
          failedAfterIndexWrite = true;
          throw new Error("simulated index replacement failure");
        }
      }
    });
    try {
      const errors = await applyDecisionChanges({
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
      assert.equal(failedAfterIndexWrite, true);
      assert.ok(
        errors.some((error) =>
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
    let failed = false;
    Object.defineProperty(fs, "rename", {
      ...descriptor,
      value: async (from: string, to: string) => {
        await rename(from, to);
        if (path.resolve(to) === indexPath && !failed) {
          failed = true;
          throw new Error("simulated index failure after replacement");
        }
      }
    });
    try {
      const errors = await applyDecisionChanges({
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
      assert.equal(failed, true);
      assert.ok(
        errors.some((error) =>
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
      let errors: string[];
      try {
        errors = await applyDecisionChanges({
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
      assert.ok(
        errors!.some((error) =>
          error.includes("simulated transaction write failure")
        )
      );
      assert.ok(
        errors!.some(
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
    const errors = await applyDecisionChanges({
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
    assert.ok(
      errors.some(
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
    const errors = await applyDecisionChanges({
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
    assert.ok(
      errors.some(
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
    let transaction: Promise<string[]> | undefined;
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
        /could not acquire decision collection mutation lock.*retry after the active transaction completes/i
      );
      assert.equal(await fs.readFile(indexPath, "utf8"), indexBefore);

      releaseWrite();
      assert.deepEqual(await transaction, []);
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

      const transactionErrors = await applyDecisionChanges({
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
        transactionErrors.some((error) =>
          /could not acquire decision collection mutation lock.*retry after the active transaction completes/i.test(
            error
          )
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

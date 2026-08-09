import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { applyDecisionChanges } from "../src/decision-transaction.ts";
import { scanDecisionRecords } from "../src/scan.ts";
import {
  archivedRelativePath,
  currentRelativePath,
  decisionFilePath,
  withFixtureWorkspace
} from "./support.ts";

test("decision transaction restores every changed Markdown file and index after a write failure", () => (
  withFixtureWorkspace("transaction-write-recovery", async (workspaceRoot) => {
  const currentPath = decisionFilePath(workspaceRoot, currentRelativePath);
  const archivedPath = decisionFilePath(workspaceRoot, archivedRelativePath);
  const indexPath = path.join(
    workspaceRoot,
    "docs",
    "decisions",
    "decision-index.json"
  );
  const currentBefore = await fs.readFile(currentPath, "utf8");
  const archivedBefore = await fs.readFile(archivedPath, "utf8");
  const indexBefore = await fs.readFile(indexPath, "utf8");
  const currentNext = currentBefore.replace(
    "title: 使用生成 CLI",
    "title: 使用生成命令行工具"
  );
  const archivedNext = archivedBefore.replace(
    "title: 使用源码 CLI",
    "title: 使用源码命令行工具"
  );
  assert.notEqual(currentNext, currentBefore);
  assert.notEqual(archivedNext, archivedBefore);

  const descriptor = Object.getOwnPropertyDescriptor(fs, "rename");
  assert.ok(descriptor);
  const originalRename = fs.rename.bind(fs);
  let replacedIndex = false;
  Object.defineProperty(fs, "rename", {
    ...descriptor,
    value: async (
      sourcePath: string,
      targetPath: string
    ): Promise<void> => {
      await originalRename(sourcePath, targetPath);
      if (path.resolve(targetPath) === indexPath && !replacedIndex) {
        replacedIndex = true;
        assert.notEqual(await fs.readFile(indexPath, "utf8"), indexBefore);
        throw new Error("simulated index failure after replacement");
      }
    }
  });
  try {
    const errors = await applyDecisionChanges({
      changes: [
        { decisionPath: currentPath, nextText: currentNext },
        { decisionPath: archivedPath, nextText: archivedNext }
      ],
      originalScan: await scanDecisionRecords({ workspaceRoot }),
      scanOptions: { workspaceRoot }
    });
    assert.equal(replacedIndex, true);
    assert.ok(errors.some((error) => (
      error.includes("failed to write decision-index.json")
      && error.includes("simulated index failure after replacement")
    )));
  } finally {
    Object.defineProperty(fs, "rename", descriptor);
  }

  assert.equal(await fs.readFile(currentPath, "utf8"), currentBefore);
  assert.equal(await fs.readFile(archivedPath, "utf8"), archivedBefore);
  assert.equal(await fs.readFile(indexPath, "utf8"), indexBefore);
  })
));

test("decision transaction stops with recovery diagnostics when a restore write also fails", () => (
  withFixtureWorkspace("transaction-incomplete-recovery", async (workspaceRoot) => {
  const currentPath = decisionFilePath(workspaceRoot, currentRelativePath);
  const archivedPath = decisionFilePath(workspaceRoot, archivedRelativePath);
  const indexPath = path.join(
    workspaceRoot,
    "docs",
    "decisions",
    "decision-index.json"
  );
  const currentBefore = await fs.readFile(currentPath, "utf8");
  const archivedBefore = await fs.readFile(archivedPath, "utf8");
  const indexBefore = await fs.readFile(indexPath, "utf8");
  const currentNext = currentBefore.replace(
    "title: 使用生成 CLI",
    "title: 使用生成命令行工具"
  );
  assert.notEqual(currentNext, currentBefore);

  const descriptor = Object.getOwnPropertyDescriptor(fs, "writeFile");
  assert.ok(descriptor);
  const originalWriteFile = fs.writeFile.bind(fs);
  let updateFailed = false;
  let restoreFailed = false;
  Object.defineProperty(fs, "writeFile", {
    ...descriptor,
    value: async (
      filePath: string,
      data: string,
      encoding: BufferEncoding
    ): Promise<void> => {
      const resolvedPath = path.resolve(filePath);
      if (resolvedPath === archivedPath && !updateFailed) {
        updateFailed = true;
        throw new Error("simulated transaction write failure");
      }
      if (resolvedPath === currentPath && updateFailed && !restoreFailed) {
        restoreFailed = true;
        throw new Error("simulated restore write failure");
      }
      await originalWriteFile(filePath, data, encoding);
    }
  });
  let errors: string[] = [];
  try {
    errors = await applyDecisionChanges({
      changes: [
        { decisionPath: currentPath, nextText: currentNext },
        { decisionPath: archivedPath, nextText: archivedBefore }
      ],
      originalScan: await scanDecisionRecords({ workspaceRoot }),
      scanOptions: { workspaceRoot }
    });
  } finally {
    Object.defineProperty(fs, "writeFile", descriptor);
  }

  assert.ok(errors.some((error) => error.includes(
    "simulated transaction write failure"
  )));
  assert.ok(errors.some((error) => error.includes(
    "Failed to restore decision body"
  ) && error.includes("simulated restore write failure")));
  assert.equal(await fs.readFile(currentPath, "utf8"), currentNext);
  assert.equal(await fs.readFile(archivedPath, "utf8"), archivedBefore);
  assert.equal(await fs.readFile(indexPath, "utf8"), indexBefore);
  })
));

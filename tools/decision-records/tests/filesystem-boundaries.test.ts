import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { readDecisionStateSnapshot } from "../src/decision-index-source.ts";
import { isDecisionId } from "../src/decision-path.ts";
import { executeDecisionQuery } from "../src/decision-query-service.ts";
import { scanDecisionRecords } from "../src/scan.ts";
import { applyDecisionChanges } from "../src/decision-transaction.ts";
import {
  currentDecisionId,
  currentSourcePath,
  decisionFilePath,
  withFixtureWorkspace
} from "./support.ts";

type UnsafeEntry = "directory" | "symlink";

const unsafeEntries: readonly UnsafeEntry[] = ["directory", "symlink"];

async function replaceWithUnsafeEntry(options: {
  entry: UnsafeEntry;
  outsidePath: string;
  sourcePath: string;
}): Promise<boolean> {
  await fs.rm(options.sourcePath);
  if (options.entry === "directory") {
    await fs.mkdir(options.sourcePath);
    return true;
  }
  try {
    await fs.symlink(options.outsidePath, options.sourcePath);
    return true;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "EPERM") {
      return false;
    }
    throw error;
  }
}

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
        result.errors.some(
          (error) =>
            error.includes("Failed to read decision body") &&
            error.includes("regular non-symbolic-link file")
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

        const errors = await applyDecisionChanges({
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
          errors.some(
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

test("scan reports root archive index and source read failures with their actionable paths", async () => {
  await withFixtureWorkspace("scan-read-failures", async (workspaceRoot) => {
    const decisionsDirectory = path.join(workspaceRoot, "docs", "decisions");
    const archiveDirectory = path.join(decisionsDirectory, "archive");
    const indexPath = path.join(decisionsDirectory, "decision-index.json");
    const sourcePath = decisionFilePath(workspaceRoot, currentSourcePath);

    const readdirDescriptor = Object.getOwnPropertyDescriptor(fs, "readdir");
    assert.ok(readdirDescriptor);
    const readdir = fs.readdir.bind(fs);
    for (const [targetPath, expected] of [
      [
        decisionsDirectory,
        /docs\/decisions could not be read: simulated root read failure/
      ],
      [
        archiveDirectory,
        /Decision archive could not be read: simulated archive read failure/
      ]
    ] as const) {
      Object.defineProperty(fs, "readdir", {
        ...readdirDescriptor,
        value: async (directory: string, options: { withFileTypes: true }) => {
          if (path.resolve(directory) === targetPath) {
            throw new Error(
              `simulated ${targetPath === archiveDirectory ? "archive" : "root"} read failure`
            );
          }
          return await readdir(directory, options);
        }
      });
      try {
        const scan = await scanDecisionRecords({ workspaceRoot });
        assert.ok(scan.sourceErrors.some((error) => expected.test(error)));
      } finally {
        Object.defineProperty(fs, "readdir", readdirDescriptor);
      }
    }

    const readFileDescriptor = Object.getOwnPropertyDescriptor(fs, "readFile");
    assert.ok(readFileDescriptor);
    const readFile = fs.readFile.bind(fs);
    for (const [targetPath, expected] of [
      [
        indexPath,
        /decision-index\.json could not be read: simulated index read failure/
      ],
      [
        sourcePath,
        /use-generated-cli\.md could not be read: simulated source read failure/
      ]
    ] as const) {
      Object.defineProperty(fs, "readFile", {
        ...readFileDescriptor,
        value: async (filePath: string, encoding: BufferEncoding) => {
          if (path.resolve(filePath) === targetPath) {
            throw new Error(
              `simulated ${targetPath === indexPath ? "index" : "source"} read failure`
            );
          }
          return await readFile(filePath, encoding);
        }
      });
      try {
        const scan = await scanDecisionRecords({ workspaceRoot });
        const errors =
          targetPath === indexPath ? scan.indexErrors : scan.sourceErrors;
        assert.ok(errors.some((error) => expected.test(error)));
      } finally {
        Object.defineProperty(fs, "readFile", readFileDescriptor);
      }
    }
  });
});

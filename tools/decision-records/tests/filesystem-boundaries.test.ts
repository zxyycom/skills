import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { readDecisionStateSnapshot } from "../src/decision-index-source.ts";
import { isDecisionId } from "../src/decision-path.ts";
import { executeDecisionQuery } from "../src/decision-query-service.ts";
import { scanDecisionRecords } from "../src/scan.ts";
import { stageDecisionRecords } from "../src/decision-stage-service.ts";
import { applyDecisionChanges } from "../src/decision-transaction.ts";
import {
  currentDecisionId,
  currentSourcePath,
  decisionFilePath,
  runSourceCli,
  withFixtureWorkspace,
  withGitFixtureWorkspace
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

const filesystemDiagnosticSecret = "top-secret-decision-token";
const filesystemDiagnosticPath = "/tmp/private-decision-records-path";

function accessDeniedFileSystemError(): Error {
  return Object.assign(
    new Error(
      `EACCES password=${filesystemDiagnosticSecret} at ${filesystemDiagnosticPath}`
    ),
    { code: "EACCES" }
  );
}

function assertRedactedAccessDeniedDiagnostic(options: {
  detail: string | null | undefined;
  reason: string;
  expectedReason: string;
}): void {
  assert.equal(options.reason, options.expectedReason);
  assert.match(options.detail ?? "", /password=\[redacted\]/);
  assert.doesNotMatch(
    options.detail ?? "",
    new RegExp(filesystemDiagnosticSecret)
  );
  assert.doesNotMatch(
    options.detail ?? "",
    new RegExp(filesystemDiagnosticPath)
  );
}

function isTargetPath(value: unknown, targetPath: string): boolean {
  return typeof value === "string" && path.resolve(value) === targetPath;
}

test("scan classifies access denial and redacts filesystem error detail", () =>
  withFixtureWorkspace("filesystem-diagnostic-scan", async (workspaceRoot) => {
    const sourcePath = decisionFilePath(workspaceRoot, currentSourcePath);
    const descriptor = Object.getOwnPropertyDescriptor(fs, "readFile");
    assert.ok(descriptor);
    const readFile = fs.readFile.bind(fs);
    Object.defineProperty(fs, "readFile", {
      ...descriptor,
      value: async (...args: Parameters<typeof fs.readFile>) => {
        if (isTargetPath(args[0], sourcePath)) {
          throw accessDeniedFileSystemError();
        }
        return await readFile(...args);
      }
    });
    try {
      const result = await executeDecisionQuery({
        command: "check",
        location: { decisionsDir: "docs/decisions", workspaceRoot }
      });
      assert.equal(result.status, "error");
      const diagnostic = result.diagnostics.find(
        (entry) => entry.causeCategory === "access-denied"
      );
      assert.ok(diagnostic);
      assertRedactedAccessDeniedDiagnostic({
        detail: diagnostic.detail,
        expectedReason:
          "The Decision Records filesystem operation could not complete.",
        reason: diagnostic.reason
      });
    } finally {
      Object.defineProperty(fs, "readFile", descriptor);
    }
  }));

test("transaction classifies access denial and redacts filesystem error detail", () =>
  withFixtureWorkspace(
    "filesystem-diagnostic-transaction",
    async (workspaceRoot) => {
      const sourcePath = decisionFilePath(workspaceRoot, currentSourcePath);
      const sourceText = await fs.readFile(sourcePath, "utf8");
      const descriptor = Object.getOwnPropertyDescriptor(fs, "lstat");
      assert.ok(descriptor);
      const lstat = fs.lstat.bind(fs);
      Object.defineProperty(fs, "lstat", {
        ...descriptor,
        value: async (...args: Parameters<typeof fs.lstat>) => {
          if (isTargetPath(args[0], sourcePath)) {
            throw accessDeniedFileSystemError();
          }
          return await lstat(...args);
        }
      });
      try {
        const result = await applyDecisionChanges({
          changes: [
            {
              decisionPath: sourcePath,
              expectedText: sourceText,
              nextText: sourceText.replace("使用生成 CLI", "不可读的生成 CLI")
            }
          ],
          originalScan: await scanDecisionRecords({ workspaceRoot }),
          scanOptions: { workspaceRoot }
        });
        assert.equal(result.status, "error");
        const diagnostic = result.diagnostics.find(
          (entry) => entry.causeCategory === "access-denied"
        );
        assert.ok(diagnostic);
        assertRedactedAccessDeniedDiagnostic({
          detail: diagnostic.detail,
          expectedReason:
            "Failed to verify decision source before update. No files were written.",
          reason: diagnostic.reason
        });
      } finally {
        Object.defineProperty(fs, "lstat", descriptor);
      }
    }
  ));

test("stage classifies access denial and redacts filesystem error detail", () =>
  withGitFixtureWorkspace(
    "filesystem-diagnostic-stage",
    async (workspaceRoot) => {
      const sourcePath = decisionFilePath(workspaceRoot, currentSourcePath);
      const descriptor = Object.getOwnPropertyDescriptor(fs, "lstat");
      assert.ok(descriptor);
      const lstat = fs.lstat.bind(fs);
      Object.defineProperty(fs, "lstat", {
        ...descriptor,
        value: async (...args: Parameters<typeof fs.lstat>) => {
          if (isTargetPath(args[0], sourcePath)) {
            throw accessDeniedFileSystemError();
          }
          return await lstat(...args);
        }
      });
      try {
        const result = await stageDecisionRecords({
          decisionIds: [currentDecisionId],
          location: { decisionsDir: "docs/decisions", workspaceRoot }
        });
        assert.equal(result.status, "error");
        const diagnostic = result.diagnostics.find(
          (entry) => entry.causeCategory === "access-denied"
        );
        assert.ok(diagnostic);
        assertRedactedAccessDeniedDiagnostic({
          detail: diagnostic.detail,
          expectedReason: "Failed to construct the selected decision snapshot.",
          reason: diagnostic.reason
        });
      } finally {
        Object.defineProperty(fs, "lstat", descriptor);
      }
    }
  ));

test("sync-index preserves structured source filesystem access diagnostics", () =>
  withFixtureWorkspace(
    "sync-index-structured-filesystem",
    async (workspaceRoot) => {
      const sourcePath = decisionFilePath(workspaceRoot, currentSourcePath);
      const descriptor = Object.getOwnPropertyDescriptor(fs, "readFile");
      assert.ok(descriptor);
      const readFile = fs.readFile.bind(fs);
      let sourceReads = 0;
      Object.defineProperty(fs, "readFile", {
        ...descriptor,
        value: async (...args: Parameters<typeof fs.readFile>) => {
          if (isTargetPath(args[0], sourcePath)) {
            sourceReads += 1;
            if (sourceReads === 2) {
              throw accessDeniedFileSystemError();
            }
          }
          return await readFile(...args);
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
          /code: decision-records\.sync-index-failed/
        );
        assert.match(result.stderr, /causeCategory: access-denied/);
        assert.match(
          result.stderr,
          /reason: The derived Decision index filesystem operation could not complete\./
        );
        assert.match(result.stderr, /password=\[redacted\]/);
        assert.doesNotMatch(
          result.stderr,
          new RegExp(filesystemDiagnosticSecret)
        );
        assert.doesNotMatch(
          result.stderr,
          new RegExp(filesystemDiagnosticPath)
        );
        assert.equal(sourceReads, 2);
      } finally {
        Object.defineProperty(fs, "readFile", descriptor);
      }
    }
  ));

test("transaction preserves structured index filesystem access diagnostics", () =>
  withFixtureWorkspace(
    "transaction-structured-filesystem",
    async (workspaceRoot) => {
      const sourcePath = decisionFilePath(workspaceRoot, currentSourcePath);
      const sourceText = await fs.readFile(sourcePath, "utf8");
      const originalScan = await scanDecisionRecords({ workspaceRoot });
      const descriptor = Object.getOwnPropertyDescriptor(fs, "readFile");
      assert.ok(descriptor);
      const readFile = fs.readFile.bind(fs);
      let sourceReads = 0;
      Object.defineProperty(fs, "readFile", {
        ...descriptor,
        value: async (...args: Parameters<typeof fs.readFile>) => {
          if (isTargetPath(args[0], sourcePath)) {
            sourceReads += 1;
            if (sourceReads === 3) {
              throw accessDeniedFileSystemError();
            }
          }
          return await readFile(...args);
        }
      });
      try {
        const result = await applyDecisionChanges({
          changes: [
            {
              decisionPath: sourcePath,
              expectedText: sourceText,
              nextText: sourceText.replace(
                "使用生成 CLI",
                "索引访问失败后的生成 CLI"
              )
            }
          ],
          originalScan,
          scanOptions: { workspaceRoot }
        });
        assert.equal(result.status, "error");
        assert.equal(result.outcome, "rolled-back");
        const diagnostic = result.diagnostics.find(
          (entry) =>
            entry.code === "decision-records.transaction-failed" &&
            entry.causeCategory === "access-denied"
        );
        assert.ok(diagnostic);
        assertRedactedAccessDeniedDiagnostic({
          detail: diagnostic.detail,
          expectedReason:
            "The derived Decision index filesystem operation could not complete.",
          reason: diagnostic.reason
        });
        assert.equal(sourceReads, 3);
        assert.equal(await fs.readFile(sourcePath, "utf8"), sourceText);
      } finally {
        Object.defineProperty(fs, "readFile", descriptor);
      }
    }
  ));

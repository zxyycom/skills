import path from "node:path";
import {
  accessDeniedFileSystemError,
  applyDecisionChanges,
  assert,
  assertRedactedAccessDeniedDiagnostic,
  currentSourcePath,
  decisionFilePath,
  filesystemDiagnosticPath,
  filesystemDiagnosticSecret,
  fs,
  isTargetPath,
  runSourceCli,
  scanDecisionRecords,
  test,
  withFixtureWorkspace
} from "./support.ts";

test("sync-index preserves structured source filesystem access diagnostics", () =>
  withFixtureWorkspace(
    "sync-index-structured-filesystem",
    async (workspaceRoot) => {
      const sourcePath = decisionFilePath(workspaceRoot, currentSourcePath);
      const descriptor = Object.getOwnPropertyDescriptor(fs, "open");
      assert.ok(descriptor);
      const open = fs.open.bind(fs);
      let sourceReads = 0;
      Object.defineProperty(fs, "open", {
        ...descriptor,
        value: async (...args: Parameters<typeof fs.open>) => {
          if (isTargetPath(args[0], sourcePath)) {
            sourceReads += 1;
            if (sourceReads === 2) {
              throw accessDeniedFileSystemError();
            }
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
        Object.defineProperty(fs, "open", descriptor);
      }
    }
  ));

test("transaction preserves structured index filesystem access diagnostics", () =>
  withFixtureWorkspace(
    "transaction-structured-filesystem",
    async (workspaceRoot) => {
      const sourcePath = decisionFilePath(workspaceRoot, currentSourcePath);
      const sourceText = await fs.readFile(sourcePath, "utf8");
      const indexFile = path.join(
        workspaceRoot,
        "docs/decisions/decision-index.json"
      );
      const originalScan = await scanDecisionRecords({ workspaceRoot });
      const descriptor = Object.getOwnPropertyDescriptor(fs, "open");
      assert.ok(descriptor);
      const open = fs.open.bind(fs);
      let indexReads = 0;
      Object.defineProperty(fs, "open", {
        ...descriptor,
        value: async (...args: Parameters<typeof fs.open>) => {
          if (isTargetPath(args[0], indexFile)) {
            indexReads += 1;
            if (indexReads === 2) throw accessDeniedFileSystemError();
          }
          return await open(...args);
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
          originalScan
        });
        assert.equal(result.status, "error");
        assert.equal(result.outcome, "no-change");
        const diagnostic = result.diagnostics.find(
          (entry) =>
            entry.code === "decision-records.transaction-failed" &&
            entry.causeCategory === "access-denied"
        );
        assert.ok(diagnostic);
        assertRedactedAccessDeniedDiagnostic({
          detail: diagnostic.detail,
          expectedReason:
            "Failed to update or verify Decision files and index.",
          reason: diagnostic.reason
        });
        assert.equal(indexReads, 2);
        assert.equal(await fs.readFile(sourcePath, "utf8"), sourceText);
      } finally {
        Object.defineProperty(fs, "open", descriptor);
      }
    }
  ));

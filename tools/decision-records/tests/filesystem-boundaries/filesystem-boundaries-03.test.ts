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

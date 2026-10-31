import {
  accessDeniedFileSystemError,
  applyDecisionChanges,
  assert,
  assertRedactedAccessDeniedDiagnostic,
  currentDecisionId,
  currentSourcePath,
  decisionFilePath,
  executeDecisionQuery,
  fs,
  isTargetPath,
  path,
  scanDecisionRecords,
  test,
  stageDecisionRecords,
  withGitFixtureWorkspace,
  withFixtureWorkspace
} from "./support.ts";

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

    const openDescriptor = Object.getOwnPropertyDescriptor(fs, "open");
    assert.ok(openDescriptor);
    const open = fs.open.bind(fs);
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
      Object.defineProperty(fs, "open", {
        ...openDescriptor,
        value: async (...args: Parameters<typeof fs.open>) => {
          const filePath = String(args[0]);
          if (path.resolve(filePath) === targetPath) {
            throw new Error(
              `simulated ${targetPath === indexPath ? "index" : "source"} read failure`
            );
          }
          return await open(...args);
        }
      });
      try {
        const scan = await scanDecisionRecords({ workspaceRoot });
        const errors =
          targetPath === indexPath ? scan.indexErrors : scan.sourceErrors;
        assert.ok(errors.some((error) => expected.test(error)));
      } finally {
        Object.defineProperty(fs, "open", openDescriptor);
      }
    }
  });
});

test("scan classifies access denial and redacts filesystem error detail", () =>
  withFixtureWorkspace("filesystem-diagnostic-scan", async (workspaceRoot) => {
    const sourcePath = decisionFilePath(workspaceRoot, currentSourcePath);
    const descriptor = Object.getOwnPropertyDescriptor(fs, "open");
    assert.ok(descriptor);
    const open = fs.open.bind(fs);
    Object.defineProperty(fs, "open", {
      ...descriptor,
      value: async (...args: Parameters<typeof fs.open>) => {
        if (isTargetPath(args[0], sourcePath)) {
          throw accessDeniedFileSystemError();
        }
        return await open(...args);
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
      Object.defineProperty(fs, "open", descriptor);
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
          originalScan: await scanDecisionRecords({ workspaceRoot })
        });
        assert.equal(result.status, "error");
        const diagnostic = result.diagnostics.find(
          (entry) => entry.causeCategory === "access-denied"
        );
        assert.ok(diagnostic);
        assertRedactedAccessDeniedDiagnostic({
          detail: diagnostic.detail,
          expectedReason:
            "Failed to update or verify Decision files and index.",
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
      const original = fs.lstat;
      Object.defineProperty(fs, "lstat", {
        configurable: true,
        value: (...args: Parameters<typeof fs.lstat>) => {
          if (isTargetPath(args[0], sourcePath))
            throw accessDeniedFileSystemError();
          return original(...args);
        }
      });
      try {
        const result = await stageDecisionRecords({
          decisionIds: [currentDecisionId],
          location: { workspaceRoot, decisionsDir: "docs/decisions" }
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
        fs.lstat = original;
      }
    }
  ));

import {
  assert,
  classifyVersionControlCause,
  createGitRepositoryFixture,
  execFileSync,
  fs,
  operationErrorDetail,
  path,
  runGit,
  test,
  VersionControlError,
  versionControlRepositoryFixtureRoot,
  withTempRoot,
  writeFile
} from "./version-control-test-support.ts";

test("normalizes and redacts structured version-control operation error details", () => {
  assert.equal(operationErrorDetail(undefined), null);
  assert.equal(operationErrorDetail("\n Git\tfailed \n"), "Git failed");
  const structured = operationErrorDetail({
    operation: "read revision",
    retries: 2
  });
  assert.ok(structured);
  assert.match(structured, /operation.*read revision/u);
  assert.match(structured, /retries.*2/u);
  assert.doesNotMatch(structured, /\[object Object\]/u);
  const sensitive = operationErrorDetail(
    "token=ghp_123456789012345678901234567890 at /private/workspace/secret " +
      "https://user:password@example.invalid/repository"
  );
  assert.ok(sensitive);
  assert.doesNotMatch(sensitive, /ghp_|private|password/u);
  assert.match(sensitive, /\[redacted\]/u);
  const credential = operationErrorDetail(
    "Authorization: Bearer credential-secret\nBasic another-secret"
  );
  assert.ok(credential);
  assert.doesNotMatch(
    credential,
    /Bearer|Basic|credential-secret|another-secret/u
  );
  assert.doesNotMatch(credential, /\r|\n/u);
  const spacedPath = operationErrorDetail(
    "failed to read /private workspace/credential directory/secret file"
  );
  assert.ok(spacedPath);
  assert.doesNotMatch(
    spacedPath,
    /private workspace|credential directory|secret file/u
  );
  const longSensitive = operationErrorDetail(
    "Authorization: Bearer long-secret; " + "x".repeat(600)
  );
  assert.ok(longSensitive);
  assert.ok(longSensitive.length <= 500);
  assert.doesNotMatch(longSensitive, /Bearer|long-secret/u);
});

test("classifies injected version-control system causes", () => {
  const accessError = Object.assign(new Error("permission denied"), {
    code: "EACCES"
  });
  const permissionError = Object.assign(new Error("operation not permitted"), {
    code: "EPERM"
  });
  const unavailableError = Object.assign(new Error("tool missing"), {
    code: "ENOENT"
  });
  assert.equal(classifyVersionControlCause(accessError), "access-denied");
  assert.equal(classifyVersionControlCause(permissionError), "access-denied");
  assert.equal(
    classifyVersionControlCause(unavailableError),
    "tool-unavailable"
  );
  const commandError = new VersionControlError({
    causeCategory: "command-failed",
    code: "operation-failed",
    detail: "command returned non-zero",
    operation: "read a revision",
    target: "requested revision"
  });
  assert.deepEqual(
    {
      causeCategory: commandError.causeCategory,
      code: commandError.code,
      detail: commandError.detail,
      operation: commandError.operation,
      target: commandError.target
    },
    {
      causeCategory: "command-failed",
      code: "operation-failed",
      detail: "command returned non-zero",
      operation: "read a revision",
      target: "requested revision"
    }
  );
});

test("materializes an ordinary fixture into isolated Git repositories", async () => {
  let temporaryRoot = "";
  await withTempRoot(async (tempRoot) => {
    temporaryRoot = tempRoot;
    await assert.rejects(
      fs.access(path.join(versionControlRepositoryFixtureRoot, ".git"))
    );
    assert.doesNotMatch(
      await fs.readFile(
        path.join(versionControlRepositoryFixtureRoot, "docs", "tracked.md"),
        "utf8"
      ),
      /(?:^|[\\/])workspace(?:[\\/]|$)/u
    );

    const first = await createGitRepositoryFixture({
      fixtureRoot: versionControlRepositoryFixtureRoot,
      parentDirectory: tempRoot,
      repositoryName: "first",
      userEmail: "version-control@example.invalid",
      userName: "Version Control Test"
    });
    const second = await createGitRepositoryFixture({
      fixtureRoot: versionControlRepositoryFixtureRoot,
      parentDirectory: tempRoot,
      repositoryName: "second",
      userEmail: "version-control@example.invalid",
      userName: "Version Control Test"
    });

    assert.equal(
      runGit(first.repositoryRoot, ["branch", "--show-current"]).trim(),
      "main"
    );
    assert.equal(
      runGit(first.repositoryRoot, ["config", "core.autocrlf"]).trim(),
      "false"
    );
    assert.equal(
      runGit(first.repositoryRoot, ["config", "--local", "user.email"]).trim(),
      "version-control@example.invalid"
    );
    assert.equal(
      runGit(first.repositoryRoot, ["config", "--local", "user.name"]).trim(),
      "Version Control Test"
    );
    assert.equal(first.baselineRevision, second.baselineRevision);
    await writeFile(first.repositoryRoot, "docs/tracked.md", "changed\n");
    runGit(first.repositoryRoot, ["add", "docs/tracked.md"]);
    const emptyGlobalConfig = path.join(tempRoot, "empty-global-gitconfig");
    await fs.writeFile(emptyGlobalConfig, "", "utf8");
    const isolatedGitEnvironment: NodeJS.ProcessEnv = {
      ...process.env,
      GIT_CONFIG_GLOBAL: emptyGlobalConfig,
      GIT_CONFIG_NOSYSTEM: "1"
    };
    for (const variable of [
      "GIT_AUTHOR_EMAIL",
      "GIT_AUTHOR_NAME",
      "GIT_COMMITTER_EMAIL",
      "GIT_COMMITTER_NAME"
    ]) {
      delete isolatedGitEnvironment[variable];
    }
    execFileSync(
      "git",
      [
        "-C",
        first.repositoryRoot,
        "commit",
        "--quiet",
        "--message",
        "isolated follow-up"
      ],
      {
        encoding: "utf8",
        env: isolatedGitEnvironment,
        windowsHide: true
      }
    );
    assert.equal(
      await fs.readFile(
        path.join(second.repositoryRoot, "docs", "tracked.md"),
        "utf8"
      ),
      "base\n"
    );
  });
  await assert.rejects(fs.access(temporaryRoot));
});

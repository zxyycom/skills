import {
  assert,
  candidateDecisionBody,
  commitWorkspace,
  createCliProgram,
  currentDecisionId,
  currentSourcePath,
  decisionFilePath,
  fs,
  initializeGitRepository,
  path,
  runGit,
  runSourceCli,
  test,
  withGitFixtureWorkspace,
  withTemporaryWorkspace,
  writeDecision
} from "./support.ts";

test("stage reports unavailable version control without writing filesystem state", () =>
  withTemporaryWorkspace("stage-no-version-control", async (workspaceRoot) => {
    const id = "use-no-git";
    await writeDecision(
      workspaceRoot,
      id,
      candidateDecisionBody()
        .replace("status: candidate", "status: active")
        .replace("alignment: null", "alignment: aligned")
        .replace("createdAt: null", "createdAt: 2026-08-15T00:00:00Z")
    );
    const source = decisionFilePath(workspaceRoot, id);
    const before = await fs.readFile(source, "utf8");
    const result = await runSourceCli(["stage", id, "--root", workspaceRoot]);
    assert.notEqual(result.exitCode, 0);
    assert.match(result.stderr, /version-controlled decision workspace/);
    assert.equal(await fs.readFile(source, "utf8"), before);
  }));

test("help exposes stage independently without adding lifecycle stage options", () => {
  const program = createCliProgram(
    async () => 0,
    () => undefined
  );
  assert.match(program.helpInformation(), /stage <selector\.\.\.>/);
  for (const command of [
    "activate",
    "evolve",
    "archive",
    "mark-aligned",
    "discard"
  ]) {
    const entry = program.commands.find(
      (candidate) => candidate.name() === command
    );
    assert.ok(entry);
    assert.doesNotMatch(entry.helpInformation(), /--stage/);
  }
});

test("stage preserves concurrent pending bytes discovered by the replacement CAS", () =>
  withGitFixtureWorkspace("stage-pending-race", async (workspaceRoot) => {
    const concurrentId = "use-concurrent-pending";
    const concurrentBody = candidateDecisionBody({
      id: concurrentId,
      title: "并发 pending 决策"
    });
    const selectedPath = decisionFilePath(workspaceRoot, currentSourcePath);
    const descriptor = Object.getOwnPropertyDescriptor(fs, "readFile");
    assert.ok(descriptor);
    const readFile = fs.readFile.bind(fs);
    let injected = false;
    Object.defineProperty(fs, "readFile", {
      ...descriptor,
      value: async (
        filePath: string,
        encoding: BufferEncoding
      ): Promise<string> => {
        if (!injected && path.resolve(filePath) === selectedPath) {
          injected = true;
          await writeDecision(workspaceRoot, concurrentId, concurrentBody);
          runGit(workspaceRoot, ["add", `docs/decisions/${concurrentId}.md`]);
        }
        return await readFile(filePath, encoding);
      }
    });
    try {
      const staged = await runSourceCli([
        "stage",
        currentDecisionId,
        "--root",
        workspaceRoot
      ]);
      assert.notEqual(staged.exitCode, 0);
      assert.match(
        staged.stderr,
        /code: decision-records\.version-control-pending-conflict/
      );
    } finally {
      Object.defineProperty(fs, "readFile", descriptor);
    }
    assert.equal(injected, true);
    assert.equal(
      runGit(workspaceRoot, ["show", `:docs/decisions/${concurrentId}.md`]),
      concurrentBody
    );
  }));

test("stage rejects selected source drift before replacing the pending snapshot", async () => {
  for (const mutation of ["change", "delete", "move"] as const) {
    await withGitFixtureWorkspace(
      `stage-selected-drift-${mutation}`,
      async (workspaceRoot) => {
        const sourcePath = decisionFilePath(workspaceRoot, currentSourcePath);
        const descriptor = Object.getOwnPropertyDescriptor(fs, "readFile");
        assert.ok(descriptor);
        const readFile = fs.readFile.bind(fs);
        let reads = 0;
        let injected = false;
        Object.defineProperty(fs, "readFile", {
          ...descriptor,
          value: async (
            filePath: string,
            encoding: BufferEncoding
          ): Promise<string> => {
            if (path.resolve(filePath) === sourcePath && ++reads === 2) {
              injected = true;
              if (mutation === "change") {
                await fs.writeFile(
                  sourcePath,
                  (await readFile(sourcePath, "utf8")).replace(
                    "使用生成 CLI",
                    "并发改写 CLI"
                  ),
                  "utf8"
                );
              } else if (mutation === "delete") {
                await fs.rm(sourcePath);
              } else {
                await fs.rename(
                  sourcePath,
                  decisionFilePath(
                    workspaceRoot,
                    `archive/${currentDecisionId}`
                  )
                );
              }
            }
            return await readFile(filePath, encoding);
          }
        });
        try {
          const staged = await runSourceCli([
            "stage",
            currentDecisionId,
            "--root",
            workspaceRoot
          ]);
          assert.notEqual(staged.exitCode, 0, mutation);
          assert.match(
            staged.stderr,
            /changed before staging|changed after snapshot|failed to verify selected/i
          );
        } finally {
          Object.defineProperty(fs, "readFile", descriptor);
        }
        assert.equal(injected, true, mutation);
        assert.equal(
          runGit(workspaceRoot, ["diff", "--cached", "--name-only"]),
          ""
        );
      }
    );
  }
});

test("stage rejects a missing ID when bootstrapping without a revision", () =>
  withTemporaryWorkspace("stage-bootstrap-missing", async (workspaceRoot) => {
    initializeGitRepository(workspaceRoot);
    await fs.writeFile(
      path.join(workspaceRoot, "README.md"),
      "baseline\n",
      "utf8"
    );
    commitWorkspace(workspaceRoot);
    await fs.mkdir(path.join(workspaceRoot, "docs", "decisions"), {
      recursive: true
    });
    const staged = await runSourceCli([
      "stage",
      "use-missing-bootstrap.md",
      "--root",
      workspaceRoot
    ]);
    assert.notEqual(staged.exitCode, 0);
    assert.match(
      staged.stderr,
      /does not exist|must produce at least one established/i
    );
    assert.equal(
      runGit(workspaceRoot, ["diff", "--cached", "--name-only"]),
      ""
    );
  }));

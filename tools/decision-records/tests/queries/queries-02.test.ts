import {
  archivedDecisionId,
  assert,
  candidateDecisionBody,
  currentDecisionId,
  currentSourcePath,
  decisionFilePath,
  decisionMatchLines,
  fs,
  path,
  runSourceCli,
  runSuccessfulSourceCli,
  test,
  withFixtureWorkspace,
  writeDecision
} from "./support.ts";

test("decision list filters lifecycle and tag selectors", () =>
  withFixtureWorkspace("query-list", async (workspaceRoot) => {
    const active = await runSuccessfulSourceCli([
      "list",
      "--status",
      "active",
      "--tag",
      "project-tooling",
      "--root",
      workspaceRoot
    ]);
    assert.match(active, new RegExp(currentDecisionId));
    assert.doesNotMatch(active, new RegExp(archivedDecisionId));
    const archived = await runSuccessfulSourceCli([
      "list",
      "--status",
      "archived",
      "--tag",
      "decision-records",
      "--root",
      workspaceRoot
    ]);
    assert.match(archived, new RegExp(archivedDecisionId));
    assert.doesNotMatch(archived, new RegExp(currentDecisionId));
  }));

test("decision show returns metadata and reports body read failures", () =>
  withFixtureWorkspace("query-show-read", async (workspaceRoot) => {
    const shown = await runSuccessfulSourceCli([
      "show",
      currentDecisionId,
      "--root",
      workspaceRoot
    ]);
    assert.match(shown, /^id: use-generated-cli$/m);
    assert.match(shown, /^sourcePath: use-generated-cli\.md$/m);
    const sourcePath = decisionFilePath(workspaceRoot, currentSourcePath);
    const descriptor = Object.getOwnPropertyDescriptor(fs, "readFile");
    assert.ok(descriptor);
    const readFile = fs.readFile.bind(fs);
    let reads = 0;
    Object.defineProperty(fs, "readFile", {
      ...descriptor,
      value: async (file: string, encoding: BufferEncoding) => {
        if (path.resolve(file) === sourcePath) {
          reads += 1;
          throw new Error("simulated decision body read failure");
        }
        return await readFile(file, encoding);
      }
    });
    try {
      const failed = await runSourceCli([
        "show",
        currentDecisionId,
        "--root",
        workspaceRoot
      ]);
      assert.notEqual(failed.exitCode, 0);
      assert.equal(failed.stdout, "");
      assert.match(
        failed.stderr,
        /code: decision-records\.decision-body-unavailable/
      );
      assert.equal(reads, 1);
    } finally {
      Object.defineProperty(fs, "readFile", descriptor);
    }
  }));

test("decision trace follows predecessor and successor directions", () =>
  withFixtureWorkspace("query-trace-direction", async (workspaceRoot) => {
    const predecessors = await runSuccessfulSourceCli([
      "trace",
      currentDecisionId,
      "--direction",
      "predecessors",
      "--root",
      workspaceRoot
    ]);
    assert.match(predecessors, new RegExp(archivedDecisionId));
    const successors = await runSuccessfulSourceCli([
      "trace",
      archivedDecisionId,
      "--direction",
      "successors",
      "--root",
      workspaceRoot
    ]);
    assert.match(successors, new RegExp(currentDecisionId));
    const none = await runSuccessfulSourceCli([
      "trace",
      archivedDecisionId,
      "--direction",
      "predecessors",
      "--root",
      workspaceRoot
    ]);
    assert.doesNotMatch(none, new RegExp(currentDecisionId));
  }));

test("decision queries use persisted snapshots while check detects source drift", () =>
  withFixtureWorkspace("query-snapshot", async (workspaceRoot) => {
    const source = decisionFilePath(workspaceRoot, currentSourcePath);
    await fs.rm(source);
    assert.match(
      await runSuccessfulSourceCli(["list", "--root", workspaceRoot]),
      new RegExp(currentDecisionId)
    );
    assert.match(
      await runSuccessfulSourceCli([
        "trace",
        currentDecisionId,
        "--root",
        workspaceRoot
      ]),
      new RegExp(archivedDecisionId)
    );
    const shown = await runSourceCli([
      "show",
      currentDecisionId,
      "--root",
      workspaceRoot
    ]);
    assert.notEqual(shown.exitCode, 0);
    assert.match(shown.stderr, /Failed to read decision body/);
    const checked = await runSourceCli(["check", "--root", workspaceRoot]);
    assert.notEqual(checked.exitCode, 0);
  }));

test("decision list combines repeated tag selectors with AND semantics", () =>
  withFixtureWorkspace("query-tags-and", async (workspaceRoot) => {
    const bothId = "use-both-tags.md";
    await writeDecision(
      workspaceRoot,
      bothId,
      candidateDecisionBody({
        tags: ["decision-records", "project-tooling"],
        title: "同时属于两个标签"
      })
        .replace("status: candidate", "status: active")
        .replace("alignment: null", "alignment: aligned")
        .replace("createdAt: null", "createdAt: 2026-08-15T00:00:00Z")
    );
    assert.equal(
      (await runSourceCli(["sync-index", "--root", workspaceRoot])).exitCode,
      0
    );
    const listed = await runSuccessfulSourceCli([
      "list",
      "--status",
      "all",
      "--tag",
      "decision-records",
      "--tag",
      "project-tooling",
      "--root",
      workspaceRoot
    ]);
    assert.match(
      decisionMatchLines(listed),
      new RegExp(bothId.replace(/\.md$/u, ""))
    );
    assert.doesNotMatch(listed, new RegExp(currentDecisionId));
    assert.doesNotMatch(listed, new RegExp(archivedDecisionId));
  }));

test("decision list filters records by alignment selector", () =>
  withFixtureWorkspace("query-alignment", async (workspaceRoot) => {
    const unalignedId = "use-unaligned.md";
    await writeDecision(
      workspaceRoot,
      unalignedId,
      candidateDecisionBody({ title: "未对齐索引记录" })
        .replace("status: candidate", "status: active")
        .replace("alignment: null", "alignment: unaligned")
        .replace("createdAt: null", "createdAt: 2026-08-15T00:00:00Z")
    );
    assert.equal(
      (await runSourceCli(["sync-index", "--root", workspaceRoot])).exitCode,
      0
    );
    const listed = await runSuccessfulSourceCli([
      "list",
      "--alignment",
      "unaligned",
      "--root",
      workspaceRoot
    ]);
    assert.match(
      decisionMatchLines(listed),
      new RegExp(unalignedId.replace(/\.md$/u, ""))
    );
    assert.doesNotMatch(listed, new RegExp(currentDecisionId));
    assert.doesNotMatch(listed, new RegExp(archivedDecisionId));
  }));

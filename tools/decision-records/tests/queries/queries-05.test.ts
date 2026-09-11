import {
  archivedDecisionId,
  assert,
  candidateDecisionBody,
  currentDecisionId,
  currentSourcePath,
  decisionFilePath,
  fs,
  path,
  runSourceCli,
  runSuccessfulSourceCli,
  test,
  withFixtureWorkspace,
  writeDecision
} from "./support.ts";

test("decision search finds full Markdown text with all, any, and phrase modes", () =>
  withFixtureWorkspace("query-search-modes", async (workspaceRoot) => {
    const sourcePath = "semantic-basename.md";
    const decisionId = "semantic-basename";
    await writeDecision(
      workspaceRoot,
      sourcePath,
      candidateDecisionBody({ id: decisionId, title: "全文发现记录" })
        .replace("status: candidate", "status: active")
        .replace("alignment: null", "alignment: aligned")
        .replace("createdAt: null", "createdAt: 2026-09-01T00:00:00Z")
        .replace(
          "- 采用: 使用显式 candidate 状态区分候选与已建立决策。",
          "- 稀有全文短语位于正文。\n- 采用: 使用显式 candidate 状态区分候选与已建立决策。"
        )
    );
    assert.equal(
      (await runSourceCli(["sync-index", "--root", workspaceRoot])).exitCode,
      0
    );

    const all = await runSuccessfulSourceCli([
      "search",
      "稀有 全文",
      "--root",
      workspaceRoot
    ]);
    assert.match(all, new RegExp(decisionId));
    assert.match(all, /sourcePath: semantic-basename\.md/);
    assert.match(all, /previews:/);
    assert.match(all, /稀有全文短语位于正文/);

    const explicitContent = await runSuccessfulSourceCli([
      "search",
      "稀有 全文",
      "--in",
      "content",
      "--root",
      workspaceRoot
    ]);
    assert.match(explicitContent, new RegExp(decisionId));
    assert.match(explicitContent, /previews:/);

    const any = await runSuccessfulSourceCli([
      "search",
      "不存在 稀有全文短语",
      "--match",
      "any",
      "--root",
      workspaceRoot
    ]);
    assert.match(any, new RegExp(decisionId));

    const phrase = await runSuccessfulSourceCli([
      "search",
      "稀有全文短语",
      "--match",
      "phrase",
      "--root",
      workspaceRoot
    ]);
    assert.match(phrase, new RegExp(decisionId));
  }));

test("decision search defaults to active and permits archived selection", () =>
  withFixtureWorkspace("query-search-status", async (workspaceRoot) => {
    const defaultResults = await runSuccessfulSourceCli([
      "search",
      "可追溯的前序判断",
      "--root",
      workspaceRoot
    ]);
    assert.doesNotMatch(defaultResults, new RegExp(archivedDecisionId));
    const archivedResults = await runSuccessfulSourceCli([
      "search",
      "可追溯的前序判断",
      "--status",
      "archived",
      "--root",
      workspaceRoot
    ]);
    assert.match(archivedResults, new RegExp(archivedDecisionId));
    assert.match(
      archivedResults,
      /sourcePath: archive\/260710-use-source-cli\.md/
    );
    assert.match(archivedResults, /- archived unaligned /);
    assert.doesNotMatch(archivedResults, /unknown|null/);
  }));

test("decision search falls back to a read-only validated source projection", () =>
  withFixtureWorkspace("query-search-fallback", async (workspaceRoot) => {
    const indexPath = path.join(
      workspaceRoot,
      "docs",
      "decisions",
      "decision-index.json"
    );
    const before = await fs.readFile(indexPath, "utf8");
    const sourcePath = decisionFilePath(workspaceRoot, currentSourcePath);
    await fs.writeFile(
      sourcePath,
      (await fs.readFile(sourcePath, "utf8")).replace(
        "## 背景",
        "稀有回退正文词。\n\n## 背景"
      ),
      "utf8"
    );
    const searched = await runSourceCli([
      "search",
      "稀有回退正文词",
      "--root",
      workspaceRoot
    ]);
    assert.equal(searched.exitCode, 0, searched.stderr);
    assert.match(searched.stdout, new RegExp(currentDecisionId));
    assert.match(
      searched.stderr,
      /read-only validated Decision source projection/
    );
    assert.equal(await fs.readFile(indexPath, "utf8"), before);
  }));

test("decision search does not trust an index that omits a new established source", () =>
  withFixtureWorkspace(
    "query-search-unindexed-source",
    async (workspaceRoot) => {
      await writeDecision(
        workspaceRoot,
        "semantic-unindexed.md",
        candidateDecisionBody({ title: "索引外全文来源" })
          .replace("status: candidate", "status: active")
          .replace("alignment: null", "alignment: aligned")
          .replace("createdAt: null", "createdAt: 2026-09-02T00:00:00Z")
          .replace("## 背景", "罕见索引外正文词。\n\n## 背景")
      );
      const searched = await runSourceCli([
        "search",
        "罕见索引外正文词",
        "--root",
        workspaceRoot
      ]);
      assert.equal(searched.exitCode, 0, searched.stderr);
      assert.match(searched.stdout, /semantic-unindexed/);
      assert.match(
        searched.stderr,
        /read-only validated Decision source projection/
      );
    }
  ));

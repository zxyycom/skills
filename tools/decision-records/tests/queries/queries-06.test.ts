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
  test,
  withFixtureWorkspace,
  writeDecision
} from "./support.ts";

test("decision metadata search matches published fields and source relation summaries", () =>
  withFixtureWorkspace("query-search-metadata", async (workspaceRoot) => {
    const sourcePath = "metadata-source.md";
    const decisionId = "metadata-source";
    await writeDecision(
      workspaceRoot,
      sourcePath,
      candidateDecisionBody({
        id: decisionId,
        relations: [
          {
            summary: "仅来源关联摘要",
            target: archivedDecisionId,
            type: "修订"
          }
        ],
        tags: ["metadata-tag"],
        title: "全角　ＭＥＴＡ字段"
      })
        .replace("status: candidate", "status: active")
        .replace("alignment: null", "alignment: aligned")
        .replace("createdAt: null", "createdAt: 2026-09-02T00:00:00Z")
    );
    assert.equal(
      (await runSourceCli(["sync-index", "--root", workspaceRoot])).exitCode,
      0
    );

    const metadata = await runSourceCli([
      "search",
      "ｍｅｔａ字段 metadata-tag",
      "--in",
      "metadata",
      "--root",
      workspaceRoot
    ]);
    assert.equal(metadata.exitCode, 0, metadata.stderr);
    assert.match(metadata.stdout, new RegExp(decisionId));
    assert.match(metadata.stdout, /matchedFields: title, tags/);
    assert.match(metadata.stdout, /matchedRelations:\n    - none/);
    assert.doesNotMatch(metadata.stdout, /previews:/);

    const phraseAcrossFields = await runSourceCli([
      "search",
      "字段 metadata-tag",
      "--in",
      "metadata",
      "--match",
      "phrase",
      "--root",
      workspaceRoot
    ]);
    assert.equal(phraseAcrossFields.exitCode, 0, phraseAcrossFields.stderr);
    assert.match(phraseAcrossFields.stdout, /- none/);

    const relation = await runSourceCli([
      "search",
      "仅来源关联摘要",
      "--in",
      "metadata",
      "--match",
      "phrase",
      "--root",
      workspaceRoot
    ]);
    assert.equal(relation.exitCode, 0, relation.stderr);
    assert.match(relation.stdout, new RegExp(decisionId));
    assert.doesNotMatch(
      relation.stdout,
      new RegExp("- archived [^\\n]* " + archivedDecisionId)
    );
    assert.match(relation.stdout, /matchedFields: $/m);
    assert.match(
      relation.stdout,
      /- 修订 260710-use-source-cli: 仅来源关联摘要/
    );

    const typeOnly = await runSourceCli([
      "search",
      "修订",
      "--in",
      "metadata",
      "--root",
      workspaceRoot
    ]);
    assert.equal(typeOnly.exitCode, 0, typeOnly.stderr);
    assert.match(typeOnly.stdout, /- none/);
  }));

test("decision metadata search uses only its published index and reports index recovery", () =>
  withFixtureWorkspace("query-search-metadata-index", async (workspaceRoot) => {
    const sourcePath = decisionFilePath(workspaceRoot, currentSourcePath);
    const descriptor = Object.getOwnPropertyDescriptor(fs, "readFile");
    assert.ok(descriptor);
    const readFile = fs.readFile.bind(fs);
    Object.defineProperty(fs, "readFile", {
      ...descriptor,
      value: async (file: string, encoding: BufferEncoding) => {
        if (path.resolve(file) === sourcePath) {
          throw new Error("metadata search must not read Decision Markdown");
        }
        return await readFile(file, encoding);
      }
    });
    try {
      const searched = await runSourceCli([
        "search",
        "生成 CLI",
        "--in",
        "metadata",
        "--root",
        workspaceRoot
      ]);
      assert.equal(searched.exitCode, 0, searched.stderr);
      assert.match(searched.stdout, new RegExp(currentDecisionId));
    } finally {
      Object.defineProperty(fs, "readFile", descriptor);
    }

    await fs.rm(
      path.join(workspaceRoot, "docs", "decisions", "decision-index.json")
    );
    const missing = await runSourceCli([
      "search",
      "生成 CLI",
      "--in",
      "metadata",
      "--root",
      workspaceRoot
    ]);
    assert.equal(missing.exitCode, 1);
    assert.match(missing.stderr, /metadata-index-unavailable/);
    assert.match(missing.stderr, /Run check to diagnose[\s\S]*sync-index/);
  }));

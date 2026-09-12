import {
  archivedDecisionId,
  assert,
  candidateDecisionBody,
  currentDecisionId,
  currentSourcePath,
  decisionFilePath,
  decisionMatchLines,
  executeDecisionQuery,
  fs,
  path,
  runSourceCli,
  runSuccessfulSourceCli,
  test,
  withFixtureWorkspace
} from "./support.ts";

test("decision relation filter evidence is sorted, preview-bounded, and fully detailed", () =>
  withFixtureWorkspace(
    "query-relation-evidence-window",
    async (workspaceRoot) => {
      const additionalTargets = ["evidence-a", "evidence-b", "evidence-c"];
      for (const target of additionalTargets) {
        await fs.writeFile(
          decisionFilePath(workspaceRoot, target),
          candidateDecisionBody({ id: target }),
          "utf8"
        );
        await runSuccessfulSourceCli([
          "activate",
          target,
          "--alignment",
          "aligned",
          "--root",
          workspaceRoot
        ]);
        await runSuccessfulSourceCli([
          "archive",
          target,
          "--root",
          workspaceRoot
        ]);
      }
      const currentPath = decisionFilePath(workspaceRoot, currentSourcePath);
      const currentText = await fs.readFile(currentPath, "utf8");
      await fs.writeFile(
        currentPath,
        currentText.replace(
          "relations:\n  - type: 修订\n    target: 260710-use-source-cli",
          "relations:\n" +
            "  - type: 修订\n    target: evidence-c\n    summary: C\n" +
            "  - type: 修订\n    target: evidence-a\n    summary: A\n" +
            "  - type: 修订\n    target: evidence-b\n    summary: B\n" +
            "  - type: 修订\n    target: 260710-use-source-cli\n    summary: 原有"
        ),
        "utf8"
      );
      await runSuccessfulSourceCli([
        "sync-index",
        "--write",
        "--root",
        workspaceRoot
      ]);

      const preview = await runSuccessfulSourceCli([
        "list",
        "--relation-type",
        "修订",
        "--root",
        workspaceRoot
      ]);
      const first = preview.indexOf(
        `${currentDecisionId} --修订--> 260710-use-source-cli`
      );
      const second = preview.indexOf(
        `${currentDecisionId} --修订--> evidence-a`
      );
      const third = preview.indexOf(
        `${currentDecisionId} --修订--> evidence-b`
      );
      assert.ok(first >= 0 && first < second && second < third);
      assert.match(preview, /\+1 more matching relations/);
      assert.doesNotMatch(
        preview,
        new RegExp(`${currentDecisionId} --修订--> evidence-c`)
      );

      const searchPreview = await runSuccessfulSourceCli([
        "search",
        "使用",
        "--relation-type",
        "修订",
        "--root",
        workspaceRoot
      ]);
      assert.match(searchPreview, /\+1 more matching relations/);
      assert.doesNotMatch(
        searchPreview,
        new RegExp(`${currentDecisionId} --修订--> evidence-c`)
      );

      const detail = await runSuccessfulSourceCli([
        "list",
        "--detail",
        "--relation-type",
        "修订",
        "--root",
        workspaceRoot
      ]);
      assert.match(
        detail,
        new RegExp(`${currentDecisionId} --修订--> evidence-c: "C"`)
      );
      assert.doesNotMatch(detail, /more matching relations/);
    }
  ));

test("decision list and search combine direct relation conditions", () =>
  withFixtureWorkspace("query-related-records", async (workspaceRoot) => {
    const apiResult = await executeDecisionQuery({
      alignment: "all",
      command: "list",
      direction: "predecessors",
      limit: 10,
      location: { decisionsDir: "docs/decisions", workspaceRoot },
      offset: 0,
      relatedTo: currentDecisionId,
      status: "all",
      tags: []
    });
    assert.equal(apiResult.status, "ok");
    assert.equal(apiResult.command, "list");
    assert.deepEqual(
      apiResult.records.map((record) => record.decisionId),
      [archivedDecisionId]
    );
    assert.deepEqual(apiResult.records[0]?.filterRelations, [
      {
        sourceId: currentDecisionId,
        target: archivedDecisionId,
        type: "修订"
      }
    ]);

    const predecessors = await runSuccessfulSourceCli([
      "list",
      "--related-to",
      currentDecisionId,
      "--direction",
      "predecessors",
      "--status",
      "archived",
      "--tag",
      "decision-records",
      "--root",
      workspaceRoot
    ]);
    assert.match(
      decisionMatchLines(predecessors),
      new RegExp(archivedDecisionId)
    );
    assert.match(
      predecessors,
      new RegExp(
        `relation-filter evidence:\\n    - ${currentDecisionId} --修订--> ${archivedDecisionId}: \\[无摘要\\]`
      )
    );

    const successors = await runSuccessfulSourceCli([
      "list",
      "--related-to",
      "use-source-cli",
      "--direction",
      "successors",
      "--root",
      workspaceRoot
    ]);
    assert.match(decisionMatchLines(successors), new RegExp(currentDecisionId));
    assert.match(successors, /relation-filter evidence:/);

    const both = await runSuccessfulSourceCli([
      "list",
      "--related-to",
      archivedDecisionId,
      "--root",
      workspaceRoot
    ]);
    assert.match(decisionMatchLines(both), new RegExp(currentDecisionId));

    const relationType = await runSuccessfulSourceCli([
      "list",
      "--relation-type",
      "修订",
      "--root",
      workspaceRoot
    ]);
    assert.match(
      decisionMatchLines(relationType),
      new RegExp(currentDecisionId)
    );
    assert.match(relationType, /relation-filter evidence:/);

    const mismatchedType = await runSuccessfulSourceCli([
      "list",
      "--related-to",
      currentDecisionId,
      "--direction",
      "predecessors",
      "--relation-type",
      "替代",
      "--status",
      "all",
      "--root",
      workspaceRoot
    ]);
    assert.match(mismatchedType, /- none/);

    const content = await runSourceCli([
      "search",
      "生成 CLI",
      "--related-to",
      archivedDecisionId,
      "--direction",
      "successors",
      "--root",
      workspaceRoot
    ]);
    assert.equal(content.exitCode, 0, content.stderr);
    assert.match(content.stdout, new RegExp(currentDecisionId));
    assert.match(content.stdout, /relation-filter evidence:/);

    const metadata = await runSuccessfulSourceCli([
      "search",
      "生成 CLI",
      "--in",
      "metadata",
      "--related-to",
      archivedDecisionId,
      "--root",
      workspaceRoot
    ]);
    assert.match(metadata, new RegExp(currentDecisionId));
    assert.match(metadata, /matchedRelations:\n    - none/);
    assert.match(metadata, /relation-filter evidence:/);

    const indexPath = path.join(
      workspaceRoot,
      "docs",
      "decisions",
      "decision-index.json"
    );
    const indexBeforeFallback = await fs.readFile(indexPath, "utf8");
    const currentSource = decisionFilePath(workspaceRoot, currentSourcePath);
    const currentText = await fs.readFile(currentSource, "utf8");
    await fs.writeFile(
      currentSource,
      currentText
        .replace(
          "relations:\n  - type: 修订\n    target: 260710-use-source-cli",
          "relations:\n  - type: 替代\n    target: 260710-use-source-cli"
        )
        .replace("## 背景", "关系回退正文词。\n\n## 背景"),
      "utf8"
    );
    const fallback = await runSourceCli([
      "search",
      "关系回退正文词",
      "--related-to",
      archivedDecisionId,
      "--direction",
      "successors",
      "--root",
      workspaceRoot
    ]);
    assert.equal(fallback.exitCode, 0, fallback.stderr);
    assert.match(fallback.stdout, new RegExp(currentDecisionId));
    assert.match(
      fallback.stdout,
      new RegExp(
        `${currentDecisionId} --替代--> ${archivedDecisionId}: \\[无摘要\\]`
      )
    );
    assert.match(
      fallback.stderr,
      /read-only validated Decision source projection/
    );
    const staleTypeMustNotSelect = await runSourceCli([
      "search",
      "关系回退正文词",
      "--related-to",
      archivedDecisionId,
      "--direction",
      "successors",
      "--relation-type",
      "修订",
      "--root",
      workspaceRoot
    ]);
    assert.equal(
      staleTypeMustNotSelect.exitCode,
      0,
      staleTypeMustNotSelect.stderr
    );
    assert.match(staleTypeMustNotSelect.stdout, /- none/);
    assert.equal(await fs.readFile(indexPath, "utf8"), indexBeforeFallback);

    const directionWithoutTarget = await runSourceCli([
      "list",
      "--direction",
      "both",
      "--root",
      workspaceRoot
    ]);
    assert.equal(directionWithoutTarget.exitCode, 2);
  }));

test("decision list defaults to active records without archived results", () =>
  withFixtureWorkspace("query-list-default", async (workspaceRoot) => {
    const listed = await runSuccessfulSourceCli([
      "list",
      "--root",
      workspaceRoot
    ]);
    assert.match(listed, new RegExp(currentDecisionId));
    assert.doesNotMatch(listed, new RegExp(archivedDecisionId));
  }));

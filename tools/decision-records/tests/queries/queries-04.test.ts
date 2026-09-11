import {
  archivedDecisionId,
  assert,
  candidateDecisionBody,
  currentDecisionId,
  decisionMatchLines,
  executeDecisionQuery,
  fs,
  path,
  runSourceCli,
  runSuccessfulSourceCli,
  test,
  withFixtureWorkspace,
  writeDecision
} from "./support.ts";

test("decision list status all includes both lifecycles and full timestamps", () =>
  withFixtureWorkspace("query-list-all", async (workspaceRoot) => {
    const listed = await runSuccessfulSourceCli([
      "list",
      "--status",
      "all",
      "--full-time",
      "--root",
      workspaceRoot
    ]);
    assert.match(listed, new RegExp(currentDecisionId));
    assert.match(listed, new RegExp(archivedDecisionId));
    assert.match(listed, /active\/aligned/);
    assert.match(listed, /archived\/unaligned/);
    assert.doesNotMatch(listed, /unknown|null/);
    assert.match(listed, /2026-07-11T14:15:16\+08:00/);
    assert.match(listed, /2026-07-10T09:10:11\+08:00/);
  }));

test("decision list returns snapshot facets with recent stable pages and inclusive createdAt ranges", () =>
  withFixtureWorkspace("query-list-recent", async (workspaceRoot) => {
    await writeDecision(
      workspaceRoot,
      "alpha-tie.md",
      candidateDecisionBody({
        tags: ["decision-records", "project-tooling"],
        title: "同一时刻的稳定排序记录"
      })
        .replace("status: candidate", "status: active")
        .replace("alignment: null", "alignment: aligned")
        .replace("createdAt: null", "createdAt: 2026-07-11T14:15:16+08:00")
    );
    const synced = await runSourceCli([
      "sync-index",
      "--write",
      "--root",
      workspaceRoot
    ]);
    assert.equal(synced.exitCode, 0, synced.stderr);

    const first = await executeDecisionQuery({
      alignment: "all",
      command: "list",
      createdAtFrom: "2026-07-11T06:15:16Z",
      createdAtTo: "2026-07-11T14:15:16+08:00",
      limit: 1,
      location: { decisionsDir: "docs/decisions", workspaceRoot },
      offset: 0,
      status: "active",
      tags: []
    });
    assert.equal(first.status, "ok");
    assert.equal(first.command, "list");
    assert.equal(first.total, 2);
    assert.deepEqual(first.facets.alignments, { aligned: 2, unaligned: 1 });
    assert.doesNotMatch(JSON.stringify(first), /unknown|null/);
    assert.deepEqual(
      first.records.map((record) => record.decisionId),
      ["alpha-tie"]
    );
    assert.deepEqual(first.facets.statuses, { active: 2, archived: 1 });
    assert.deepEqual(first.facets.createdAt.months, [
      { count: 3, month: "2026-07" }
    ]);

    const second = await executeDecisionQuery({
      alignment: "all",
      command: "list",
      createdAtFrom: "2026-07-11T06:15:16Z",
      createdAtTo: "2026-07-11T06:15:16Z",
      limit: 1,
      location: { decisionsDir: "docs/decisions", workspaceRoot },
      offset: 1,
      status: "active",
      tags: []
    });
    assert.equal(second.status, "ok");
    assert.equal(second.command, "list");
    assert.deepEqual(
      second.records.map((record) => record.decisionId),
      [currentDecisionId]
    );
  }));

test("decision CLI renders bounded compact and detailed list views without changing its index", () =>
  withFixtureWorkspace("query-list-rendering", async (workspaceRoot) => {
    for (const index of Array.from({ length: 32 }, (_, index) => index)) {
      const createdAt = new Date(Date.UTC(2024, index, 15, 12))
        .toISOString()
        .replace(".000Z", "Z");
      const suffix = String(index + 1).padStart(2, "0");
      await writeDecision(
        workspaceRoot,
        `preview-${suffix}`,
        candidateDecisionBody({
          tags: ["shared", `topic-${suffix}`],
          title: `预览记录 ${suffix}`
        })
          .replace("status: candidate", "status: active")
          .replace("alignment: null", "alignment: aligned")
          .replace("createdAt: null", `createdAt: ${createdAt}`)
      );
    }
    const synced = await runSourceCli([
      "sync-index",
      "--write",
      "--root",
      workspaceRoot
    ]);
    assert.equal(synced.exitCode, 0, synced.stderr);
    const indexPath = path.join(
      workspaceRoot,
      "docs",
      "decisions",
      "decision-index.json"
    );
    const before = await fs.readFile(indexPath, "utf8");
    const compact = await runSuccessfulSourceCli([
      "list",
      "--status",
      "all",
      "--limit",
      "1",
      "--root",
      workspaceRoot
    ]);
    assert.match(compact, /^Index filters \(34 records\):/u);
    assert.match(compact, /tags: shared=32[\s\S]*topic-27=1; \+5 more tags/u);
    assert.doesNotMatch(compact, /topic-28=1/u);
    assert.match(compact, /months \(UTC\):[\s\S]*2025-11=1; \+22 more months/u);
    assert.doesNotMatch(compact, /2025-10=1/u);
    assert.match(compact, /Applied filters: status=all/u);
    assert.match(compact, /Latest matches:\n- preview-32 /u);
    assert.doesNotMatch(decisionMatchLines(compact), /sourcePath:/u);
    assert.match(
      compact,
      /Showing 1 of 34 matches \(offset 0, limit 1\); 33 remaining; next offset 1\./u
    );

    const detailed = await runSuccessfulSourceCli([
      "list",
      "--status",
      "all",
      "--detail",
      "--limit",
      "1",
      "--root",
      workspaceRoot
    ]);
    assert.match(detailed, /Latest matches:\n- active aligned/u);
    assert.match(detailed, /  sourcePath: preview-32\.md/u);
    assert.match(detailed, /  purpose: /u);
    assert.match(detailed, /topic-32=1/u);
    assert.match(detailed, /2024-01=1/u);

    const outOfRange = await runSuccessfulSourceCli([
      "list",
      "--status",
      "all",
      "--offset",
      "99",
      "--root",
      workspaceRoot
    ]);
    assert.match(outOfRange, /^Index filters \(34 records\):/u);
    assert.match(outOfRange, /Latest matches:\n- none/u);
    assert.match(
      outOfRange,
      /Showing 0 of 34 matches \(offset 99, limit 10\); 0 remaining\./u
    );
    assert.equal(await fs.readFile(indexPath, "utf8"), before);
  }));

test("decision list reports empty results for unmatched tag and alignment filters", () =>
  withFixtureWorkspace("query-list-empty", async (workspaceRoot) => {
    const unmatchedTag = await runSuccessfulSourceCli([
      "list",
      "--tag",
      "unmatched-tag",
      "--root",
      workspaceRoot
    ]);
    assert.match(unmatchedTag, /- none/);
    const unmatchedAlignment = await runSuccessfulSourceCli([
      "list",
      "--alignment",
      "unaligned",
      "--root",
      workspaceRoot
    ]);
    assert.match(unmatchedAlignment, /- none/);
  }));

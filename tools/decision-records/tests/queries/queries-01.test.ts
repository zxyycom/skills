import {
  archivedDecisionId,
  assert,
  candidateDecisionBody,
  currentDecisionId,
  currentSourcePath,
  decisionFilePath,
  execFileSync,
  fs,
  normalizeDecisionSelectorInput,
  parseDatedDecisionId,
  path,
  runSourceCli,
  runSuccessfulSourceCli,
  test,
  utcDecisionDate,
  validateDecisionRecords,
  withFixtureWorkspace,
  withTemporaryWorkspace
} from "./support.ts";

test("decision check validates tagged root and archive records", () =>
  withFixtureWorkspace("query-check", async (workspaceRoot) => {
    const validation = await validateDecisionRecords({ workspaceRoot });
    assert.deepEqual(validation.errors, []);
    assert.equal(validation.decisionCount, 2);
    assert.equal(validation.activeCount, 1);
    assert.equal(validation.archivedCount, 1);
  }));

test("decision show returns tagged Markdown by stable ID", () =>
  withFixtureWorkspace("query-show", async (workspaceRoot) => {
    const shown = await runSuccessfulSourceCli([
      "show",
      currentDecisionId,
      "--root",
      workspaceRoot
    ]);
    assert.match(shown, /tags:/);
    assert.match(shown, /^alignment: aligned$/m);
    const archived = await runSuccessfulSourceCli([
      "show",
      archivedDecisionId,
      "--root",
      workspaceRoot
    ]);
    assert.match(archived, /^alignment: unaligned$/m);
  }));

test("ordinary selectors use dated IDs first and name fallback without reading paths", () =>
  withTemporaryWorkspace("dated-selectors", async (workspaceRoot) => {
    const firstId = "260901-shared-topic";
    const secondId = "260902-shared-topic";
    const legacyDateLikeName = "991332-invalid-date";
    for (const [sourcePath, id] of [
      ["first-semantic-name", firstId],
      ["second-semantic-name", secondId],
      ["invalid-date-name", legacyDateLikeName]
    ] as const) {
      await fs.mkdir(
        path.dirname(decisionFilePath(workspaceRoot, sourcePath)),
        { recursive: true }
      );
      await fs.writeFile(
        decisionFilePath(workspaceRoot, sourcePath),
        candidateDecisionBody({ id }),
        "utf8"
      );
    }

    const exact = await runSourceCli([
      "show-candidate",
      `${firstId}.MD`,
      "--root",
      workspaceRoot
    ]);
    assert.equal(exact.exitCode, 0, exact.stderr);
    assert.match(exact.stdout, new RegExp(`id: ${firstId}`));

    const ambiguous = await runSourceCli([
      "show-candidate",
      "shared-topic",
      "--root",
      workspaceRoot
    ]);
    assert.equal(ambiguous.exitCode, 1);
    assert.match(ambiguous.stderr, new RegExp(`${firstId}, ${secondId}`));
    const invalidDateName = await runSourceCli([
      "show-candidate",
      legacyDateLikeName,
      "--root",
      workspaceRoot
    ]);
    assert.equal(invalidDateName.exitCode, 0, invalidDateName.stderr);
    const missingExact = await runSourceCli([
      "show-candidate",
      "260903-shared-topic",
      "--root",
      workspaceRoot
    ]);
    assert.equal(missingExact.exitCode, 1);
    assert.match(missingExact.stderr, /does not exist/);

    const created = await runSourceCli([
      "new",
      "fresh-topic",
      "--title",
      "日期身份候选",
      "--purpose",
      "创建时固定 UTC 日期。",
      "--background",
      "名称不会承担唯一身份。",
      "--decision",
      "采用日期前缀身份。",
      "--tag",
      "decision-records",
      "--root",
      workspaceRoot
    ]);
    assert.equal(created.exitCode, 0, created.stderr);
    assert.match(
      await fs.readFile(decisionFilePath(workspaceRoot, "fresh-topic"), "utf8"),
      new RegExp(`id: ${utcDecisionDate()}-fresh-topic`)
    );
    const mismatch = await runSourceCli([
      "new",
      "250101-wrong-date",
      "--title",
      "日期不一致",
      "--purpose",
      "直接 ID 必须匹配形成日。",
      "--background",
      "日期自动形成不可关闭。",
      "--decision",
      "拒绝日期不一致输入。",
      "--tag",
      "decision-records",
      "--root",
      workspaceRoot
    ]);
    assert.equal(mismatch.exitCode, 1);
    assert.match(mismatch.stderr, /new-formation-date-mismatch/);

    await fs.writeFile(
      decisionFilePath(workspaceRoot, "legacy-date-conflict"),
      candidateDecisionBody({ id: "legacy-date-conflict" }),
      "utf8"
    );
    const conflicted = await runSourceCli([
      "new",
      "legacy-date-conflict",
      "--title",
      "Legacy 冲突重试",
      "--purpose",
      "同名 legacy 应先迁移。",
      "--background",
      "新建不得隐式改名。",
      "--decision",
      "零写入返回迁移要求。",
      "--tag",
      "decision-records",
      "--root",
      workspaceRoot
    ]);
    assert.equal(conflicted.exitCode, 1);
    assert.match(conflicted.stderr, /migration-required/);

    assert.equal(normalizeDecisionSelectorInput("topic.MD"), "topic");
    assert.equal(normalizeDecisionSelectorInput("topic.md.md"), "topic.md");
    assert.equal(parseDatedDecisionId("991332-topic"), null);
    assert.equal(parseDatedDecisionId("nested/topic"), null);
  }));

test("decision trace follows stable ID relations", () =>
  withFixtureWorkspace("query-trace", async (workspaceRoot) => {
    const traced = await runSuccessfulSourceCli([
      "trace",
      currentDecisionId,
      "--root",
      workspaceRoot
    ]);
    assert.match(traced, new RegExp(archivedDecisionId));
    assert.match(traced, /- active aligned use-generated-cli/);
    assert.match(traced, /- archived unaligned 260710-use-source-cli/);
    assert.doesNotMatch(traced, /unknown|null/);
  }));

test("check detects tagged source drift and sync-index accepts it", () =>
  withFixtureWorkspace("query-drift", async (workspaceRoot) => {
    const source = decisionFilePath(workspaceRoot, currentSourcePath);
    await fs.writeFile(
      source,
      (await fs.readFile(source, "utf8")).replace(
        "  - project-tooling",
        "  - decision-records\n  - project-tooling"
      ),
      "utf8"
    );
    const check = await runSourceCli(["check", "--root", workspaceRoot]);
    assert.notEqual(check.exitCode, 0);
    assert.equal(
      (await runSourceCli(["sync-index", "--root", workspaceRoot])).exitCode,
      0
    );
  }));

test("decision check preserves source, bundled API, and process CLI parity", () =>
  withFixtureWorkspace("query-parity", async (workspaceRoot) => {
    const source = await validateDecisionRecords({ workspaceRoot });
    const bundled =
      await import("../../../../skills/decision-records/scripts/decision-records.mjs");
    const bundledResult = await bundled.validateDecisionRecords({
      workspaceRoot
    });
    assert.deepEqual(bundledResult, source);
    const output = execFileSync(
      "node",
      [
        "skills/decision-records/scripts/decision-records.mjs",
        "check",
        "--root",
        workspaceRoot
      ],
      { cwd: process.cwd(), encoding: "utf8" }
    );
    assert.match(output, /Decision records check passed/);
  }));

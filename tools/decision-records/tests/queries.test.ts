import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { validateDecisionRecords } from "../src/index.ts";
import { executeDecisionQuery } from "../src/decision-query-service.ts";
import {
  normalizeDecisionSelectorInput,
  parseDatedDecisionId,
  utcDecisionDate
} from "../src/decision-path.ts";
import {
  archivedDecisionId,
  candidateDecisionBody,
  currentDecisionId,
  currentSourcePath,
  decisionFilePath,
  runSourceCli,
  runSuccessfulSourceCli,
  withFixtureWorkspace,
  withTemporaryWorkspace,
  writeDecision
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
      await import("../../../skills/decision-records/scripts/decision-records.mjs");
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
    assert.match(listed, new RegExp(bothId));
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
    assert.match(listed, new RegExp(unalignedId));
    assert.doesNotMatch(listed, new RegExp(currentDecisionId));
    assert.doesNotMatch(listed, new RegExp(archivedDecisionId));
  }));

test("decision list and search combine direct relation conditions", () =>
  withFixtureWorkspace("query-related-records", async (workspaceRoot) => {
    const apiResult = await executeDecisionQuery({
      alignment: "all",
      command: "list",
      direction: "predecessors",
      fullTime: false,
      location: { decisionsDir: "docs/decisions", workspaceRoot },
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
    assert.match(predecessors, new RegExp(archivedDecisionId));
    assert.doesNotMatch(predecessors, new RegExp(currentDecisionId));

    const successors = await runSuccessfulSourceCli([
      "list",
      "--related-to",
      "use-source-cli",
      "--direction",
      "successors",
      "--root",
      workspaceRoot
    ]);
    assert.match(successors, new RegExp(currentDecisionId));
    assert.doesNotMatch(successors, new RegExp(archivedDecisionId));

    const both = await runSuccessfulSourceCli([
      "list",
      "--related-to",
      archivedDecisionId,
      "--root",
      workspaceRoot
    ]);
    assert.match(both, new RegExp(currentDecisionId));

    const relationType = await runSuccessfulSourceCli([
      "list",
      "--relation-type",
      "修订",
      "--root",
      workspaceRoot
    ]);
    assert.match(relationType, new RegExp(currentDecisionId));
    assert.doesNotMatch(relationType, new RegExp(archivedDecisionId));

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
    assert.doesNotMatch(content.stdout, new RegExp(archivedDecisionId));

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
    assert.match(listed, /2026-07-11T14:15:16\+08:00/);
    assert.match(listed, /2026-07-10T09:10:11\+08:00/);
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

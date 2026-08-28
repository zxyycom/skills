import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { test } from "node:test";
import { parseInvestigationReport } from "../src/markdown.ts";
import { validateInvestigationReports } from "../src/validation.ts";
import {
  investigationRoot,
  reportMarkdown,
  withTempRoot,
  writeCollection
} from "./v6-support.ts";

test("validation enforces report frontmatter fields and canonical ordering", () => {
  const source = reportMarkdown({ id: "valid-report.md" });
  assert.deepEqual(
    parseInvestigationReport(source, "valid-report.md").errors,
    []
  );
  const reordered = source.replace(
    'title: "valid-report"\nformedAt: "2026-08-28T12:00:00+00:00"',
    'formedAt: "2026-08-28T12:00:00+00:00"\ntitle: "valid-report"'
  );
  assert.ok(
    parseInvestigationReport(reordered, "valid-report.md").errors.some(
      (error) => error.includes("fixed order")
    )
  );
  const nonCanonicalEmptyRelations = source.replace(
    "relations: []",
    "relations:"
  );
  assert.ok(
    parseInvestigationReport(
      nonCanonicalEmptyRelations,
      "valid-report.md"
    ).errors.some((error) => error.includes("empty relations"))
  );
  const controlCharacter = source.replace(
    /question: "[^"]+"/u,
    'question: "bad\\rvalue"'
  );
  assert.ok(
    parseInvestigationReport(controlCharacter, "valid-report.md").errors.some(
      (error) => error.includes("question must be a non-empty")
    )
  );
});

test("validation enforces one report with fixed core and optional resource section", async () => {
  await withTempRoot("structure", async (root) => {
    await writeCollection(root, [{ id: "valid-report.md" }], false);
    await fs.writeFile(
      `${investigationRoot(root)}/old-topic.md`,
      "# 旧主题\n\n## 调查信息\n- 核心问题: 不允许\n",
      "utf8"
    );
    const result = await validateInvestigationReports({
      ids: ["old-topic.md"],
      workspaceRoot: root
    });
    assert.ok(result.errors.some((error) => error.includes("frontmatter")));
    const valid = reportMarkdown({ id: "valid-report.md" });
    const fencedHeadings = valid.replace(
      "形成此报告时的已知事实和边界。",
      "```markdown\n## fenced H2\n# fenced H1\n```\n形成此报告时的已知事实和边界。"
    );
    assert.deepEqual(
      parseInvestigationReport(fencedHeadings, "valid-report.md").errors,
      []
    );
    assert.deepEqual(
      parseInvestigationReport(
        `${valid}\n## 合规附加章节\n这里允许出现。\n`,
        "valid-report.md"
      ).errors,
      []
    );
    const withResources = reportMarkdown({
      id: "valid-report.md",
      resources: ["valid-report/evidence.txt"]
    });
    assert.deepEqual(
      parseInvestigationReport(
        `${withResources}\n## 资源后的附加章节\n这里允许出现。\n`,
        "valid-report.md"
      ).errors,
      []
    );
    assert.ok(
      parseInvestigationReport(
        valid.replace(
          "## 调查目的",
          "## 不允许插入\n这里不能位于核心之间。\n\n## 调查目的"
        ),
        "valid-report.md"
      ).errors.some((error) => error.includes("H2 section"))
    );
    assert.ok(
      parseInvestigationReport(
        withResources.replace(
          "## 随附资源",
          "## 资源前附加章节\n这里不能位于资源之前。\n\n## 随附资源"
        ),
        "valid-report.md"
      ).errors.some((error) => error.includes("immediately follow"))
    );
    assert.ok(
      parseInvestigationReport(
        withResources.replace("## 随附资源", "## 随附资源   "),
        "valid-report.md"
      ).errors.some((error) =>
        error.includes("resource heading must be exactly")
      )
    );
  });
});

test("scoped validation selects report ids without claiming full graph proof", async () => {
  await withTempRoot("scope", async (root) => {
    await writeCollection(root, [
      { id: "first-report.md" },
      { id: "second-report.md" }
    ]);
    await fs.mkdir(`${investigationRoot(root)}/unrelated-legacy-category`);
    const result = await validateInvestigationReports({
      ids: ["first-report.md"],
      workspaceRoot: root
    });
    assert.equal(result.errors.length, 0);
    assert.equal(result.indexChecked, false);
    assert.equal(result.selectedReportCount, 1);
    const nonCanonical = await validateInvestigationReports({
      ids: ["./first-report.md", " second-report.md "],
      workspaceRoot: root
    });
    assert.ok(nonCanonical.errors.every((error) => error.includes("check id")));
  });
});

test("validation enforces investigation directory path rules", async () => {
  const result = await validateInvestigationReports({
    investigationsDir: "/tmp",
    workspaceRoot: "."
  });
  assert.ok(result.errors.some((error) => error.includes("relative")));
});

test("validation reports malformed frontmatter fields in the selected report", async () => {
  await withTempRoot("malformed", async (root) => {
    await writeCollection(root, [{ id: "report.md" }], false);
    const file = `${investigationRoot(root)}/report.md`;
    await fs.writeFile(
      file,
      (await fs.readFile(file, "utf8")).replace(
        /question: "[^"]+"/u,
        'question: "bad\\rvalue"'
      ),
      "utf8"
    );
    const result = await validateInvestigationReports({
      ids: ["report.md"],
      workspaceRoot: root
    });
    assert.ok(
      result.errors.some((error) =>
        error.includes("question must be a non-empty")
      )
    );
  });
});

test("full validation rejects nested report directories", async () => {
  await withTempRoot("layout", async (root) => {
    await writeCollection(root, [{ id: "report.md" }], false);
    await fs.mkdir(`${investigationRoot(root)}/legacy-category`);
    const result = await validateInvestigationReports({ workspaceRoot: root });
    assert.ok(result.errors.some((error) => error.includes("not allowed")));
  });
});

test("full validation rejects unknown investigation root members", async () => {
  await withTempRoot("unknown-root-member", async (root) => {
    await writeCollection(root, [{ id: "report.md" }], false);
    await fs.writeFile(
      `${investigationRoot(root)}/unexpected.txt`,
      "x",
      "utf8"
    );
    const result = await validateInvestigationReports({ workspaceRoot: root });
    assert.ok(
      result.errors.some((error) =>
        error.includes(
          "unexpected.txt must be a root-level Investigation ID Markdown file"
        )
      )
    );
  });
});

test("full validation rejects an empty report collection", async () => {
  await withTempRoot("empty-layout", async (root) => {
    await fs.mkdir(investigationRoot(root), { recursive: true });
    const result = await validateInvestigationReports({ workspaceRoot: root });
    assert.ok(
      result.errors.some((error) => error.includes("at least one report"))
    );
  });
});

test("public APIs diagnose malformed runtime options without throwing", async () => {
  const result = await validateInvestigationReports({
    workspaceRoot: 1
  } as unknown as { workspaceRoot: string });
  assert.ok(result.errors.some((error) => error.includes("must be a string")));
});

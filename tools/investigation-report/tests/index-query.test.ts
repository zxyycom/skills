import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import {
  queryStateIndex,
  type StateIndex
} from "../../index-runtime/src/index.ts";
import {
  createInvestigationStateIndexDefinition,
  investigationIndexFileName,
  loadCurrentInvestigationIndex
} from "../src/investigation-state-index.ts";
import { queryInvestigationIndex } from "../src/query.ts";
import {
  synchronizeInvestigationIndex,
  validateInvestigationReports
} from "../src/validation.ts";
import {
  createValidReports,
  investigationRoot,
  reportMarkdown,
  resultValue,
  type ReportInput,
  withTempRoot,
  writeCollection
} from "./support.ts";

async function testValidIndexAndQueries(tempRoot: string): Promise<void> {
  const workspaceRoot = path.join(tempRoot, "valid-index");
  await writeCollection(workspaceRoot, createValidReports());

  const valid = await validateInvestigationReports({ workspaceRoot });
  assert.deepEqual(valid.errors, []);
  assert.equal(valid.indexChecked, true);
  assert.equal(valid.availableTopicCount, 2);
  assert.equal(valid.selectedTopicCount, 2);
  assert.equal(valid.categoryCount, 2);

  const collectionRoot = investigationRoot(workspaceRoot);
  const validIndex = JSON.parse(await fs.readFile(
    path.join(collectionRoot, investigationIndexFileName),
    "utf8"
  )) as StateIndex;
  assert.equal(validIndex.schemaVersion, 2);
  assert.deepEqual(validIndex.metadata, {});
  assert.equal(validIndex.namespace, "investigations");
  assert.equal(validIndex.definitionVersion, 2);
  assert.match(validIndex.sourceRevision, /^sha256:[0-9a-f]{64}$/u);
  assert.deepEqual(
    validIndex.entries.map((entry) => entry.id),
    [
      "codex/project-shell-registration.md",
      "runtime/process-churn.md"
    ]
  );

  const codexEntry = validIndex.entries[0];
  assert.deepEqual(codexEntry.state, {
    latestReportAt: "2026-07-21T09:00:00+08:00",
    path: "codex/project-shell-registration.md",
    question: "为什么项目 Shell 没有进入可用工具列表？",
    reportCount: 2,
    reportTitles: ["恢复注册入口", "复查当前注册状态"],
    status: "调查中",
    title: "项目 Shell 注册调查"
  });
  assert.deepEqual(codexEntry.keys.category, ["codex"]);
  assert.deepEqual(codexEntry.keys.status, ["调查中"]);
  assert.deepEqual(codexEntry.keys.text, [
    "为什么项目 Shell 没有进入可用工具列表？",
    "复查当前注册状态",
    "恢复注册入口",
    "项目 Shell 注册调查"
  ]);
  assert.deepEqual(codexEntry.keys["latest-report-at"], [
    Date.parse("2026-07-21T09:00:00+08:00")
  ]);

  const loadedIndex = resultValue(await loadCurrentInvestigationIndex({
    investigationsDirectory: collectionRoot
  }));
  const queriedIndex = resultValue(queryStateIndex({
    definition: createInvestigationStateIndexDefinition(),
    index: loadedIndex,
    query: {
      filters: [
        {
          key: "status",
          kind: "exact",
          operator: "all",
          values: ["暂停"]
        },
        {
          key: "text",
          kind: "text",
          operator: "all",
          text: "进程 抖动"
        }
      ]
    }
  }));
  assert.deepEqual(queriedIndex.metadata, {});
  assert.deepEqual(
    queriedIndex.entries.map((entry) => entry.id),
    ["runtime/process-churn.md"]
  );

  const domainQuery = await queryInvestigationIndex({
    statuses: ["暂停"],
    text: "进程 抖动",
    workspaceRoot
  });
  assert.deepEqual(domainQuery.errors, []);
  assert.equal(domainQuery.total, 1);
  assert.deepEqual(
    domainQuery.entries.map((entry) => entry.path),
    ["runtime/process-churn.md"]
  );

  const historicalReportTitleQuery = await queryInvestigationIndex({
    text: "恢复 注册",
    workspaceRoot
  });
  assert.deepEqual(historicalReportTitleQuery.errors, []);
  assert.deepEqual(
    historicalReportTitleQuery.entries.map((entry) => entry.path),
    ["codex/project-shell-registration.md"]
  );

  const secondPage = await queryInvestigationIndex({
    limit: 1,
    offset: 1,
    workspaceRoot
  });
  assert.deepEqual(secondPage.errors, []);
  assert.equal(secondPage.total, 2);
  assert.deepEqual(
    secondPage.entries.map((entry) => entry.path),
    ["runtime/process-churn.md"]
  );
}

async function testStaleAndTamperedIndexes(tempRoot: string): Promise<void> {
  const workspaceRoot = path.join(tempRoot, "stale-index");
  const firstStaleReport: ReportInput = {
    path: "runtime/first-report.md",
    question: "新增主题文件是否会使派生索引失效？",
    title: "首个索引成员调查"
  };
  const addedStaleReport: ReportInput = {
    path: "runtime/added-report.md",
    question: "新增文件是否会由同步自动吸收？",
    title: "新增索引成员调查"
  };
  await writeCollection(workspaceRoot, [firstStaleReport]);

  const addedStalePath = path.join(
    investigationRoot(workspaceRoot),
    ...addedStaleReport.path.split("/")
  );
  await fs.writeFile(
    addedStalePath,
    reportMarkdown(addedStaleReport),
    "utf8"
  );

  const stale = await validateInvestigationReports({ workspaceRoot });
  assert.equal(stale.indexChecked, true);
  assert.ok(stale.errors.some((error) => (
    error.includes(investigationIndexFileName)
    && error.includes("does not match the current state projection")
  )));

  const staleQuery = await queryInvestigationIndex({ workspaceRoot });
  assert.ok(staleQuery.errors.some((error) => (
    error.includes(investigationIndexFileName)
    && error.includes("does not match source revision")
  )));
  assert.deepEqual(staleQuery.entries, []);

  const isolatedAddedReport = await validateInvestigationReports({
    paths: [addedStaleReport.path],
    workspaceRoot
  });
  assert.deepEqual(isolatedAddedReport.errors, []);
  assert.equal(isolatedAddedReport.indexChecked, false);

  const resynchronized = await synchronizeInvestigationIndex({
    workspaceRoot
  });
  assert.deepEqual(resynchronized.errors, []);
  assert.equal(resynchronized.changed, true);
  assert.deepEqual(
    (await validateInvestigationReports({ workspaceRoot })).errors,
    []
  );
  const resynchronizedIndex = resultValue(await loadCurrentInvestigationIndex({
    investigationsDirectory: investigationRoot(workspaceRoot)
  }));
  assert.deepEqual(
    resynchronizedIndex.entries.map((entry) => entry.id),
    ["runtime/added-report.md", "runtime/first-report.md"]
  );

  const indexPath = path.join(
    investigationRoot(workspaceRoot),
    investigationIndexFileName
  );
  const indexSource = await fs.readFile(indexPath, "utf8");
  await fs.writeFile(
    indexPath,
    indexSource.replace("新增索引成员调查", "被篡改的索引标题"),
    "utf8"
  );
  const tampered = await validateInvestigationReports({ workspaceRoot });
  assert.ok(tampered.errors.some((error) => (
    error.includes(investigationIndexFileName)
    && error.includes(
      "does not match its id and keys under the runtime definition"
    )
  )));
  assert.equal(
    (await synchronizeInvestigationIndex({ workspaceRoot })).changed,
    true
  );

  const restoredIndex = await fs.readFile(indexPath, "utf8");
  await fs.writeFile(
    indexPath,
    restoredIndex.replace("\"reportCount\": 1", "\"reportCount\": 2"),
    "utf8"
  );
  const invalidCount = await queryInvestigationIndex({ workspaceRoot });
  assert.ok(
    invalidCount.errors.some((error) => (
      error.includes("reportCount must equal the number of reportTitles")
    )),
    invalidCount.errors.join("; ")
  );
  assert.equal(
    (await synchronizeInvestigationIndex({ workspaceRoot })).changed,
    true
  );
}

export async function runIndexAndQueryTests(): Promise<void> {
  await withTempRoot("index-query", async (tempRoot) => {
    await testValidIndexAndQueries(tempRoot);
    await testStaleAndTamperedIndexes(tempRoot);
  });
}

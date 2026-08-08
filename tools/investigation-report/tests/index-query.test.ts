import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  parseStateIndex,
  queryStateIndex,
  type StateIndex
} from "../../index-runtime/src/index.ts";
import {
  createInvestigationStateIndexDefinition,
  investigationSourceRevision,
  investigationIndexFileName,
  loadCurrentInvestigationIndex,
  readInvestigationSourceRevision,
  readInvestigationStateSnapshot
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
  assert.equal(validIndex.schemaVersion, 3);
  assert.deepEqual(validIndex.metadata, {});
  assert.equal(validIndex.namespace, "investigations");
  assert.equal(validIndex.definitionVersion, 2);
  assert.match(
    validIndex.sourceRevision.metadata,
    /^sha256:[0-9a-f]{64}$/u
  );
  assert.ok(Object.values(validIndex.sourceRevision.entries).every(
    (fingerprint) => /^sha256:[0-9a-f]{64}$/u.test(fingerprint)
  ));
  assert.deepEqual(
    Object.keys(validIndex.entries),
    [
      "codex/project-shell-registration.md",
      "runtime/process-churn.md"
    ]
  );
  assert.deepEqual(
    Object.keys(validIndex.sourceRevision.entries),
    Object.keys(validIndex.entries)
  );

  const codexEntry = validIndex.entries["codex/project-shell-registration.md"]!;
  assert.equal(Object.hasOwn(codexEntry, "id"), false);
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
    && error.includes("does not match the current source revision")
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
    Object.keys(resynchronizedIndex.entries),
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
      "does not match its keys under the runtime definition"
    )
  )));
  assert.equal(
    (await synchronizeInvestigationIndex({ workspaceRoot })).changed,
    true
  );

  const restoredIndex = await fs.readFile(indexPath, "utf8");
  const schemaV2 = parseStateIndex({
    definition: createInvestigationStateIndexDefinition(),
    expectation: {
      definitionVersion: 2,
      namespace: "investigations"
    },
    sourcePath: investigationIndexFileName,
    text: restoredIndex.replace(
      "\"schemaVersion\": 3",
      "\"schemaVersion\": 2"
    )
  });
  assert.equal(schemaV2.status, "error");
  assert.ok(schemaV2.diagnostics.some((diagnostic) => (
    diagnostic.message.includes("schema version 2 is unsupported; expected 3")
  )));

  const invalidRevisionIndex = JSON.parse(restoredIndex) as StateIndex;
  invalidRevisionIndex.sourceRevision = {
    ...invalidRevisionIndex.sourceRevision,
    entries: {
      ...invalidRevisionIndex.sourceRevision.entries,
      "runtime/added-report.md": "not-a-sha256"
    }
  };
  const invalidRevision = parseStateIndex({
    definition: createInvestigationStateIndexDefinition(),
    expectation: {
      definitionVersion: 2,
      namespace: "investigations"
    },
    sourcePath: investigationIndexFileName,
    text: JSON.stringify(invalidRevisionIndex)
  });
  assert.equal(invalidRevision.status, "error");
  assert.ok(invalidRevision.diagnostics.some((diagnostic) => (
    diagnostic.message.includes(
      "must be a sha256 investigation source fingerprint"
    )
  )), invalidRevision.diagnostics.map((entry) => entry.message).join("; "));

  const mismatchedPathIndex = JSON.parse(restoredIndex) as {
    entries: Record<string, { state: { path: string } }>;
  };
  mismatchedPathIndex.entries["runtime/added-report.md"]!.state.path =
    "runtime/mismatched-id.md";
  const mismatchedPath = parseStateIndex({
    definition: createInvestigationStateIndexDefinition(),
    expectation: {
      definitionVersion: 2,
      namespace: "investigations"
    },
    sourcePath: investigationIndexFileName,
    text: JSON.stringify(mismatchedPathIndex)
  });
  assert.equal(mismatchedPath.status, "error");
  assert.ok(mismatchedPath.diagnostics.some((diagnostic) => (
    diagnostic.message.includes("state.path must equal the entry id")
  )));

  const invalidCount = parseStateIndex({
    definition: createInvestigationStateIndexDefinition(),
    expectation: {
      definitionVersion: 2,
      namespace: "investigations"
    },
    sourcePath: investigationIndexFileName,
    text: restoredIndex.replace("\"reportCount\": 1", "\"reportCount\": 2")
  });
  assert.equal(invalidCount.status, "error");
  assert.ok(
    invalidCount.diagnostics.some((diagnostic) => (
      diagnostic.message.includes(
        "reportCount must equal the number of reportTitles"
      )
    )),
    invalidCount.diagnostics.map((entry) => entry.message).join("; ")
  );
}

test("index queries return filtered and paginated investigation states", () => (
  withTempRoot("index-query-valid", testValidIndexAndQueries)
));

test("index loading rejects stale and tampered investigation indexes", () => (
  withTempRoot("index-query-stale", testStaleAndTamperedIndexes)
));

test("source revisions partition metadata and topic fingerprints without parsing Markdown", () => (
  withTempRoot("source-revision", async (tempRoot) => {
    const workspaceRoot = path.join(tempRoot, "source-revision");
    const reports = createValidReports();
    await writeCollection(workspaceRoot, reports, false);
    const collectionRoot = investigationRoot(workspaceRoot);

    const snapshot = await readInvestigationStateSnapshot(collectionRoot);
    const revision = await readInvestigationSourceRevision(collectionRoot);
    assert.deepEqual(snapshot.sourceRevision, revision);
    assert.deepEqual(Object.keys(snapshot.states), reports.map(
      (report) => report.path
    ).sort());

    const sources = reports.map((report) => ({
      path: report.path,
      text: reportMarkdown(report)
    }));
    const reversed = investigationSourceRevision([...sources].reverse());
    assert.deepEqual(reversed, revision);
    assert.deepEqual(
      investigationSourceRevision(sources.map((source) => ({
        ...source,
        text: source.text.replace(/\n/gu, "\r\n")
      }))),
      revision
    );

    const changedPath = reports[0]!.path;
    const changedRevision = investigationSourceRevision(sources.map((source) => (
      source.path === changedPath
        ? { ...source, text: source.text + "not projected\n" }
        : source
    )));
    assert.equal(changedRevision.metadata, revision.metadata);
    assert.notEqual(
      changedRevision.entries[changedPath],
      revision.entries[changedPath]
    );
    for (const report of reports.slice(1)) {
      assert.equal(
        changedRevision.entries[report.path],
        revision.entries[report.path]
      );
    }
    const removedRevision = investigationSourceRevision(sources.slice(1));
    assert.equal(removedRevision.metadata, revision.metadata);
    assert.deepEqual(
      Object.keys(removedRevision.entries),
      reports.slice(1).map((report) => report.path)
    );
    for (const report of reports.slice(1)) {
      assert.equal(
        removedRevision.entries[report.path],
        revision.entries[report.path]
      );
    }

    const invalidPath = path.join(collectionRoot, ...changedPath.split("/"));
    await fs.writeFile(invalidPath, "not a report\n", "utf8");
    const unparsedRevision = await readInvestigationSourceRevision(
      collectionRoot
    );
    assert.match(
      unparsedRevision.entries[changedPath]!,
      /^sha256:[0-9a-f]{64}$/u
    );
    await assert.rejects(
      readInvestigationStateSnapshot(collectionRoot),
      /must contain exactly one H1/
    );
  })
));

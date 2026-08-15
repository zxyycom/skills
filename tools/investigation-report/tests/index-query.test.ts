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
  readInvestigationStateSnapshot,
  syncInvestigationStateIndex
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
  const validIndex = JSON.parse(
    await fs.readFile(
      path.join(collectionRoot, investigationIndexFileName),
      "utf8"
    )
  ) as StateIndex;
  assert.equal(validIndex.schemaVersion, 3);
  assert.deepEqual(validIndex.metadata, { resources: [] });
  assert.equal(validIndex.namespace, "investigations");
  assert.equal(validIndex.definitionVersion, 4);
  assert.match(validIndex.sourceRevision.metadata, /^sha256:[0-9a-f]{64}$/u);
  assert.ok(
    Object.values(validIndex.sourceRevision.entries).every((fingerprint) =>
      /^sha256:[0-9a-f]{64}$/u.test(fingerprint)
    )
  );
  assert.deepEqual(Object.keys(validIndex.entries), [
    "codex/project-shell-registration.md",
    "runtime/process-churn.md"
  ]);
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
    resourceReferences: [],
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

  const loadedIndex = resultValue(
    await loadCurrentInvestigationIndex({
      investigationsDirectory: collectionRoot
    })
  );
  const queriedIndex = resultValue(
    queryStateIndex({
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
    })
  );
  assert.deepEqual(queriedIndex.metadata, { resources: [] });
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
  await fs.writeFile(addedStalePath, reportMarkdown(addedStaleReport), "utf8");

  const stale = await validateInvestigationReports({ workspaceRoot });
  assert.equal(stale.indexChecked, true);
  assert.ok(
    stale.errors.some(
      (error) =>
        error.includes(investigationIndexFileName) &&
        error.includes("does not match the current state projection")
    )
  );

  const staleQuery = await queryInvestigationIndex({ workspaceRoot });
  assert.ok(
    staleQuery.errors.some(
      (error) =>
        error.includes(investigationIndexFileName) &&
        error.includes("does not match the current source revision")
    )
  );
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
  const resynchronizedIndex = resultValue(
    await loadCurrentInvestigationIndex({
      investigationsDirectory: investigationRoot(workspaceRoot)
    })
  );
  assert.deepEqual(Object.keys(resynchronizedIndex.entries), [
    "runtime/added-report.md",
    "runtime/first-report.md"
  ]);

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
  assert.ok(
    tampered.errors.some(
      (error) =>
        error.includes(investigationIndexFileName) &&
        error.includes("does not match its keys under the runtime definition")
    )
  );
  assert.equal(
    (await synchronizeInvestigationIndex({ workspaceRoot })).changed,
    true
  );

  const restoredIndex = await fs.readFile(indexPath, "utf8");
  const schemaV2 = parseStateIndex({
    definition: createInvestigationStateIndexDefinition(),
    expectation: {
      definitionVersion: 4,
      namespace: "investigations"
    },
    sourcePath: investigationIndexFileName,
    text: restoredIndex.replace('"schemaVersion": 3', '"schemaVersion": 2')
  });
  assert.equal(schemaV2.status, "error");
  assert.ok(
    schemaV2.diagnostics.some((diagnostic) =>
      diagnostic.message.includes("schema version 2 is unsupported; expected 3")
    )
  );

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
      definitionVersion: 4,
      namespace: "investigations"
    },
    sourcePath: investigationIndexFileName,
    text: JSON.stringify(invalidRevisionIndex)
  });
  assert.equal(invalidRevision.status, "error");
  assert.ok(
    invalidRevision.diagnostics.some((diagnostic) =>
      diagnostic.message.includes(
        "must be a sha256 investigation source fingerprint"
      )
    ),
    invalidRevision.diagnostics.map((entry) => entry.message).join("; ")
  );

  const mismatchedPathIndex = JSON.parse(restoredIndex) as {
    entries: Record<string, { state: { path: string } }>;
  };
  mismatchedPathIndex.entries["runtime/added-report.md"]!.state.path =
    "runtime/mismatched-id.md";
  const mismatchedPath = parseStateIndex({
    definition: createInvestigationStateIndexDefinition(),
    expectation: {
      definitionVersion: 4,
      namespace: "investigations"
    },
    sourcePath: investigationIndexFileName,
    text: JSON.stringify(mismatchedPathIndex)
  });
  assert.equal(mismatchedPath.status, "error");
  assert.ok(
    mismatchedPath.diagnostics.some((diagnostic) =>
      diagnostic.message.includes("state.path must equal the entry id")
    )
  );

  const invalidCount = parseStateIndex({
    definition: createInvestigationStateIndexDefinition(),
    expectation: {
      definitionVersion: 4,
      namespace: "investigations"
    },
    sourcePath: investigationIndexFileName,
    text: restoredIndex.replace('"reportCount": 1', '"reportCount": 2')
  });
  assert.equal(invalidCount.status, "error");
  assert.ok(
    invalidCount.diagnostics.some((diagnostic) =>
      diagnostic.message.includes(
        "reportCount must equal the number of reportTitles"
      )
    ),
    invalidCount.diagnostics.map((entry) => entry.message).join("; ")
  );

  const invalidResourceSha = parseStateIndex({
    definition: createInvestigationStateIndexDefinition(),
    expectation: {
      definitionVersion: 4,
      namespace: "investigations"
    },
    sourcePath: investigationIndexFileName,
    text: restoredIndex.replace(
      '"resources": []',
      '"resources": [{"id": "sample.txt", "sha256": "not-a-sha256"}]'
    )
  });
  assert.equal(invalidResourceSha.status, "error");
  assert.ok(
    invalidResourceSha.diagnostics.some((diagnostic) =>
      diagnostic.message.includes("must be a lowercase SHA-256 digest")
    )
  );

  const outOfRangeResourceReference = parseStateIndex({
    definition: createInvestigationStateIndexDefinition(),
    expectation: {
      definitionVersion: 4,
      namespace: "investigations"
    },
    sourcePath: investigationIndexFileName,
    text: restoredIndex.replace(
      '"resourceReferences": []',
      '"resourceReferences": [{"reportIndex": 1, "resourceIds": ["sample.txt"]}]'
    )
  });
  assert.equal(outOfRangeResourceReference.status, "error");
  assert.ok(
    outOfRangeResourceReference.diagnostics.some((diagnostic) =>
      diagnostic.message.includes("reportIndex 1 must be less than reportCount")
    )
  );

  type ResourceTamperIndex = {
    entries: Record<
      string,
      {
        state: {
          reportCount: number;
          reportTitles: string[];
          resourceReferences: Array<{
            reportIndex: number;
            resourceIds: string[];
          }>;
        };
      }
    >;
    metadata: {
      resources: Array<{ id: string; sha256: string }>;
    };
  };
  const resourceEntryId = "runtime/added-report.md";
  const resourceDigest = "0".repeat(64);
  const parseResourceTamper = (
    mutate: (index: ResourceTamperIndex) => void
  ) => {
    const candidate = JSON.parse(restoredIndex) as ResourceTamperIndex;
    mutate(candidate);
    return parseStateIndex({
      definition: createInvestigationStateIndexDefinition(),
      expectation: {
        definitionVersion: 4,
        namespace: "investigations"
      },
      sourcePath: investigationIndexFileName,
      text: JSON.stringify(candidate)
    });
  };

  const unorderedReportIndexes = parseResourceTamper((index) => {
    const state = index.entries[resourceEntryId]!.state;
    state.reportCount = 2;
    state.reportTitles = ["第一份报告", "第二份报告"];
    state.resourceReferences = [
      { reportIndex: 1, resourceIds: ["b.txt"] },
      { reportIndex: 0, resourceIds: ["a.txt"] }
    ];
    index.metadata.resources = [
      { id: "a.txt", sha256: resourceDigest },
      { id: "b.txt", sha256: resourceDigest }
    ];
  });
  assert.equal(unorderedReportIndexes.status, "error");
  assert.ok(
    unorderedReportIndexes.diagnostics.some((diagnostic) =>
      diagnostic.message.includes(
        "must use unique reportIndex values in sorted order"
      )
    )
  );

  const duplicateReportIndexes = parseResourceTamper((index) => {
    index.entries[resourceEntryId]!.state.resourceReferences = [
      { reportIndex: 0, resourceIds: ["a.txt"] },
      { reportIndex: 0, resourceIds: ["b.txt"] }
    ];
    index.metadata.resources = [
      { id: "a.txt", sha256: resourceDigest },
      { id: "b.txt", sha256: resourceDigest }
    ];
  });
  assert.equal(duplicateReportIndexes.status, "error");
  assert.ok(
    duplicateReportIndexes.diagnostics.some((diagnostic) =>
      diagnostic.message.includes(
        "must use unique reportIndex values in sorted order"
      )
    )
  );

  const unorderedResourceIds = parseResourceTamper((index) => {
    index.entries[resourceEntryId]!.state.resourceReferences = [
      {
        reportIndex: 0,
        resourceIds: ["b.txt", "a.txt"]
      }
    ];
    index.metadata.resources = [
      { id: "a.txt", sha256: resourceDigest },
      { id: "b.txt", sha256: resourceDigest }
    ];
  });
  assert.equal(unorderedResourceIds.status, "error");
  assert.ok(
    unorderedResourceIds.diagnostics.some((diagnostic) =>
      diagnostic.message.includes(
        "must contain unique resource ids in sorted order"
      )
    )
  );

  const duplicateResourceIds = parseResourceTamper((index) => {
    index.entries[resourceEntryId]!.state.resourceReferences = [
      {
        reportIndex: 0,
        resourceIds: ["a.txt", "a.txt"]
      }
    ];
    index.metadata.resources = [{ id: "a.txt", sha256: resourceDigest }];
  });
  assert.equal(duplicateResourceIds.status, "error");
  assert.ok(
    duplicateResourceIds.diagnostics.some((diagnostic) =>
      diagnostic.message.includes(
        "must contain unique resource ids in sorted order"
      )
    )
  );

  const unorderedMetadataIds = parseResourceTamper((index) => {
    index.metadata.resources = [
      { id: "b.txt", sha256: resourceDigest },
      { id: "a.txt", sha256: resourceDigest }
    ];
  });
  assert.equal(unorderedMetadataIds.status, "error");
  assert.ok(
    unorderedMetadataIds.diagnostics.some((diagnostic) =>
      diagnostic.message.includes("must contain unique resources in id order")
    )
  );

  const duplicateMetadataIds = parseResourceTamper((index) => {
    index.metadata.resources = [
      { id: "a.txt", sha256: resourceDigest },
      { id: "a.txt", sha256: resourceDigest }
    ];
  });
  assert.equal(duplicateMetadataIds.status, "error");
  assert.ok(
    duplicateMetadataIds.diagnostics.some((diagnostic) =>
      diagnostic.message.includes("must contain unique resources in id order")
    )
  );

  const missingResourceMetadata = parseStateIndex({
    definition: createInvestigationStateIndexDefinition(),
    expectation: {
      definitionVersion: 4,
      namespace: "investigations"
    },
    sourcePath: investigationIndexFileName,
    text: restoredIndex.replace(
      '"resourceReferences": []',
      '"resourceReferences": [{"reportIndex": 0, "resourceIds": ["sample.txt"]}]'
    )
  });
  assert.equal(missingResourceMetadata.status, "error");
  assert.ok(
    missingResourceMetadata.diagnostics.some(
      (diagnostic) =>
        diagnostic.message.includes("sample.txt") &&
        diagnostic.message.includes("missing from metadata.resources")
    )
  );

  const unreferencedResourceMetadata = parseStateIndex({
    definition: createInvestigationStateIndexDefinition(),
    expectation: {
      definitionVersion: 4,
      namespace: "investigations"
    },
    sourcePath: investigationIndexFileName,
    text: restoredIndex.replace(
      '"resources": []',
      `"resources": [{"id": "sample.txt", "sha256": "${"0".repeat(64)}"}]`
    )
  });
  assert.equal(unreferencedResourceMetadata.status, "error");
  assert.ok(
    unreferencedResourceMetadata.diagnostics.some(
      (diagnostic) =>
        diagnostic.message.includes("metadata resource sample.txt") &&
        diagnostic.message.includes("not referenced")
    )
  );
}

async function testPrebuiltSnapshotWriteBoundary(
  tempRoot: string
): Promise<void> {
  const missingIndexWorkspace = path.join(tempRoot, "missing-index");
  const missingIndexReports = createValidReports();
  await writeCollection(missingIndexWorkspace, missingIndexReports, false);
  const missingIndexRoot = investigationRoot(missingIndexWorkspace);
  const missingIndexPath = path.join(
    missingIndexRoot,
    investigationIndexFileName
  );
  const missingIndexSnapshot =
    await readInvestigationStateSnapshot(missingIndexRoot);
  await fs.appendFile(
    path.join(missingIndexRoot, ...missingIndexReports[0]!.path.split("/")),
    "\n<!-- changed after snapshot -->\n",
    "utf8"
  );

  const rejectedWrite = await syncInvestigationStateIndex({
    investigationsDirectory: missingIndexRoot,
    mode: "write",
    snapshot: missingIndexSnapshot
  });
  assert.equal(rejectedWrite.status, "error");
  assert.equal(rejectedWrite.state, "source-invalid");
  assert.equal(rejectedWrite.changed, false);
  assert.deepEqual(
    rejectedWrite.diagnostics.map((diagnostic) => diagnostic.code),
    ["state-index.source-changed"]
  );
  assert.equal(
    await fs.stat(missingIndexPath).then(
      () => true,
      () => false
    ),
    false
  );

  const existingIndexWorkspace = path.join(tempRoot, "existing-index");
  const existingIndexReports = createValidReports();
  await writeCollection(existingIndexWorkspace, existingIndexReports);
  const existingIndexRoot = investigationRoot(existingIndexWorkspace);
  const existingIndexPath = path.join(
    existingIndexRoot,
    investigationIndexFileName
  );
  const originalIndex = await fs.readFile(existingIndexPath, "utf8");
  const existingIndexSnapshot =
    await readInvestigationStateSnapshot(existingIndexRoot);
  await fs.appendFile(
    path.join(existingIndexRoot, ...existingIndexReports[0]!.path.split("/")),
    "\n<!-- changed after snapshot -->\n",
    "utf8"
  );

  const rejectedReplacement = await syncInvestigationStateIndex({
    investigationsDirectory: existingIndexRoot,
    mode: "write",
    snapshot: existingIndexSnapshot
  });
  assert.equal(rejectedReplacement.status, "error");
  assert.equal(rejectedReplacement.state, "source-invalid");
  assert.equal(rejectedReplacement.changed, false);
  assert.deepEqual(
    rejectedReplacement.diagnostics.map((diagnostic) => diagnostic.code),
    ["state-index.source-changed"]
  );
  assert.equal(await fs.readFile(existingIndexPath, "utf8"), originalIndex);
}

test("index queries return filtered and paginated investigation states", () =>
  withTempRoot("index-query-valid", testValidIndexAndQueries));

test("index loading rejects stale and tampered investigation indexes", () =>
  withTempRoot("index-query-stale", testStaleAndTamperedIndexes));

test("prebuilt snapshot synchronization rejects live source changes before index writes", () =>
  withTempRoot("snapshot-write-boundary", testPrebuiltSnapshotWriteBoundary));

test("source revisions partition metadata and topic fingerprints without parsing Markdown", () =>
  withTempRoot("source-revision", async (tempRoot) => {
    const workspaceRoot = path.join(tempRoot, "source-revision");
    const reports = createValidReports();
    await writeCollection(workspaceRoot, reports, false);
    const collectionRoot = investigationRoot(workspaceRoot);

    const snapshot = await readInvestigationStateSnapshot(collectionRoot);
    const revision = await readInvestigationSourceRevision(collectionRoot);
    assert.deepEqual(snapshot.sourceRevision, revision);
    assert.deepEqual(
      Object.keys(snapshot.states),
      reports.map((report) => report.path).sort()
    );

    const sources = reports.map((report) => ({
      path: report.path,
      text: reportMarkdown(report)
    }));
    const reversed = investigationSourceRevision([...sources].reverse());
    assert.deepEqual(reversed, revision);
    assert.deepEqual(
      investigationSourceRevision(
        sources.map((source) => ({
          ...source,
          text: source.text.replace(/\n/gu, "\r\n")
        }))
      ),
      revision
    );

    const changedPath = reports[0]!.path;
    const changedRevision = investigationSourceRevision(
      sources.map((source) =>
        source.path === changedPath
          ? { ...source, text: source.text + "not projected\n" }
          : source
      )
    );
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
    const unparsedRevision =
      await readInvestigationSourceRevision(collectionRoot);
    assert.match(
      unparsedRevision.entries[changedPath]!,
      /^sha256:[0-9a-f]{64}$/u
    );
    await assert.rejects(
      readInvestigationStateSnapshot(collectionRoot),
      /must contain exactly one H1/
    );
  }));

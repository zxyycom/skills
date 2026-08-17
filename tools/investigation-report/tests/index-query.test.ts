import assert from "node:assert/strict";
import { constants as fileSystemConstants } from "node:fs";
import { spawnSync } from "node:child_process";
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
  investigationIndexFileName,
  investigationSourceRevision,
  loadCurrentInvestigationIndex,
  readInvestigationSourceRevision,
  readInvestigationStateSnapshot,
  syncInvestigationStateIndex
} from "../src/investigation-state-index.ts";
import { createInvestigationStateSnapshot } from "../src/investigation-index-source.ts";
import { queryInvestigationIndex } from "../src/query.ts";
import type { InvestigationIndexState } from "../src/types.ts";
import {
  synchronizeInvestigationIndex,
  validateInvestigationReports
} from "../src/validation.ts";
import {
  createValidReports,
  initializeGitRepository,
  investigationRoot,
  resourceIdForTopic,
  reportMarkdown,
  resultValue,
  type ReportInput,
  withTempRoot,
  writeCollection,
  writeResource
} from "./support.ts";

function parseIndex(text: string, sourcePath: string) {
  return parseStateIndex({
    definition: createInvestigationStateIndexDefinition(),
    expectation: {
      definitionVersion: 5,
      namespace: "investigations"
    },
    sourcePath,
    text
  });
}

async function testValidIndexAndQueries(tempRoot: string): Promise<void> {
  const workspaceRoot = path.join(tempRoot, "valid-index");
  await writeCollection(workspaceRoot, createValidReports());

  const validation = await validateInvestigationReports({ workspaceRoot });
  assert.deepEqual(validation.errors, []);
  assert.deepEqual(validation.warnings, []);
  assert.equal(validation.indexChecked, true);
  assert.equal(validation.availableTopicCount, 2);
  assert.equal(validation.selectedTopicCount, 2);
  assert.equal(validation.categoryCount, 2);

  const collectionRoot = investigationRoot(workspaceRoot);
  const indexPath = path.join(collectionRoot, investigationIndexFileName);
  const source = await fs.readFile(indexPath, "utf8");
  const index = JSON.parse(source) as StateIndex;
  assert.equal(index.schemaVersion, 3);
  assert.equal(index.definitionVersion, 5);
  assert.deepEqual(index.metadata, {});
  assert.equal(index.namespace, "investigations");
  assert.match(index.sourceRevision.metadata, /^sha256:[0-9a-f]{64}$/u);
  assert.deepEqual(Object.keys(index.entries), [
    "codex/project-shell-registration.md",
    "runtime/process-churn.md"
  ]);
  assert.deepEqual(
    Object.keys(index.sourceRevision.entries),
    Object.keys(index.entries)
  );

  const codexEntry = index.entries["codex/project-shell-registration.md"]!;
  assert.deepEqual(codexEntry.state.resourceReferences, []);
  assert.deepEqual(codexEntry.keys.category, ["codex"]);
  assert.deepEqual(codexEntry.keys.status, ["调查中"]);

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
}

async function testIndexCompatibilityAndStrictMetadata(
  tempRoot: string
): Promise<void> {
  const workspaceRoot = path.join(tempRoot, "strict-index");
  await writeCollection(workspaceRoot, createValidReports());
  const indexPath = path.join(
    investigationRoot(workspaceRoot),
    investigationIndexFileName
  );
  const source = await fs.readFile(indexPath, "utf8");
  const index = JSON.parse(source) as {
    definitionVersion: number;
    metadata: Record<string, unknown>;
    schemaVersion: number;
  };

  const schemaV2 = parseIndex(
    source.replace('"schemaVersion": 3', '"schemaVersion": 2'),
    indexPath
  );
  assert.equal(schemaV2.status, "error");
  assert.ok(
    schemaV2.diagnostics.some((diagnostic) =>
      diagnostic.message.includes("schema version 2 is unsupported; expected 3")
    )
  );

  index.definitionVersion = 4;
  const legacyDefinition = parseIndex(JSON.stringify(index), indexPath);
  assert.equal(legacyDefinition.status, "error");
  assert.ok(
    legacyDefinition.diagnostics.some((diagnostic) =>
      /definition|version|expected/iu.test(diagnostic.message)
    )
  );

  index.definitionVersion = 5;
  index.metadata = { resources: [] };
  const extraMetadata = parseIndex(JSON.stringify(index), indexPath);
  assert.equal(extraMetadata.status, "error");
  assert.ok(
    extraMetadata.diagnostics.some((diagnostic) =>
      /metadata|additional|property/iu.test(diagnostic.message)
    ),
    extraMetadata.diagnostics.map((entry) => entry.message).join("; ")
  );
}

async function testStaleAndTamperedIndexes(tempRoot: string): Promise<void> {
  const workspaceRoot = path.join(tempRoot, "stale-index");
  const firstReport: ReportInput = {
    path: "runtime/first-report.md",
    question: "新增主题文件是否会使派生索引失效？",
    title: "首个索引成员调查"
  };
  const addedReport: ReportInput = {
    path: "runtime/added-report.md",
    question: "新增文件是否会由同步自动吸收？",
    title: "新增索引成员调查"
  };
  await writeCollection(workspaceRoot, [firstReport]);

  await fs.writeFile(
    path.join(investigationRoot(workspaceRoot), ...addedReport.path.split("/")),
    reportMarkdown(addedReport),
    "utf8"
  );
  const stale = await validateInvestigationReports({ workspaceRoot });
  assert.equal(stale.indexChecked, true);
  assert.ok(
    stale.errors.some((error) =>
      error.includes("does not match the current state projection")
    )
  );
  const staleQuery = await queryInvestigationIndex({ workspaceRoot });
  assert.deepEqual(staleQuery.entries, []);
  assert.ok(
    staleQuery.errors.some((error) => error.includes("source revision"))
  );

  const synchronized = await synchronizeInvestigationIndex({ workspaceRoot });
  assert.deepEqual(synchronized.errors, []);
  assert.equal(synchronized.changed, true);

  const indexPath = path.join(
    investigationRoot(workspaceRoot),
    investigationIndexFileName
  );
  const current = await fs.readFile(indexPath, "utf8");
  await fs.writeFile(
    indexPath,
    current.replace("新增索引成员调查", "被篡改的索引标题"),
    "utf8"
  );
  const tampered = await validateInvestigationReports({ workspaceRoot });
  assert.ok(
    tampered.errors.some((error) =>
      error.includes("does not match its keys under the runtime definition")
    )
  );
}

async function testPrebuiltSnapshotWriteBoundary(
  tempRoot: string
): Promise<void> {
  const workspaceRoot = path.join(tempRoot, "snapshot-write-boundary");
  const reports = createValidReports();
  await writeCollection(workspaceRoot, reports);
  const collectionRoot = investigationRoot(workspaceRoot);
  const indexPath = path.join(collectionRoot, investigationIndexFileName);
  const originalIndex = await fs.readFile(indexPath, "utf8");
  const snapshot = await readInvestigationStateSnapshot(collectionRoot);
  await fs.appendFile(
    path.join(collectionRoot, ...reports[0]!.path.split("/")),
    "\n<!-- changed after snapshot -->\n",
    "utf8"
  );

  const rejected = await syncInvestigationStateIndex({
    investigationsDirectory: collectionRoot,
    mode: "write",
    snapshot
  });
  assert.equal(rejected.status, "error");
  assert.equal(rejected.state, "source-invalid");
  assert.equal(rejected.changed, false);
  assert.deepEqual(
    rejected.diagnostics.map((diagnostic) => diagnostic.code),
    ["state-index.source-changed"]
  );
  assert.equal(await fs.readFile(indexPath, "utf8"), originalIndex);
}

async function writeGitMembershipMutationWrapper(options: {
  markerPath: string;
  replacementPath: string;
  targetPath: string;
  wrapperPath: string;
}): Promise<void> {
  const realGitPath = await resolveGitExecutable();
  const dispatcherSource = [
    'const { spawnSync } = require("node:child_process");',
    'const fs = require("node:fs");',
    "",
    'if (process.argv.slice(2).includes("ls-files") &&',
    `    !fs.existsSync(${JSON.stringify(options.markerPath)})) {`,
    `  fs.copyFileSync(${JSON.stringify(options.replacementPath)}, ${JSON.stringify(options.targetPath)});`,
    `  fs.closeSync(fs.openSync(${JSON.stringify(options.markerPath)}, "w"));`,
    "}",
    "",
    `const result = spawnSync(${JSON.stringify(realGitPath)}, process.argv.slice(2), { stdio: "inherit" });`,
    "if (result.error) {",
    "  throw result.error;",
    "}",
    "process.exitCode = result.status ?? 1;",
    ""
  ].join("\n");
  await fs.mkdir(path.dirname(options.wrapperPath), { recursive: true });
  if (process.platform === "win32") {
    const dispatcherPath = options.wrapperPath + ".cjs";
    await fs.writeFile(dispatcherPath, dispatcherSource, "utf8");
    const compiled = spawnSync(
      process.execPath,
      ["build", "--compile", dispatcherPath, "--outfile", options.wrapperPath],
      { encoding: "utf8", windowsHide: true }
    );
    assert.equal(
      compiled.status,
      0,
      `could not compile the Windows Git test shim: ${compiled.stderr}`
    );
    return;
  }
  await fs.writeFile(
    options.wrapperPath,
    `#!${process.execPath}\n${dispatcherSource}`,
    { mode: 0o755 }
  );
  await fs.chmod(options.wrapperPath, 0o755);
}

async function resolveGitExecutable(): Promise<string> {
  const names = process.platform === "win32" ? ["git.exe", "git.com"] : ["git"];
  for (const directory of (process.env.PATH ?? "").split(path.delimiter)) {
    if (directory.length === 0) {
      continue;
    }
    for (const name of names) {
      const candidate = path.join(directory, name);
      try {
        await fs.access(candidate, fileSystemConstants.X_OK);
        return candidate;
      } catch {
        // Continue through the operating system's command-search candidates.
      }
    }
  }
  throw new Error("Git executable was not found on PATH");
}

async function testFullSynchronizationUsesValidatedTopicSnapshot(
  tempRoot: string
): Promise<void> {
  const workspaceRoot = path.join(tempRoot, "validation-snapshot-boundary");
  const topicPath = "runtime/snapshot-boundary.md";
  const validResourceId = resourceIdForTopic(topicPath, "evidence.txt");
  const invalidResourceId = resourceIdForTopic(topicPath, "missing.txt");
  const initialReport: ReportInput = {
    path: topicPath,
    question: "全量同步是否只写入已完成资源校验的主题快照？",
    reports: [
      {
        resources: [{ id: validResourceId, label: "已校验资源" }],
        title: "建立已校验主题快照"
      }
    ],
    title: "主题快照与资源校验边界"
  };
  const replacementReport: ReportInput = {
    ...initialReport,
    reports: [
      {
        resources: [{ id: invalidResourceId, label: "未校验缺失资源" }],
        title: "在资源检查期间改写引用"
      }
    ]
  };
  initializeGitRepository(workspaceRoot);
  await writeResource(workspaceRoot, validResourceId, "valid evidence\n");
  await writeCollection(workspaceRoot, [initialReport]);

  const collectionRoot = investigationRoot(workspaceRoot);
  const indexPath = path.join(collectionRoot, investigationIndexFileName);
  const originalIndex = await fs.readFile(indexPath, "utf8");
  const targetPath = path.join(collectionRoot, ...topicPath.split("/"));
  const replacementPath = path.join(tempRoot, "replacement.md");
  const markerPath = path.join(tempRoot, "resource-membership-read");
  const wrapperDirectory = path.join(tempRoot, "git-wrapper");
  await fs.writeFile(
    replacementPath,
    reportMarkdown(replacementReport),
    "utf8"
  );
  await writeGitMembershipMutationWrapper({
    markerPath,
    replacementPath,
    targetPath,
    wrapperPath: path.join(
      wrapperDirectory,
      process.platform === "win32" ? "git.exe" : "git"
    )
  });

  const originalPath = process.env.PATH;
  process.env.PATH = wrapperDirectory + path.delimiter + (originalPath ?? "");
  let synchronized: Awaited<ReturnType<typeof synchronizeInvestigationIndex>>;
  try {
    synchronized = await synchronizeInvestigationIndex({ workspaceRoot });
  } finally {
    if (originalPath === undefined) {
      delete process.env.PATH;
    } else {
      process.env.PATH = originalPath;
    }
  }

  await assert.doesNotReject(fs.access(markerPath));
  assert.equal(synchronized.changed, false);
  assert.ok(
    synchronized.errors.some((error) => /source.*changed/iu.test(error)),
    synchronized.errors.join("; ")
  );
  assert.equal(await fs.readFile(indexPath, "utf8"), originalIndex);

  const currentValidation = await validateInvestigationReports({
    workspaceRoot
  });
  assert.ok(
    currentValidation.errors.some(
      (error) =>
        error.includes(invalidResourceId) && error.includes("does not exist")
    ),
    currentValidation.errors.join("; ")
  );
}

async function testSourceRevisionOnlyUsesTopicMarkdown(
  tempRoot: string
): Promise<void> {
  const workspaceRoot = path.join(tempRoot, "source-revision");
  const reports = createValidReports();
  await writeCollection(workspaceRoot, reports, false);
  const collectionRoot = investigationRoot(workspaceRoot);
  const snapshot = await readInvestigationStateSnapshot(collectionRoot);
  const revision = await readInvestigationSourceRevision(collectionRoot);
  assert.deepEqual(snapshot.sourceRevision, revision);

  const sources = reports.map((report) => ({
    path: report.path,
    text: reportMarkdown(report)
  }));
  assert.deepEqual(
    investigationSourceRevision([...sources].reverse()),
    revision
  );
  const changedPath = reports[0]!.path;
  const changed = investigationSourceRevision(
    sources.map((source) =>
      source.path === changedPath
        ? { ...source, text: source.text + "not projected\n" }
        : source
    )
  );
  assert.equal(changed.metadata, revision.metadata);
  assert.notEqual(changed.entries[changedPath], revision.entries[changedPath]);
}

test("index queries return v5 topic states with strict empty metadata", () =>
  withTempRoot("index-query-valid", testValidIndexAndQueries));

test("index rejects legacy definitions and additional metadata", () =>
  withTempRoot("index-query-strict", testIndexCompatibilityAndStrictMetadata));

test("index loading rejects stale and tampered topic projections", () =>
  withTempRoot("index-query-stale", testStaleAndTamperedIndexes));

test("prebuilt snapshot synchronization rejects live topic changes before index writes", () =>
  withTempRoot("snapshot-write-boundary", testPrebuiltSnapshotWriteBoundary));

test("state snapshots reject duplicate state paths", () => {
  const statePath = "runtime/duplicate-state.md";
  const state: InvestigationIndexState = {
    latestReportAt: "2026-08-17",
    path: statePath,
    question: "快照是否拒绝重复的状态投影？",
    reportCount: 1,
    reportTitles: ["重复状态投影"],
    resourceReferences: [],
    status: "调查中",
    title: "重复状态投影"
  };

  assert.throws(
    () =>
      createInvestigationStateSnapshot(
        [{ path: statePath, text: "source\n" }],
        [state, { ...state }]
      ),
    new RegExp(`${statePath} has a duplicate state projection`, "u")
  );
});

test("state snapshots reject paths without matching sources", () => {
  const sourcePath = "runtime/snapshot-source.md";
  const statePath = "runtime/source-external-state.md";
  const state: InvestigationIndexState = {
    latestReportAt: "2026-08-17",
    path: statePath,
    question: "快照是否拒绝来源集合外的状态投影？",
    reportCount: 1,
    reportTitles: ["来源外状态投影"],
    resourceReferences: [],
    status: "调查中",
    title: "来源外状态投影"
  };

  assert.throws(
    () =>
      createInvestigationStateSnapshot(
        [{ path: sourcePath, text: "source\n" }],
        [state]
      ),
    new RegExp(`${statePath} has no matching source`, "u")
  );
});

test("full synchronization rejects topic references changed after resource validation begins", () =>
  withTempRoot(
    "full-validation-snapshot-boundary",
    testFullSynchronizationUsesValidatedTopicSnapshot
  ));

test("source revisions fingerprint only topic Markdown and strict empty metadata", () =>
  withTempRoot("source-revision", testSourceRevisionOnlyUsesTopicMarkdown));

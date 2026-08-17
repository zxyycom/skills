import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { stageInvestigationIndex as stageBundledInvestigationIndex } from "../../../skills/investigation-report/scripts/check-investigations.mjs";
import {
  parseStateIndex,
  type StateIndex
} from "../../index-runtime/src/index.ts";
import {
  createInvestigationStateIndexDefinition,
  investigationIndexDefinitionVersion,
  investigationIndexFileName,
  investigationIndexNamespace
} from "../src/investigation-state-index.ts";
import { stageInvestigationIndex } from "../src/staging.ts";
import type {
  InvestigationIndexMetadata,
  InvestigationIndexState
} from "../src/types.ts";
import {
  commitAll,
  generatedCheckerPath,
  initializeGitRepository,
  investigationRoot,
  pendingPaths,
  readPendingText,
  resourceIdForTopic,
  runGit,
  type ReportInput,
  withTempRoot,
  writeCollection,
  writeResource
} from "./support.ts";

const indexRepositoryPath = `docs/investigations/${investigationIndexFileName}`;

type InvestigationIndexFixture = StateIndex<
  InvestigationIndexState,
  InvestigationIndexMetadata
>;

function topic(
  topicPath: string,
  title: string,
  reports?: ReportInput["reports"]
): ReportInput {
  return {
    path: topicPath,
    question: `${title} 的当前结论是什么？`,
    ...(reports === undefined ? {} : { reports }),
    title
  };
}

function indexPath(workspaceRoot: string): string {
  return path.join(
    investigationRoot(workspaceRoot),
    investigationIndexFileName
  );
}

async function readWorkspaceIndex(
  workspaceRoot: string
): Promise<InvestigationIndexFixture> {
  const workspaceIndexPath = indexPath(workspaceRoot);
  return parseInvestigationIndexFixture(
    await fs.readFile(workspaceIndexPath, "utf8"),
    workspaceIndexPath
  );
}

function readRevisionIndex(workspaceRoot: string): InvestigationIndexFixture {
  return parseInvestigationIndexFixture(
    runGit(workspaceRoot, ["show", `HEAD:${indexRepositoryPath}`]),
    `HEAD:${indexRepositoryPath}`
  );
}

function readPendingIndex(workspaceRoot: string): InvestigationIndexFixture {
  return parseInvestigationIndexFixture(
    readPendingText(workspaceRoot, indexRepositoryPath),
    `pending:${indexRepositoryPath}`
  );
}

function parseInvestigationIndexFixture(
  text: string,
  sourcePath: string
): InvestigationIndexFixture {
  const parsed = parseStateIndex({
    definition: createInvestigationStateIndexDefinition(),
    expectation: {
      definitionVersion: investigationIndexDefinitionVersion,
      namespace: investigationIndexNamespace
    },
    sourcePath,
    text
  });
  if (parsed.status === "error") {
    assert.fail(parsed.diagnostics.map((entry) => entry.message).join("; "));
  }
  return parsed.value;
}

function runGeneratedStage(
  workspaceRoot: string,
  topicIds: readonly string[],
  json = false
) {
  return spawnSync(
    "node",
    [
      generatedCheckerPath,
      "stage-index",
      ...topicIds,
      "--root",
      workspaceRoot,
      ...(json ? ["--json"] : [])
    ],
    { encoding: "utf8" as const }
  );
}

async function removeTopic(
  workspaceRoot: string,
  topicId: string
): Promise<void> {
  await fs.rm(
    path.join(investigationRoot(workspaceRoot), ...topicId.split("/"))
  );
}

test("stage-index validates canonical topic ids before repository access", () =>
  withTempRoot("stage-input", async (tempRoot) => {
    const workspaceRoot = path.join(tempRoot, "missing-workspace");
    const empty = await stageInvestigationIndex({
      topicIds: [],
      workspaceRoot
    });
    assert.equal(empty.status, "error");
    assert.equal(empty.state, "selection-invalid");
    assert.equal(
      empty.diagnostics[0]?.code,
      "investigation-report.stage-topic-ids-empty"
    );

    const invalid = await stageInvestigationIndex({
      topicIds: ["runtime\\topic.md"],
      workspaceRoot
    });
    assert.equal(invalid.status, "error");
    assert.equal(invalid.state, "selection-invalid");
    assert.equal(
      invalid.diagnostics[0]?.code,
      "investigation-report.stage-topic-id-invalid"
    );

    const duplicate = await stageInvestigationIndex({
      topicIds: ["runtime/topic.md", "runtime/topic.md"],
      workspaceRoot
    });
    assert.equal(duplicate.status, "error");
    assert.equal(duplicate.state, "selection-invalid");
    assert.equal(
      duplicate.diagnostics[0]?.code,
      "investigation-report.stage-topic-id-duplicate"
    );
    await assert.rejects(fs.stat(workspaceRoot), { code: "ENOENT" });
  }));

test("stage-index isolates one selected topic without reading or staging domain files", () =>
  withTempRoot("stage-isolation", async (tempRoot) => {
    const workspaceRoot = path.join(tempRoot, "workspace");
    const topicA = topic("runtime/topic-a.md", "主题 A 基线", [
      {
        resources: [
          {
            id: "runtime/topic-a/topic-a.txt",
            label: "主题 A 样本"
          }
        ],
        title: "形成主题 A 基线"
      }
    ]);
    const topicB = topic("runtime/topic-b.md", "主题 B 基线");
    initializeGitRepository(workspaceRoot);
    await writeResource(
      workspaceRoot,
      "runtime/topic-a/topic-a.txt",
      "stable resource\n"
    );
    await writeCollection(workspaceRoot, [topicA, topicB]);
    commitAll(workspaceRoot, "baseline");

    await fs.writeFile(path.join(workspaceRoot, "outside.txt"), "outside\n");
    runGit(workspaceRoot, ["add", "outside.txt"]);
    await writeCollection(workspaceRoot, [
      { ...topicA, title: "主题 A 工作区" },
      { ...topicB, title: "主题 B 工作区" }
    ]);

    const baseline = readRevisionIndex(workspaceRoot);
    const workspace = await readWorkspaceIndex(workspaceRoot);
    const topicAPath = path.join(
      investigationRoot(workspaceRoot),
      "runtime",
      "topic-a.md"
    );
    const topicBPath = path.join(
      investigationRoot(workspaceRoot),
      "runtime",
      "topic-b.md"
    );
    const resourcePath = path.join(
      investigationRoot(workspaceRoot),
      "_resources",
      "runtime",
      "topic-a",
      "topic-a.txt"
    );
    await fs.writeFile(topicAPath, "not a valid investigation report\n");
    await fs.writeFile(topicBPath, "also not a valid investigation report\n");
    const before = {
      index: await fs.readFile(indexPath(workspaceRoot)),
      resource: await fs.readFile(resourcePath),
      topicA: await fs.readFile(topicAPath),
      topicB: await fs.readFile(topicBPath)
    };

    const cli = runGeneratedStage(workspaceRoot, ["runtime/topic-a.md"], true);
    assert.equal(cli.status, 0, cli.stderr);
    assert.equal(cli.stderr, "");
    const result: unknown = JSON.parse(cli.stdout);
    assert.deepEqual(result, {
      changed: true,
      diagnostics: [],
      indexPath: indexPath(workspaceRoot),
      namespace: "investigations",
      selectedIds: ["runtime/topic-a.md"],
      state: "staged",
      status: "ok"
    });

    const pending = readPendingIndex(workspaceRoot);
    assert.deepEqual(
      pending.entries["runtime/topic-a.md"],
      workspace.entries["runtime/topic-a.md"]
    );
    assert.deepEqual(
      pending.entries["runtime/topic-b.md"],
      baseline.entries["runtime/topic-b.md"]
    );
    assert.deepEqual(pending.metadata, baseline.metadata);
    assert.deepEqual(
      pendingPaths(workspaceRoot).sort(),
      [indexRepositoryPath, "outside.txt"].sort()
    );
    assert.deepEqual(await fs.readFile(indexPath(workspaceRoot)), before.index);
    assert.deepEqual(await fs.readFile(resourcePath), before.resource);
    assert.deepEqual(await fs.readFile(topicAPath), before.topicA);
    assert.deepEqual(await fs.readFile(topicBPath), before.topicB);
  }));

test("stage-index applies selected additions deletions and explicit renames", () =>
  withTempRoot("stage-overlay", async (tempRoot) => {
    const workspaceRoot = path.join(tempRoot, "workspace");
    const topicA = topic("runtime/topic-a.md", "主题 A 基线");
    const topicB = topic("runtime/topic-b.md", "主题 B 基线");
    const topicC = topic("runtime/topic-c.md", "主题 C 基线");
    initializeGitRepository(workspaceRoot);
    await writeCollection(workspaceRoot, [topicA, topicB, topicC]);
    commitAll(workspaceRoot, "baseline");

    await removeTopic(workspaceRoot, topicB.path);
    await removeTopic(workspaceRoot, topicC.path);
    await writeCollection(workspaceRoot, [
      { ...topicA, title: "主题 A 未选择变化" },
      topic("runtime/topic-d.md", "主题 B 重命名后"),
      topic("runtime/topic-e.md", "主题 E 新增")
    ]);
    const baseline = readRevisionIndex(workspaceRoot);
    const workspace = await readWorkspaceIndex(workspaceRoot);

    const cli = runGeneratedStage(workspaceRoot, [
      "runtime/topic-e.md",
      "runtime/topic-b.md",
      "runtime/topic-d.md",
      "runtime/topic-c.md"
    ]);
    assert.equal(cli.status, 0, cli.stderr);
    assert.equal(cli.stderr, "");
    assert.match(cli.stdout, /state: staged; changed: true/u);
    assert.match(
      cli.stdout,
      /selected IDs: runtime\/topic-b\.md, runtime\/topic-c\.md, runtime\/topic-d\.md, runtime\/topic-e\.md/u
    );
    assert.match(
      cli.stdout,
      /Topic Markdown and attached resources remain outside this operation/u
    );

    const pending = readPendingIndex(workspaceRoot);
    assert.deepEqual(Object.keys(pending.entries), [
      "runtime/topic-a.md",
      "runtime/topic-d.md",
      "runtime/topic-e.md"
    ]);
    assert.deepEqual(
      pending.entries["runtime/topic-a.md"],
      baseline.entries["runtime/topic-a.md"]
    );
    assert.deepEqual(
      pending.entries["runtime/topic-d.md"],
      workspace.entries["runtime/topic-d.md"]
    );
    assert.deepEqual(
      pending.entries["runtime/topic-e.md"],
      workspace.entries["runtime/topic-e.md"]
    );
  }));

test("stage-index bootstraps the first v5 investigation index without resource metadata", () =>
  withTempRoot("stage-bootstrap", async (tempRoot) => {
    const workspaceRoot = path.join(tempRoot, "workspace");
    initializeGitRepository(workspaceRoot);
    await fs.writeFile(path.join(workspaceRoot, "README.md"), "baseline\n");
    commitAll(workspaceRoot, "baseline");

    const report = topic("runtime/first-topic.md", "首次调查主题", [
      {
        resources: [
          {
            id: "runtime/first-topic/first.bin",
            label: "首次资源"
          }
        ],
        title: "形成首次主题"
      }
    ]);
    await writeResource(
      workspaceRoot,
      "runtime/first-topic/first.bin",
      Uint8Array.from([0, 127, 128, 255])
    );
    await writeCollection(workspaceRoot, [report]);

    const result = await stageBundledInvestigationIndex({
      topicIds: [report.path],
      workspaceRoot
    });
    assert.equal(result.status, "ok");
    assert.equal(result.state, "staged");
    assert.deepEqual(result.selectedIds, [report.path]);
    assert.deepEqual(pendingPaths(workspaceRoot), [indexRepositoryPath]);

    const pending = readPendingIndex(workspaceRoot);
    assert.equal(pending.definitionVersion, 5);
    assert.deepEqual(pending.metadata, {});
    assert.deepEqual(pending.entries[report.path]?.state.resourceReferences, [
      { reportIndex: 0, resourceIds: ["runtime/first-topic/first.bin"] }
    ]);
  }));

test("stage-index rejects topic ids missing from both indexes without changing pending", () =>
  withTempRoot("stage-missing", async (tempRoot) => {
    const workspaceRoot = path.join(tempRoot, "workspace");
    initializeGitRepository(workspaceRoot);
    await writeCollection(workspaceRoot, [
      topic("runtime/present-topic.md", "已有主题")
    ]);
    commitAll(workspaceRoot, "baseline");
    const before = await fs.readFile(indexPath(workspaceRoot));

    const result = await stageInvestigationIndex({
      topicIds: ["runtime/missing-topic.md"],
      workspaceRoot
    });
    assert.equal(result.status, "error");
    assert.equal(result.state, "selection-invalid");
    assert.deepEqual(result.selectedIds, ["runtime/missing-topic.md"]);
    assert.equal(
      result.diagnostics[0]?.code,
      "state-index.selected-id-missing"
    );
    assert.deepEqual(pendingPaths(workspaceRoot), []);
    assert.deepEqual(await fs.readFile(indexPath(workspaceRoot)), before);
  }));

test("stage-index reports unavailable version control without working-tree writes", () =>
  withTempRoot("stage-no-repository", async (tempRoot) => {
    const workspaceRoot = path.join(tempRoot, "workspace");
    const report = topic("runtime/topic.md", "无仓库主题");
    await writeCollection(workspaceRoot, [report]);
    const topicPath = path.join(
      investigationRoot(workspaceRoot),
      "runtime",
      "topic.md"
    );
    const before = {
      index: await fs.readFile(indexPath(workspaceRoot)),
      topic: await fs.readFile(topicPath)
    };

    const result = await stageInvestigationIndex({
      topicIds: [report.path],
      workspaceRoot
    });
    assert.equal(result.status, "error");
    assert.equal(result.state, "revision-read-failed");
    assert.equal(
      result.diagnostics[0]?.code,
      "state-index.repository-unavailable"
    );
    assert.deepEqual(await fs.readFile(indexPath(workspaceRoot)), before.index);
    assert.deepEqual(await fs.readFile(topicPath), before.topic);
  }));

test("stage-index rejects existing same-index pending and preserves outside pending files", () =>
  withTempRoot("stage-pending-conflict", async (tempRoot) => {
    const workspaceRoot = path.join(tempRoot, "workspace");
    const baseline = topic("runtime/topic.md", "主题基线");
    initializeGitRepository(workspaceRoot);
    await writeCollection(workspaceRoot, [baseline]);
    commitAll(workspaceRoot, "baseline");

    await writeCollection(workspaceRoot, [
      {
        ...baseline,
        title: "主题待提交版本"
      }
    ]);
    runGit(workspaceRoot, ["add", indexRepositoryPath]);
    await fs.writeFile(path.join(workspaceRoot, "outside.txt"), "outside\n");
    runGit(workspaceRoot, ["add", "outside.txt"]);
    const pendingBefore = readPendingText(workspaceRoot, indexRepositoryPath);
    await writeCollection(workspaceRoot, [
      {
        ...baseline,
        title: "主题工作区新版本"
      }
    ]);
    const workspaceBefore = await fs.readFile(indexPath(workspaceRoot));

    const result = await stageInvestigationIndex({
      topicIds: [baseline.path],
      workspaceRoot
    });
    assert.equal(result.status, "error");
    assert.equal(result.state, "pending-conflict");
    assert.equal(result.diagnostics[0]?.code, "state-index.pending-conflict");
    assert.equal(
      readPendingText(workspaceRoot, indexRepositoryPath),
      pendingBefore
    );
    assert.deepEqual(
      pendingPaths(workspaceRoot).sort(),
      [indexRepositoryPath, "outside.txt"].sort()
    );
    assert.deepEqual(
      await fs.readFile(indexPath(workspaceRoot)),
      workspaceBefore
    );
  }));

async function testStageAcrossUnrelatedResourceChange(
  tempRoot: string,
  change: "add" | "bytes" | "delete" | "rename"
): Promise<void> {
  const workspaceRoot = path.join(tempRoot, change);
  const topicA = topic("runtime/topic-a.md", "主题 A 基线");
  const topicBPath = "runtime/topic-b.md";
  const topicBResourceId = resourceIdForTopic(topicBPath, "evidence.bin");
  const topicB = topic(topicBPath, "主题 B 基线", [
    {
      resources: [{ id: topicBResourceId, label: "主题 B 资源" }],
      title: "形成主题 B 基线"
    }
  ]);
  initializeGitRepository(workspaceRoot);
  await writeResource(workspaceRoot, topicBResourceId, Uint8Array.of(1));
  await writeCollection(workspaceRoot, [topicA, topicB]);
  commitAll(workspaceRoot, "baseline");

  await fs.writeFile(path.join(workspaceRoot, "outside.txt"), "outside\n");
  runGit(workspaceRoot, ["add", "outside.txt"]);
  await writeCollection(workspaceRoot, [
    { ...topicA, title: "主题 A 可选择条目变化" },
    topicB
  ]);
  const baseline = readRevisionIndex(workspaceRoot);
  const workspace = await readWorkspaceIndex(workspaceRoot);
  const resourcePath = path.join(
    investigationRoot(workspaceRoot),
    "_resources",
    ...topicBResourceId.split("/")
  );

  switch (change) {
    case "add":
      await writeResource(
        workspaceRoot,
        resourceIdForTopic(topicBPath, "unreferenced-added.bin"),
        Uint8Array.of(2)
      );
      break;
    case "bytes":
      await fs.writeFile(resourcePath, Uint8Array.of(2));
      break;
    case "delete":
      await fs.rm(resourcePath);
      break;
    case "rename":
      await fs.rename(
        resourcePath,
        path.join(
          investigationRoot(workspaceRoot),
          "_resources",
          ...resourceIdForTopic(topicBPath, "renamed.bin").split("/")
        )
      );
      break;
  }

  const result = await stageInvestigationIndex({
    topicIds: [topicA.path],
    workspaceRoot
  });
  assert.equal(result.status, "ok");
  assert.equal(result.state, "staged");
  const pending = readPendingIndex(workspaceRoot);
  assert.deepEqual(
    pending.entries[topicA.path],
    workspace.entries[topicA.path]
  );
  assert.deepEqual(pending.entries[topicB.path], baseline.entries[topicB.path]);
  assert.deepEqual(pending.metadata, {});
  assert.deepEqual(
    pendingPaths(workspaceRoot).sort(),
    [indexRepositoryPath, "outside.txt"].sort()
  );
}

test("stage-index selects topic A when topic B adds an unrelated v5 resource", () =>
  withTempRoot("stage-resource-add", (tempRoot) =>
    testStageAcrossUnrelatedResourceChange(tempRoot, "add")
  ));

test("stage-index selects topic A when topic B resource bytes change", () =>
  withTempRoot("stage-resource-bytes", (tempRoot) =>
    testStageAcrossUnrelatedResourceChange(tempRoot, "bytes")
  ));

test("stage-index selects topic A when topic B resource is deleted", () =>
  withTempRoot("stage-resource-delete", (tempRoot) =>
    testStageAcrossUnrelatedResourceChange(tempRoot, "delete")
  ));

test("stage-index selects topic A when topic B resource is renamed", () =>
  withTempRoot("stage-resource-rename", (tempRoot) =>
    testStageAcrossUnrelatedResourceChange(tempRoot, "rename")
  ));

test("stage-index does not combine a legacy v4 revision with a v5 workspace index", () =>
  withTempRoot("stage-definition-upgrade", async (tempRoot) => {
    const workspaceRoot = path.join(tempRoot, "workspace");
    const topicA = topic("runtime/topic-a.md", "主题 A 基线");
    const topicB = topic("runtime/topic-b.md", "主题 B 基线");
    initializeGitRepository(workspaceRoot);
    await writeCollection(workspaceRoot, [topicA, topicB]);
    const indexPathValue = indexPath(workspaceRoot);
    const currentIndex = JSON.parse(
      await fs.readFile(indexPathValue, "utf8")
    ) as {
      definitionVersion: number;
    };
    currentIndex.definitionVersion = 4;
    await fs.writeFile(
      indexPathValue,
      `${JSON.stringify(currentIndex, null, 2)}\n`,
      "utf8"
    );
    commitAll(workspaceRoot, "legacy v4 baseline");

    await writeCollection(workspaceRoot, [
      { ...topicA, title: "主题 A v5 更新" },
      topicB
    ]);
    const result = await stageInvestigationIndex({
      topicIds: [topicA.path],
      workspaceRoot
    });
    assert.equal(result.status, "error");
    assert.deepEqual(pendingPaths(workspaceRoot), []);

    runGit(workspaceRoot, ["add", indexRepositoryPath]);
    assert.deepEqual(pendingPaths(workspaceRoot), [indexRepositoryPath]);
  }));

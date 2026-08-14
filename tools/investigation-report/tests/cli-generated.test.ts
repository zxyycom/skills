import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  queryInvestigationIndex as queryBundledInvestigationIndex,
  runInvestigationReportCheckCli,
  synchronizeInvestigationIndex as synchronizeBundledInvestigationIndex,
  validateInvestigationReports as validateBundledInvestigationReports
} from "../../../skills/investigation-report/scripts/check-investigations.mjs";
import {
  investigationIndexFileName,
  loadCurrentInvestigationIndex
} from "../src/investigation-state-index.ts";
import { validateInvestigationReports } from "../src/validation.ts";
import {
  createValidReports,
  generatedCheckerPath,
  generatedDeclarationPath,
  generatedSchemaPath,
  investigationRoot,
  type ReportInput,
  withTempRoot,
  writeCollection,
  writeResource
} from "./support.ts";

async function testBundledApiParity(tempRoot: string): Promise<void> {
  const workspaceRoot = path.join(tempRoot, "bundled-api");
  const reports = createValidReports();
  reports[0] = {
    ...reports[0]!,
    reports: reports[0]!.reports!.map((report, index) => (
      index === 1
        ? {
            ...report,
            resources: [{ id: "api/response.json", label: "响应样本" }]
          }
        : report
    ))
  };
  await writeResource(workspaceRoot, "api/response.json", '{"ok":true}\n');
  await writeCollection(workspaceRoot, reports);

  const sourceValidation = await validateInvestigationReports({
    workspaceRoot
  });
  assert.deepEqual(
    await validateBundledInvestigationReports({ workspaceRoot }),
    sourceValidation
  );
  assert.equal(typeof runInvestigationReportCheckCli, "function");
  assert.equal(typeof queryBundledInvestigationIndex, "function");
  assert.equal(typeof synchronizeBundledInvestigationIndex, "function");

  assert.deepEqual(
    await queryBundledInvestigationIndex({
      categories: ["codex"],
      latestReportAtFrom: "2026-07-20T00:00:00+08:00",
      paths: ["codex/project-shell-registration.md"],
      workspaceRoot
    }),
    {
      entries: [{
        latestReportAt: "2026-07-21T09:00:00+08:00",
        path: "codex/project-shell-registration.md",
        question: "为什么项目 Shell 没有进入可用工具列表？",
        reportCount: 2,
        reportTitles: ["恢复注册入口", "复查当前注册状态"],
        resourceReferences: [{
          reportIndex: 1,
          resourceIds: ["api/response.json"]
        }],
        status: "调查中",
        title: "项目 Shell 注册调查"
      }],
      errors: [],
      indexPath: path.join(
        workspaceRoot,
        "docs",
        "investigations",
        investigationIndexFileName
      ),
      limit: 50,
      offset: 0,
      total: 1
    }
  );

  const unchanged = await synchronizeBundledInvestigationIndex({
    workspaceRoot
  });
  assert.deepEqual(unchanged.errors, []);
  assert.equal(unchanged.changed, false);
}

async function testGeneratedCheckCommand(tempRoot: string): Promise<void> {
  const validRoot = path.join(tempRoot, "cli-valid");
  const reports = createValidReports();
  reports[0] = {
    ...reports[0]!,
    reports: reports[0]!.reports!.map((report, index) => (
      index === 0
        ? {
            ...report,
            resources: [{ id: "cli/check.txt", label: "check 样本" }]
          }
        : report
    ))
  };
  await writeResource(validRoot, "cli/check.txt", "check resource\n");
  await writeCollection(validRoot, reports);

  const cliSuccess = spawnSync(
    "node",
    [generatedCheckerPath, "--root", validRoot],
    { encoding: "utf8" }
  );
  assert.equal(cliSuccess.status, 0, cliSuccess.stderr);
  assert.equal(cliSuccess.stderr, "");
  assert.match(
    cliSuccess.stdout,
    /2 of 2 topics checked across 2 categories/
  );

  const cliFiltered = spawnSync(
    "node",
    [
      generatedCheckerPath,
      "--root",
      validRoot,
      "--path",
      "codex/project-shell-registration.md"
    ],
    { encoding: "utf8" }
  );
  assert.equal(cliFiltered.status, 0, cliFiltered.stderr);
  assert.equal(cliFiltered.stderr, "");
  assert.match(
    cliFiltered.stdout,
    /1 of 2 topics checked across 1 categories/
  );
  assert.match(cliFiltered.stdout, /index not checked/);

  await fs.rm(path.join(
    validRoot,
    "docs",
    "investigations",
    "_resources",
    "cli",
    "check.txt"
  ));
  const cliFilteredMissingResource = spawnSync(
    "node",
    [
      generatedCheckerPath,
      "--root",
      validRoot,
      "--path",
      "codex/project-shell-registration.md"
    ],
    { encoding: "utf8" }
  );
  assert.equal(cliFilteredMissingResource.status, 1);
  assert.equal(cliFilteredMissingResource.stdout, "");
  assert.match(
    cliFilteredMissingResource.stderr,
    /_resources\/cli\/check\.txt does not exist/u
  );

  const invalidRoot = path.join(tempRoot, "cli-invalid");
  const invalidReport: ReportInput = {
    path: "runtime/invalid-report.md",
    question: "CLI 是否会向调用方返回结构失败？",
    status: "完成",
    title: "无效 CLI 调查"
  };
  await writeCollection(invalidRoot, [invalidReport], false);
  const cliFailure = spawnSync(
    "node",
    [generatedCheckerPath, "--root", invalidRoot],
    { encoding: "utf8" }
  );
  assert.equal(cliFailure.status, 1);
  assert.equal(cliFailure.stdout, "");
  assert.match(cliFailure.stderr, /Investigation report check failed/);
}

async function testGeneratedListCommand(tempRoot: string): Promise<void> {
  const validRoot = path.join(tempRoot, "cli-list");
  await writeCollection(validRoot, createValidReports());
  const cliList = spawnSync(
    "node",
    [
      generatedCheckerPath,
      "list",
      "--root",
      validRoot,
      "--status",
      "暂停",
      "--text",
      "进程 抖动"
    ],
    { encoding: "utf8" }
  );
  assert.equal(cliList.status, 0, cliList.stderr);
  assert.equal(cliList.stderr, "");
  assert.match(cliList.stdout, /Investigation topics/);
  assert.match(
    cliList.stdout,
    /reports: 1; latest: 定位进程抖动阶段/
  );
  assert.match(cliList.stdout, /runtime\/process-churn\.md/);
  assert.doesNotMatch(
    cliList.stdout,
    /codex\/project-shell-registration\.md/
  );
}

async function testGeneratedSyncCommand(tempRoot: string): Promise<void> {
  const cliSyncRoot = path.join(tempRoot, "cli-sync");
  const report = createValidReports()[0]!;
  report.reports = report.reports!.map((entry, index) => (
    index === 0
      ? {
          ...entry,
          resources: [{ id: "sync/sample.bin", label: "同步样本" }]
        }
      : entry
  ));
  const resource = Uint8Array.from([0, 127, 128, 255]);
  await writeResource(cliSyncRoot, "sync/sample.bin", resource);
  await writeCollection(cliSyncRoot, [report], false);
  const cliSync = spawnSync(
    "node",
    [generatedCheckerPath, "sync-index", "--root", cliSyncRoot],
    { encoding: "utf8" }
  );
  assert.equal(cliSync.status, 0, cliSync.stderr);
  assert.equal(cliSync.stderr, "");
  assert.match(cliSync.stdout, /Investigation index synchronized/);
  assert.equal(
    await fs.stat(path.join(
      cliSyncRoot,
      "docs",
      "investigations",
      investigationIndexFileName
    )).then((entry) => entry.isFile()),
    true
  );
  const loaded = await loadCurrentInvestigationIndex({
    investigationsDirectory: investigationRoot(cliSyncRoot)
  });
  if (loaded.status === "error") {
    assert.fail(loaded.diagnostics.map((entry) => entry.message).join("; "));
  }
  const index = loaded.value;
  assert.deepEqual(index.metadata.resources, [{
    id: "sync/sample.bin",
    sha256: createHash("sha256").update(resource).digest("hex")
  }]);
  assert.deepEqual(
    index.entries[report.path]!.state.resourceReferences,
    [{ reportIndex: 0, resourceIds: ["sync/sample.bin"] }]
  );
}

async function testGeneratedListRejectsStaleResources(
  tempRoot: string
): Promise<void> {
  const workspaceRoot = path.join(tempRoot, "cli-list-resource-stale");
  const report: ReportInput = {
    path: "runtime/resource-list.md",
    question: "list 是否会拒绝资源内容过期的索引？",
    reports: [{
      resources: [{ id: "captures/list.bin", label: "list 样本" }],
      title: "检查 list 新鲜度"
    }],
    title: "list 资源新鲜度调查"
  };
  await writeResource(workspaceRoot, "captures/list.bin", Uint8Array.from([1]));
  await writeCollection(workspaceRoot, [report]);
  await writeResource(workspaceRoot, "captures/list.bin", Uint8Array.from([2]));

  const cliList = spawnSync(
    "node",
    [generatedCheckerPath, "list", "--root", workspaceRoot],
    { encoding: "utf8" }
  );
  assert.equal(cliList.status, 1);
  assert.equal(cliList.stdout, "");
  assert.match(cliList.stderr, /_resources\/captures\/list\.bin/u);
  assert.match(cliList.stderr, /resource content changed/u);
}

async function testGeneratedCliUsage(tempRoot: string): Promise<void> {
  const help = spawnSync(
    "node",
    [generatedCheckerPath, "--help"],
    { encoding: "utf8" }
  );
  assert.equal(help.status, 0, help.stderr);
  assert.equal(help.stderr, "");
  assert.match(help.stdout, /Usage: check-investigations\.mjs/);
  assert.match(help.stdout, /optional attached resources/);
  assert.match(help.stdout, /resource pool/);
  assert.match(help.stdout, /full-index freshness/);
  assert.match(help.stdout, /sync-index validates every topic/);
  assert.match(help.stdout, /Git workspaces exclude ignored untracked resources/);
  assert.match(help.stdout, /list checks topic and managed resource freshness/);

  const validRoot = path.join(tempRoot, "cli-usage");
  await writeCollection(validRoot, createValidReports());
  const invalidArgument = spawnSync(
    "node",
    [generatedCheckerPath, "--unknown"],
    { encoding: "utf8" }
  );
  assert.equal(invalidArgument.status, 2);
  assert.equal(invalidArgument.stdout, "");
  assert.match(invalidArgument.stderr, /Unknown option '--unknown'/u);

  const invalidLimit = spawnSync(
    "node",
    [
      generatedCheckerPath,
      "list",
      "--root",
      validRoot,
      "--limit",
      "nope"
    ],
    { encoding: "utf8" }
  );
  assert.equal(invalidLimit.status, 2);
  assert.equal(invalidLimit.stdout, "");
  assert.match(invalidLimit.stderr, /limit must be an integer/);

  const invalidSyncFilter = spawnSync(
    "node",
    [
      generatedCheckerPath,
      "sync-index",
      "--root",
      validRoot,
      "--category",
      "codex"
    ],
    { encoding: "utf8" }
  );
  assert.equal(invalidSyncFilter.status, 2);
  assert.equal(invalidSyncFilter.stdout, "");
  assert.match(
    invalidSyncFilter.stderr,
    /sync-index does not accept query filters or pagination/u
  );
}

async function testGeneratedStageCliUsage(tempRoot: string): Promise<void> {
  const help = spawnSync(
    "node",
    [generatedCheckerPath, "--help"],
    { encoding: "utf8" }
  );
  assert.equal(help.status, 0, help.stderr);
  assert.equal(help.stderr, "");
  assert.match(help.stdout, /stage-index <topic-id\.\.\.>/u);
  assert.match(help.stdout, /does not read or stage topic Markdown/u);

  const validRoot = path.join(tempRoot, "stage-cli-usage");
  await writeCollection(validRoot, createValidReports());
  const missingStageTopic = spawnSync(
    "node",
    [
      generatedCheckerPath,
      "stage-index",
      "--root",
      validRoot,
      "--json"
    ],
    { encoding: "utf8" }
  );
  assert.equal(missingStageTopic.status, 2);
  assert.equal(missingStageTopic.stderr, "");
  const missingStageTopicResult: unknown = JSON.parse(missingStageTopic.stdout);
  assert.deepEqual(
    missingStageTopicResult,
    {
      changed: false,
      diagnostics: [{
        code: "investigation-report.stage-topic-ids-empty",
        message: "stage-index requires at least one investigation topic id",
        path: null,
        stateId: null
      }],
      indexPath: path.join(
        validRoot,
        "docs",
        "investigations",
        investigationIndexFileName
      ),
      namespace: "investigations",
      selectedIds: [],
      state: "selection-invalid",
      status: "error"
    }
  );

  const invalidStageFilter = spawnSync(
    "node",
    [
      generatedCheckerPath,
      "stage-index",
      "codex/project-shell-registration.md",
      "--root",
      validRoot,
      "--category",
      "codex"
    ],
    { encoding: "utf8" }
  );
  assert.equal(invalidStageFilter.status, 2);
  assert.equal(invalidStageFilter.stdout, "");
  assert.match(
    invalidStageFilter.stderr,
    /stage-index does not accept query filters or pagination/u
  );

  const invalidJsonCommand = spawnSync(
    "node",
    [generatedCheckerPath, "check", "--root", validRoot, "--json"],
    { encoding: "utf8" }
  );
  assert.equal(invalidJsonCommand.status, 2);
  assert.equal(invalidJsonCommand.stdout, "");
  assert.match(
    invalidJsonCommand.stderr,
    /--json is only supported by stage-index/u
  );
}

function isUnknownRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function expectRecord(
  value: unknown,
  label: string
): Record<string, unknown> {
  assert.ok(isUnknownRecord(value), `${label} must be an object`);
  return value;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value)
    && value.every((entry) => typeof entry === "string");
}

async function testGeneratedArtifacts(): Promise<void> {
  const checkerSource = await fs.readFile(generatedCheckerPath, "utf8");
  assert.match(
    checkerSource,
    /Repository: https:\/\/github\.com\/zxyycom\/skills/
  );
  assert.match(
    checkerSource,
    /Maintained source: https:\/\/github\.com\/zxyycom\/skills\/blob\/main\/tools\/investigation-report\/src\/cli\.ts/
  );
  assert.match(
    checkerSource,
    /Rebuild: bun run sync:investigation-report-check/
  );
  assert.match(
    checkerSource,
    /sourceMappingURL=check-investigations\.mjs\.map/
  );

  const declarationSource = await fs.readFile(
    generatedDeclarationPath,
    "utf8"
  );
  assert.match(declarationSource, /validateInvestigationReports/);
  assert.match(declarationSource, /synchronizeInvestigationIndex/);
  assert.match(declarationSource, /queryInvestigationIndex/);
  assert.match(declarationSource, /stageInvestigationIndex/);
  assert.match(declarationSource, /runInvestigationReportCheckCli/);

  const generatedSchemaValue: unknown = JSON.parse(
    await fs.readFile(generatedSchemaPath, "utf8")
  );
  const generatedSchema = expectRecord(
    generatedSchemaValue,
    "generated schema"
  );
  const properties = expectRecord(
    generatedSchema.properties,
    "generated schema properties"
  );
  assert.equal(
    expectRecord(
      properties.definitionVersion,
      "definitionVersion schema"
    ).const,
    4
  );
  assert.equal(
    expectRecord(properties.entries, "entries schema").type,
    "object"
  );
  assert.equal(
    expectRecord(properties.namespace, "namespace schema").const,
    "investigations"
  );
  assert.equal(
    expectRecord(properties.schemaVersion, "schemaVersion schema").const,
    3
  );
  assert.equal(
    expectRecord(properties.sourceRevision, "sourceRevision schema").type,
    "object"
  );
  assert.match(
    JSON.stringify(generatedSchemaValue),
    /resourceReferences/u
  );
  assert.match(
    JSON.stringify(generatedSchemaValue),
    /\^\[0-9a-f\]\{64\}\$/u
  );

  const sourceMapValue: unknown = JSON.parse(
    await fs.readFile(`${generatedCheckerPath}.map`, "utf8")
  );
  const sourceMap = expectRecord(sourceMapValue, "generated source map");
  assert.equal(sourceMap.sourceRoot, "../../../");
  assert.ok(
    isStringArray(sourceMap.sources),
    "source map sources must be strings"
  );
  const sources = sourceMap.sources;
  assert.ok(sources.includes(
    "tools/investigation-report/src/cli.ts"
  ));
  assert.ok(sources.includes(
    "tools/investigation-report/src/investigation-state-index.ts"
  ));
  assert.ok(sources.includes(
    "tools/investigation-report/src/query.ts"
  ));
  assert.ok(sources.includes(
    "tools/investigation-report/src/staging.ts"
  ));
  assert.ok(sources.includes(
    "tools/index-runtime/src/staging.ts"
  ));
  assert.ok(sources.includes(
    "tools/shared/src/version-control/index.ts"
  ));
  assert.ok(sources.includes(
    "tools/index-runtime/src/storage.ts"
  ));
  assert.ok(sources.every((source) => (
    !path.isAbsolute(source) && !source.includes("\\")
  )));
}

test("bundled investigation APIs preserve source implementation parity", () => (
  withTempRoot("cli-bundled", testBundledApiParity)
));

test("generated investigation check command preserves validation contracts", () => (
  withTempRoot("cli-check", testGeneratedCheckCommand)
));

test("generated investigation list command filters indexed topics", () => (
  withTempRoot("cli-list", testGeneratedListCommand)
));

test("generated investigation list rejects stale attached resources", () => (
  withTempRoot("cli-list-resource-stale", testGeneratedListRejectsStaleResources)
));

test("generated investigation sync command writes the full index", () => (
  withTempRoot("cli-sync", testGeneratedSyncCommand)
));

test("generated investigation CLI usage errors preserve exit contracts", () => (
  withTempRoot("cli-usage", testGeneratedCliUsage)
));

test("generated investigation stage CLI usage preserves exit contracts", () => (
  withTempRoot("stage-cli-usage", testGeneratedStageCliUsage)
));

test("generated investigation artifacts expose portable metadata", () => (
  testGeneratedArtifacts()
));

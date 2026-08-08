import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  queryInvestigationIndex as queryBundledInvestigationIndex,
  runInvestigationReportCheckCli,
  synchronizeInvestigationIndex as synchronizeBundledInvestigationIndex,
  validateInvestigationReports as validateBundledInvestigationReports
} from "../../../skills/investigation-report/scripts/check-investigations.mjs";
import { investigationIndexFileName } from "../src/investigation-state-index.ts";
import { validateInvestigationReports } from "../src/validation.ts";
import {
  createValidReports,
  generatedCheckerPath,
  generatedDeclarationPath,
  generatedSchemaPath,
  type ReportInput,
  withTempRoot,
  writeCollection
} from "./support.ts";

async function testBundledApiParity(tempRoot: string): Promise<void> {
  const workspaceRoot = path.join(tempRoot, "bundled-api");
  await writeCollection(workspaceRoot, createValidReports());

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
  await writeCollection(validRoot, createValidReports());

  const cliSuccess = spawnSync(
    "node",
    [generatedCheckerPath, "--root", validRoot],
    { encoding: "utf8" }
  );
  assert.equal(cliSuccess.status, 0, cliSuccess.stderr);
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
  assert.match(
    cliFiltered.stdout,
    /1 of 2 topics checked across 1 categories/
  );
  assert.match(cliFiltered.stdout, /index not checked/);

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
  await writeCollection(cliSyncRoot, [createValidReports()[0]], false);
  const cliSync = spawnSync(
    "node",
    [generatedCheckerPath, "sync-index", "--root", cliSyncRoot],
    { encoding: "utf8" }
  );
  assert.equal(cliSync.status, 0, cliSync.stderr);
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
}

async function testGeneratedCliUsage(tempRoot: string): Promise<void> {
  const help = spawnSync(
    "node",
    [generatedCheckerPath, "--help"],
    { encoding: "utf8" }
  );
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /Usage: check-investigations\.mjs/);
  assert.match(help.stdout, /self-contained reports/);
  assert.match(help.stdout, /full-index freshness/);
  assert.match(help.stdout, /sync-index validates every topic/);
  assert.match(help.stdout, /list checks index freshness/);

  const validRoot = path.join(tempRoot, "cli-usage");
  await writeCollection(validRoot, createValidReports());
  const invalidArgument = spawnSync(
    "node",
    [generatedCheckerPath, "--unknown"],
    { encoding: "utf8" }
  );
  assert.equal(invalidArgument.status, 2);

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
  assert.match(declarationSource, /runInvestigationReportCheckCli/);

  const generatedSchema = JSON.parse(
    await fs.readFile(generatedSchemaPath, "utf8")
  ) as {
    properties: {
      definitionVersion: { const: number };
      entries: { type: string };
      namespace: { const: string };
      schemaVersion: { const: number };
      sourceRevision: { type: string };
    };
  };
  assert.equal(generatedSchema.properties.definitionVersion.const, 2);
  assert.equal(generatedSchema.properties.entries.type, "object");
  assert.equal(
    generatedSchema.properties.namespace.const,
    "investigations"
  );
  assert.equal(generatedSchema.properties.schemaVersion.const, 3);
  assert.equal(generatedSchema.properties.sourceRevision.type, "object");

  const sourceMap = JSON.parse(
    await fs.readFile(`${generatedCheckerPath}.map`, "utf8")
  ) as {
    sourceRoot: string;
    sources: string[];
  };
  assert.equal(sourceMap.sourceRoot, "../../../");
  assert.ok(sourceMap.sources.includes(
    "tools/investigation-report/src/cli.ts"
  ));
  assert.ok(sourceMap.sources.includes(
    "tools/investigation-report/src/investigation-state-index.ts"
  ));
  assert.ok(sourceMap.sources.includes(
    "tools/investigation-report/src/query.ts"
  ));
  assert.ok(sourceMap.sources.includes(
    "tools/index-runtime/src/storage.ts"
  ));
  assert.ok(sourceMap.sources.every((source) => (
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

test("generated investigation sync command writes the full index", () => (
  withTempRoot("cli-sync", testGeneratedSyncCommand)
));

test("generated investigation CLI usage errors preserve exit contracts", () => (
  withTempRoot("cli-usage", testGeneratedCliUsage)
));

test("generated investigation artifacts expose portable metadata", () => (
  testGeneratedArtifacts()
));

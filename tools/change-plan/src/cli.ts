#!/usr/bin/env node

import path from "node:path";
import process from "node:process";
import { parseArgs } from "node:util";
import { isMainModule } from "../../shared/src/node/main-module.ts";
import { archiveChangePlanDirectory } from "./archive.ts";
import {
  checkChangePlanCollection,
  listChangePlans,
  showChangePlanDirectory
} from "./catalog.ts";
import { checkChangePlanDirectory } from "./check.ts";
import { planChangePlanDirectory } from "./lifecycle.ts";
import {
  ChangePlanMetadataError,
  parseChangePlanMetadata,
  readChangePlanMetadata
} from "./metadata.ts";
import {
  changePlanArtifactNames,
  type ChangePlanCheckResult,
  type ChangePlanCollectionCheckResult,
  type ChangePlanDiagnostic,
  type ChangePlanLifecycleResult,
  type ChangePlanListSelection,
  type ChangePlanStage,
  type GitDistanceEvidence
} from "./types.ts";

function helpText(): string {
  return [
    "Usage:",
    "  change-plan.mjs list [change-root] [--archived | --all | --stage <stage>] [--json]",
    "  change-plan.mjs show <change-directory> [--json]",
    "  change-plan.mjs check <change-directory> [--json]",
    "  change-plan.mjs check-all [change-root] [--json]",
    "  change-plan.mjs plan <change-directory> [--json]",
    "  change-plan.mjs archive <change-directory> [--json]",
    "",
    "Manage Draft and Plan artifacts, checks, Git distance, and archive delivery.",
    "Check commands apply mechanical gates only; they do not approve plans or judge semantics.",
    "",
    "Options:",
    "  --archived   List archived changes",
    "  --all        List active and archived changes",
    "  --stage      List active changes in draft or plan stage",
    "  --json       Write the structured result to stdout",
    "  -h, --help   Show this help"
  ].join("\n");
}

function formatGitDistance(evidence: GitDistanceEvidence): string {
  if (evidence.commitCount === 0 && evidence.changedLines === 0) {
    return "自计划基线以来，未统计到 Change 目录外的项目变化。";
  }
  return (
    `距离计划基线已过去 ${evidence.commitCount} 个提交，` +
    `Change 目录外累计变化 ${evidence.changedLines} 行；` +
    "继续前请确认这些变化没有影响当前计划。"
  );
}

function formatDiagnostic(diagnostic: ChangePlanDiagnostic): string {
  const location =
    diagnostic.file === null
      ? ""
      : `${diagnostic.file}${diagnostic.line === undefined ? "" : `:${diagnostic.line}`}: `;
  return `- ${location}[${diagnostic.code}] ${diagnostic.message}`;
}

function printCheckDiagnostics(
  prefix: string,
  result: ChangePlanCheckResult
): void {
  console.error(`${prefix} (${result.changeDirectory}):`);
  for (const diagnostic of result.diagnostics) {
    console.error(formatDiagnostic(diagnostic));
  }
}

function printDistance(distance: GitDistanceEvidence | null): void {
  if (distance !== null) {
    console.log(formatGitDistance(distance));
  }
}

async function runCheckCommand(
  changeDirectory: string,
  json: boolean
): Promise<number> {
  const result = await checkChangePlanDirectory(changeDirectory);
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return result.valid ? 0 : 1;
  }
  if (!result.valid) {
    printCheckDiagnostics("Change plan check failed", result);
    return 1;
  }
  console.log(
    `Change plan check passed (${result.changeName}; ` +
      `${result.completedTaskCount}/${result.taskCount} tasks completed; ` +
      `stage ${result.stage ?? "none"}).`
  );
  printDistance(result.distance);
  return 0;
}

function formatCollectionCheckSummary(
  result: ChangePlanCollectionCheckResult
): string {
  return (
    `active; ${result.changeRoot}; ` +
    `${result.validCount}/${result.checkedCount} changes valid`
  );
}

async function runCollectionCheckCommand(
  changeRoot: string | undefined,
  json: boolean
): Promise<number> {
  const result = await checkChangePlanCollection({ changeRoot });
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return result.valid ? 0 : 1;
  }
  const summary = formatCollectionCheckSummary(result);
  if (result.valid) {
    console.log(`Change plan collection check passed (${summary}).`);
    return 0;
  }
  console.error(`Change plan collection check failed (${summary}).`);
  for (const error of result.errors) {
    console.error(`- ${error}`);
  }
  for (const entry of result.entries) {
    if (!entry.valid) {
      printCheckDiagnostics("Change plan check failed", entry);
    }
  }
  return 1;
}

async function runListCommand(
  changeRoot: string | undefined,
  selection: ChangePlanListSelection,
  stage: ChangePlanStage | undefined,
  json: boolean
): Promise<number> {
  const result = await listChangePlans({
    changeRoot,
    stage,
    status: selection
  });
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return result.errors.length === 0 ? 0 : 1;
  }
  if (result.errors.length > 0) {
    console.error("Change plan list failed:");
    for (const error of result.errors) {
      console.error(`- ${error}`);
    }
    return 1;
  }
  console.log(`Changes (${result.status}; ${result.changeRoot}):`);
  if (result.entries.length === 0) {
    console.log("- none");
    return 0;
  }
  for (const entry of result.entries) {
    if (entry.status === "archived") {
      console.log(`- archived ${entry.changeName} ${entry.changeDirectory}`);
      continue;
    }
    console.log(
      `- ${entry.status} ${entry.changeName} ` +
        `stage=${entry.stage ?? "none"} ` +
        `${entry.completedTaskCount}/${entry.taskCount} ` +
        `${entry.valid ? "valid" : "invalid"} ` +
        entry.changeDirectory
    );
    printDistance(entry.distance);
  }
  return 0;
}

async function runShowCommand(
  changeDirectory: string,
  json: boolean
): Promise<number> {
  const result = await showChangePlanDirectory(changeDirectory);
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    const showSucceeded =
      result.status === "active"
        ? result.check.valid
        : result.errors.length === 0;
    return showSucceeded ? 0 : 1;
  }
  if (result.status === "archived") {
    console.log(`Change: ${result.changeName}`);
    console.log("Status: archived");
    console.log(`Directory: ${result.changeDirectory}`);
    console.log("Check: not applicable (archived)");
    for (const artifact of changePlanArtifactNames) {
      console.log("");
      console.log(`--- ${artifact} ---`);
      const contents = result.artifacts[artifact];
      console.log(
        contents === null ? "[missing or unreadable]" : contents.trimEnd()
      );
    }
    if (result.errors.length > 0) {
      console.error("Archived change show failed:");
      for (const error of result.errors) {
        console.error(`- ${error}`);
      }
      return 1;
    }
    return 0;
  }
  console.log(`Change: ${result.check.changeName}`);
  console.log(`Status: ${result.status}`);
  console.log(`Stage: ${result.check.stage ?? "none"}`);
  if (result.check.distance !== null) {
    console.log(`Base commit: ${result.check.distance.baseCommit}`);
    console.log(`Head commit: ${result.check.distance.headCommit}`);
    console.log(formatGitDistance(result.check.distance));
  }
  console.log(`Directory: ${result.check.changeDirectory}`);
  console.log(
    `Tasks: ${result.check.completedTaskCount}/${result.check.taskCount}`
  );
  console.log(`Check: ${result.check.valid ? "valid" : "invalid"}`);
  for (const artifact of changePlanArtifactNames) {
    console.log("");
    console.log(`--- ${artifact} ---`);
    const contents = result.artifacts[artifact];
    console.log(
      contents === null ? "[missing or unreadable]" : contents.trimEnd()
    );
  }
  if (!result.check.valid) {
    printCheckDiagnostics(
      "Change plan show completed with diagnostics",
      result.check
    );
    return 1;
  }
  return 0;
}

async function runPlanCommand(
  changeDirectory: string,
  json: boolean
): Promise<number> {
  const result: ChangePlanLifecycleResult =
    await planChangePlanDirectory(changeDirectory);
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return result.success ? 0 : 1;
  }
  if (!result.success) {
    console.error(
      `Change plan ${result.action} failed [${result.errorCode}]: ${result.error}`
    );
    for (const diagnostic of result.diagnostics) {
      console.error(formatDiagnostic(diagnostic));
    }
    return 1;
  }
  const changeName = path.basename(path.resolve(changeDirectory));
  console.log(
    `Change plan ${changeName}: ` +
      `${result.fromStage} -> ${result.metadata.stage} (${result.action}).`
  );
  return 0;
}

async function runArchiveCommand(
  changeDirectory: string,
  json: boolean
): Promise<number> {
  const result = await archiveChangePlanDirectory(changeDirectory);
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return result.archived ? 0 : 1;
  }
  if (!result.archived) {
    console.error(`Change plan archive failed: ${result.error}`);
    if (result.check !== null && !result.check.valid) {
      for (const diagnostic of result.check.diagnostics) {
        console.error(formatDiagnostic(diagnostic));
      }
    }
    return 1;
  }
  console.log(
    `Archived change plan ${result.check.changeName} to ` +
      `${result.archivedDirectory} ` +
      `(${result.check.completedTaskCount}/${result.check.taskCount} tasks completed).`
  );
  return 0;
}

function invalidArguments(message: string): number {
  console.error(message);
  console.error("Run change-plan.mjs --help for usage.");
  return 2;
}

function parseStage(value: string | undefined): ChangePlanStage | undefined {
  return value === "draft" || value === "plan" ? value : undefined;
}

function parseListSelection(
  all: boolean,
  archived: boolean
): ChangePlanListSelection | undefined {
  if (all && archived) {
    return undefined;
  }
  if (all) {
    return "all";
  }
  return archived ? "archived" : "active";
}

export async function runChangePlanCli(
  argv: readonly string[] = process.argv.slice(2)
): Promise<number> {
  let parsed: ReturnType<typeof parseArgs>;
  try {
    parsed = parseArgs({
      allowPositionals: true,
      args: [...argv],
      options: {
        all: { type: "boolean" },
        archived: { type: "boolean" },
        help: { short: "h", type: "boolean" },
        json: { type: "boolean" },
        stage: { type: "string" }
      },
      strict: true
    });
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 2;
  }
  if (parsed.values.help === true) {
    console.log(helpText());
    return 0;
  }

  const [command, ...operands] = parsed.positionals;
  const json = parsed.values.json === true;
  const stageValue = parsed.values.stage;
  const stageArgument = typeof stageValue === "string" ? stageValue : undefined;
  if (command === "list") {
    if (operands.length > 1 || operands[0]?.trim().length === 0) {
      return invalidArguments(
        "Expected: change-plan.mjs list [change-root] [--archived | --all | --stage <stage>] [--json]"
      );
    }
    const selection = parseListSelection(
      parsed.values.all === true,
      parsed.values.archived === true
    );
    if (
      selection === undefined ||
      (stageValue !== undefined && selection !== "active")
    ) {
      return invalidArguments(
        "--archived, --all, and --stage cannot be used together."
      );
    }
    const stage = parseStage(stageArgument);
    if (stageValue !== undefined && stage === undefined) {
      return invalidArguments("--stage must be draft or plan.");
    }
    return await runListCommand(operands[0], selection, stage, json);
  }

  if (command === "check-all") {
    if (operands.length > 1 || operands[0]?.trim().length === 0) {
      return invalidArguments(
        "Expected: change-plan.mjs check-all [change-root] [--json]"
      );
    }
    if (
      parsed.values.all === true ||
      parsed.values.archived === true ||
      stageValue !== undefined
    ) {
      return invalidArguments(
        "--archived, --all, and --stage are only valid with list."
      );
    }
    return await runCollectionCheckCommand(operands[0], json);
  }

  if (
    parsed.values.all === true ||
    parsed.values.archived === true ||
    stageValue !== undefined
  ) {
    return invalidArguments(
      "--archived, --all, and --stage are only valid with list."
    );
  }
  const changeDirectory = operands[0];
  if (
    operands.length !== 1 ||
    changeDirectory === undefined ||
    changeDirectory.trim().length === 0
  ) {
    return invalidArguments("Expected: one <change-directory> operand.");
  }
  if (command === "show") {
    return await runShowCommand(changeDirectory, json);
  }
  if (command === "check") {
    return await runCheckCommand(changeDirectory, json);
  }
  if (command === "plan") {
    return await runPlanCommand(changeDirectory, json);
  }
  if (command === "archive") {
    return await runArchiveCommand(changeDirectory, json);
  }
  return invalidArguments(
    `Unknown change-plan command: ${command ?? "<missing>"}`
  );
}

export {
  archiveChangePlanDirectory,
  checkChangePlanCollection,
  checkChangePlanDirectory,
  listChangePlans,
  parseChangePlanMetadata,
  planChangePlanDirectory,
  readChangePlanMetadata,
  showChangePlanDirectory,
  ChangePlanMetadataError
};
export type {
  ChangePlanArchiveResult,
  ChangePlanActiveListEntry,
  ChangePlanActiveShowResult,
  ChangePlanArtifactContents,
  ChangePlanArtifactName,
  ChangePlanArchivedListEntry,
  ChangePlanArchivedShowResult,
  ChangePlanCheckResult,
  ChangePlanCollectionCheckResult,
  ChangePlanCollectionOptions,
  ChangePlanDiagnostic,
  ChangePlanDiagnosticCode,
  ChangePlanFileName,
  ChangePlanLifecycleAction,
  ChangePlanLifecycleErrorCode,
  ChangePlanLifecycleFailure,
  ChangePlanLifecycleResult,
  ChangePlanLifecycleSuccess,
  ChangePlanListEntry,
  ChangePlanListOptions,
  ChangePlanListResult,
  ChangePlanListSelection,
  ChangePlanMetadata,
  ChangePlanMetadataName,
  ChangePlanShowResult,
  ChangePlanStage,
  ChangePlanStatus,
  ChangePlanTaskProgress,
  ChangePlanTaskSection,
  ChangePlanTaskSectionProgress,
  GitDistanceEvidence
} from "./types.ts";
export type { ChangePlanMetadataErrorCode } from "./metadata.ts";

if (isMainModule(import.meta.url)) {
  try {
    process.exitCode = await runChangePlanCli();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

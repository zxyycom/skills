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

export type ChangePlanCliIo = {
  stderr: (text: string) => void;
  stdout: (text: string) => void;
};

export type ChangePlanCliOptions = {
  cwd?: string;
  io?: ChangePlanCliIo;
};

const processCliIo: ChangePlanCliIo = {
  stderr: (text) => process.stderr.write(text),
  stdout: (text) => process.stdout.write(text)
};

function writeLine(writer: (text: string) => void, text: string): void {
  writer(`${text}\n`);
}

function printCheckDiagnostics(
  prefix: string,
  result: ChangePlanCheckResult,
  io: ChangePlanCliIo
): void {
  writeLine(io.stderr, `${prefix} (${result.changeDirectory}):`);
  for (const diagnostic of result.diagnostics) {
    writeLine(io.stderr, formatDiagnostic(diagnostic));
  }
}

function printDistance(
  distance: GitDistanceEvidence | null,
  io: ChangePlanCliIo
): void {
  if (distance !== null) {
    writeLine(io.stdout, formatGitDistance(distance));
  }
}

async function runCheckCommand(
  changeDirectory: string,
  json: boolean,
  io: ChangePlanCliIo
): Promise<number> {
  const result = await checkChangePlanDirectory(changeDirectory);
  if (json) {
    writeLine(io.stdout, JSON.stringify(result, null, 2));
    return result.valid ? 0 : 1;
  }
  if (!result.valid) {
    printCheckDiagnostics("Change plan check failed", result, io);
    return 1;
  }
  writeLine(
    io.stdout,
    `Change plan check passed (${result.changeName}; ` +
      `${result.completedTaskCount}/${result.taskCount} tasks completed; ` +
      `stage ${result.stage ?? "none"}).`
  );
  printDistance(result.distance, io);
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
  json: boolean,
  io: ChangePlanCliIo
): Promise<number> {
  const result = await checkChangePlanCollection({ changeRoot });
  if (json) {
    writeLine(io.stdout, JSON.stringify(result, null, 2));
    return result.valid ? 0 : 1;
  }
  const summary = formatCollectionCheckSummary(result);
  if (result.valid) {
    writeLine(io.stdout, `Change plan collection check passed (${summary}).`);
    return 0;
  }
  writeLine(io.stderr, `Change plan collection check failed (${summary}).`);
  for (const error of result.errors) {
    writeLine(io.stderr, `- ${error}`);
  }
  for (const entry of result.entries) {
    if (!entry.valid) {
      printCheckDiagnostics("Change plan check failed", entry, io);
    }
  }
  return 1;
}

async function runListCommand(
  changeRoot: string | undefined,
  selection: ChangePlanListSelection,
  stage: ChangePlanStage | undefined,
  json: boolean,
  io: ChangePlanCliIo
): Promise<number> {
  const result = await listChangePlans({
    changeRoot,
    stage,
    status: selection
  });
  if (json) {
    writeLine(io.stdout, JSON.stringify(result, null, 2));
    return result.errors.length === 0 ? 0 : 1;
  }
  if (result.errors.length > 0) {
    writeLine(io.stderr, "Change plan list failed:");
    for (const error of result.errors) {
      writeLine(io.stderr, `- ${error}`);
    }
    return 1;
  }
  writeLine(io.stdout, `Changes (${result.status}; ${result.changeRoot}):`);
  if (result.entries.length === 0) {
    writeLine(io.stdout, "- none");
    return 0;
  }
  for (const entry of result.entries) {
    if (entry.status === "archived") {
      writeLine(
        io.stdout,
        `- archived ${entry.changeName} ${entry.changeDirectory}`
      );
      continue;
    }
    writeLine(
      io.stdout,
      `- ${entry.status} ${entry.changeName} ` +
        `stage=${entry.stage ?? "none"} ` +
        `${entry.completedTaskCount}/${entry.taskCount} ` +
        `${entry.valid ? "valid" : "invalid"} ` +
        entry.changeDirectory
    );
    printDistance(entry.distance, io);
  }
  return 0;
}

async function runShowCommand(
  changeDirectory: string,
  json: boolean,
  io: ChangePlanCliIo
): Promise<number> {
  const result = await showChangePlanDirectory(changeDirectory);
  if (json) {
    writeLine(io.stdout, JSON.stringify(result, null, 2));
    const showSucceeded =
      result.status === "active"
        ? result.check.valid
        : result.errors.length === 0;
    return showSucceeded ? 0 : 1;
  }
  if (result.status === "archived") {
    writeLine(io.stdout, `Change: ${result.changeName}`);
    writeLine(io.stdout, "Status: archived");
    writeLine(io.stdout, `Directory: ${result.changeDirectory}`);
    writeLine(io.stdout, "Check: not applicable (archived)");
    for (const artifact of changePlanArtifactNames) {
      writeLine(io.stdout, "");
      writeLine(io.stdout, `--- ${artifact} ---`);
      const contents = result.artifacts[artifact];
      writeLine(
        io.stdout,
        contents === null ? "[missing or unreadable]" : contents.trimEnd()
      );
    }
    if (result.errors.length > 0) {
      writeLine(io.stderr, "Archived change show failed:");
      for (const error of result.errors) {
        writeLine(io.stderr, `- ${error}`);
      }
      return 1;
    }
    return 0;
  }
  writeLine(io.stdout, `Change: ${result.check.changeName}`);
  writeLine(io.stdout, `Status: ${result.status}`);
  writeLine(io.stdout, `Stage: ${result.check.stage ?? "none"}`);
  if (result.check.distance !== null) {
    writeLine(io.stdout, `Base commit: ${result.check.distance.baseCommit}`);
    writeLine(io.stdout, `Head commit: ${result.check.distance.headCommit}`);
    writeLine(io.stdout, formatGitDistance(result.check.distance));
  }
  writeLine(io.stdout, `Directory: ${result.check.changeDirectory}`);
  writeLine(
    io.stdout,
    `Tasks: ${result.check.completedTaskCount}/${result.check.taskCount}`
  );
  writeLine(io.stdout, `Check: ${result.check.valid ? "valid" : "invalid"}`);
  for (const artifact of changePlanArtifactNames) {
    writeLine(io.stdout, "");
    writeLine(io.stdout, `--- ${artifact} ---`);
    const contents = result.artifacts[artifact];
    writeLine(
      io.stdout,
      contents === null ? "[missing or unreadable]" : contents.trimEnd()
    );
  }
  if (!result.check.valid) {
    printCheckDiagnostics(
      "Change plan show completed with diagnostics",
      result.check,
      io
    );
    return 1;
  }
  return 0;
}

async function runPlanCommand(
  changeDirectory: string,
  json: boolean,
  io: ChangePlanCliIo
): Promise<number> {
  const result: ChangePlanLifecycleResult =
    await planChangePlanDirectory(changeDirectory);
  if (json) {
    writeLine(io.stdout, JSON.stringify(result, null, 2));
    return result.success ? 0 : 1;
  }
  if (!result.success) {
    writeLine(
      io.stderr,
      `Change plan ${result.action} failed [${result.errorCode}]: ${result.error}`
    );
    for (const diagnostic of result.diagnostics) {
      writeLine(io.stderr, formatDiagnostic(diagnostic));
    }
    return 1;
  }
  const changeName = path.basename(path.resolve(changeDirectory));
  writeLine(
    io.stdout,
    `Change plan ${changeName}: ` +
      `${result.fromStage} -> ${result.metadata.stage} (${result.action}).`
  );
  return 0;
}

async function runArchiveCommand(
  changeDirectory: string,
  json: boolean,
  io: ChangePlanCliIo
): Promise<number> {
  const result = await archiveChangePlanDirectory(changeDirectory);
  if (json) {
    writeLine(io.stdout, JSON.stringify(result, null, 2));
    return result.archived ? 0 : 1;
  }
  if (!result.archived) {
    writeLine(io.stderr, `Change plan archive failed: ${result.error}`);
    if (result.check !== null && !result.check.valid) {
      for (const diagnostic of result.check.diagnostics) {
        writeLine(io.stderr, formatDiagnostic(diagnostic));
      }
    }
    return 1;
  }
  writeLine(
    io.stdout,
    `Archived change plan ${result.check.changeName} to ` +
      `${result.archivedDirectory} ` +
      `(${result.check.completedTaskCount}/${result.check.taskCount} tasks completed).`
  );
  return 0;
}

function invalidArguments(message: string, io: ChangePlanCliIo): number {
  writeLine(io.stderr, message);
  writeLine(io.stderr, "Run change-plan.mjs --help for usage.");
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
  argv: readonly string[] = process.argv.slice(2),
  options: ChangePlanCliOptions = {}
): Promise<number> {
  const cwd = options.cwd ?? process.cwd();
  const io = options.io ?? processCliIo;
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
    writeLine(
      io.stderr,
      error instanceof Error ? error.message : String(error)
    );
    return 2;
  }
  if (parsed.values.help === true) {
    writeLine(io.stdout, helpText());
    return 0;
  }

  const [command, ...operands] = parsed.positionals;
  const json = parsed.values.json === true;
  const stageValue = parsed.values.stage;
  const stageArgument = typeof stageValue === "string" ? stageValue : undefined;
  if (command === "list") {
    if (operands.length > 1 || operands[0]?.trim().length === 0) {
      return invalidArguments(
        "Expected: change-plan.mjs list [change-root] [--archived | --all | --stage <stage>] [--json]",
        io
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
        "--archived, --all, and --stage cannot be used together.",
        io
      );
    }
    const stage = parseStage(stageArgument);
    if (stageValue !== undefined && stage === undefined) {
      return invalidArguments("--stage must be draft or plan.", io);
    }
    return await runListCommand(
      operands[0] === undefined
        ? path.join(cwd, "changes")
        : path.resolve(cwd, operands[0]),
      selection,
      stage,
      json,
      io
    );
  }

  if (command === "check-all") {
    if (operands.length > 1 || operands[0]?.trim().length === 0) {
      return invalidArguments(
        "Expected: change-plan.mjs check-all [change-root] [--json]",
        io
      );
    }
    if (
      parsed.values.all === true ||
      parsed.values.archived === true ||
      stageValue !== undefined
    ) {
      return invalidArguments(
        "--archived, --all, and --stage are only valid with list.",
        io
      );
    }
    return await runCollectionCheckCommand(
      operands[0] === undefined
        ? path.join(cwd, "changes")
        : path.resolve(cwd, operands[0]),
      json,
      io
    );
  }

  if (
    parsed.values.all === true ||
    parsed.values.archived === true ||
    stageValue !== undefined
  ) {
    return invalidArguments(
      "--archived, --all, and --stage are only valid with list.",
      io
    );
  }
  const changeDirectory = operands[0];
  if (
    operands.length !== 1 ||
    changeDirectory === undefined ||
    changeDirectory.trim().length === 0
  ) {
    return invalidArguments("Expected: one <change-directory> operand.", io);
  }
  if (command === "show") {
    return await runShowCommand(path.resolve(cwd, changeDirectory), json, io);
  }
  if (command === "check") {
    return await runCheckCommand(path.resolve(cwd, changeDirectory), json, io);
  }
  if (command === "plan") {
    return await runPlanCommand(path.resolve(cwd, changeDirectory), json, io);
  }
  if (command === "archive") {
    return await runArchiveCommand(
      path.resolve(cwd, changeDirectory),
      json,
      io
    );
  }
  return invalidArguments(
    `Unknown change-plan command: ${command ?? "<missing>"}`,
    io
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
    processCliIo.stderr(
      `${error instanceof Error ? error.message : String(error)}\n`
    );
    process.exitCode = 1;
  }
}

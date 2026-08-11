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
import {
  implementChangePlanDirectory,
  planChangePlanDirectory,
  reconcileChangePlanDirectory,
  resumeChangePlanDirectory,
  shelveChangePlanDirectory
} from "./lifecycle.ts";
import {
  ChangePlanMetadataError,
  parseChangePlanMetadata,
  readChangePlanMetadata
} from "./metadata.ts";
import {
  changePlanArtifactNames,
  type ChangePlanAssessment,
  type ChangePlanCheckResult,
  type ChangePlanCollectionCheckResult,
  type ChangePlanCollectionSelection,
  type ChangePlanDiagnostic,
  type ChangePlanLifecycleAction,
  type ChangePlanLifecycleResult,
  type ChangePlanStage
} from "./types.ts";

type NonShelveLifecycleAction = Exclude<
  ChangePlanLifecycleAction,
  "shelve"
>;

type LifecycleCliCommand =
  | {
    action: NonShelveLifecycleAction;
    changeDirectory: string;
    json: boolean;
  }
  | {
    action: "shelve";
    changeDirectory: string;
    json: boolean;
    reason: string;
  };

function helpText(): string {
  return [
    "Usage:",
    "  change-plan.mjs list [change-root] [--archived | --all | --stage <stage>] [--json]",
    "  change-plan.mjs show <change-directory> [--json]",
    "  change-plan.mjs check <change-directory> [--json]",
    "  change-plan.mjs check-all [change-root] [--archived | --all] [--json]",
    "  change-plan.mjs plan <change-directory> [--json]",
    "  change-plan.mjs implement <change-directory> [--json]",
    "  change-plan.mjs shelve <change-directory> --reason <text> [--json]",
    "  change-plan.mjs reconcile <change-directory> [--json]",
    "  change-plan.mjs resume <change-directory> [--json]",
    "  change-plan.mjs archive <change-directory> [--json]",
    "",
    "Manage the basic lifecycle of proposal.md, design.md, and tasks.md change plans.",
    "Commands apply mechanical checks only; they do not approve plans or judge semantics.",
    "",
    "Options:",
    "  --archived   Select archived changes for list or check-all",
    "  --all        Select active and archived changes for list or check-all",
    "  --stage      List active changes in one lifecycle stage",
    "  --reason     Record why a confirmed plan is explicitly shelved",
    "  --json       Write the structured result to stdout",
    "  -h, --help   Show this help"
  ].join("\n");
}

function formatAssessment(assessment: ChangePlanAssessment | null): string {
  if (assessment === null) {
    return "unavailable";
  }
  if (assessment.assessment === "plan-review-required") {
    return `${assessment.assessment} (${assessment.reason})`;
  }
  if (
    assessment.assessment === "shelve-candidate"
  ) {
    return `${assessment.assessment}: ${assessment.commitCount} commits / `
      + `${assessment.changedLines} changed lines since plan`;
  }
  return assessment.assessment;
}

function formatDiagnostic(diagnostic: ChangePlanDiagnostic): string {
  const location = diagnostic.file === null
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
    `Change plan check passed (${result.changeName}; `
    + `${result.completedTaskCount}/${result.taskCount} tasks completed; `
    + `stage ${result.stage ?? "none"}; `
    + `assessment ${formatAssessment(result.assessment)}).`
  );
  return 0;
}

function formatCollectionCheckSummary(
  result: ChangePlanCollectionCheckResult
): string {
  return `${result.status}; ${result.changeRoot}; `
    + `${result.validCount}/${result.checkedCount} changes valid`;
}

async function runCollectionCheckCommand(
  changeRoot: string | undefined,
  selection: ChangePlanCollectionSelection,
  json: boolean
): Promise<number> {
  const result = await checkChangePlanCollection({
    changeRoot,
    status: selection
  });
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
  selection: ChangePlanCollectionSelection,
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
    console.log(
      `- ${entry.status} ${entry.changeName} `
      + `stage=${entry.stage ?? "none"} `
      + `assessment=${formatAssessment(entry.assessment)} `
      + `${entry.completedTaskCount}/${entry.taskCount} `
      + `${entry.valid ? "valid" : "invalid"} `
      + entry.changeDirectory
    );
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
    return result.check.valid ? 0 : 1;
  }

  console.log(`Change: ${result.check.changeName}`);
  console.log(`Status: ${result.status}`);
  console.log(`Stage: ${result.check.stage ?? "none"}`);
  const assessment = result.check.assessment;
  console.log(`Assessment: ${formatAssessment(assessment)}`);
  if (
    assessment?.assessment === "current"
    || assessment?.assessment === "shelve-candidate"
  ) {
    console.log(`Policy: ${assessment.policy}`);
    console.log(`Base commit: ${assessment.baseCommit}`);
    console.log(`Head commit: ${assessment.headCommit}`);
    console.log(
      `Git distance: ${assessment.commitCount} commits / `
      + `${assessment.changedLines} changed lines`
    );
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
    console.log(contents === null ? "[missing or unreadable]" : contents.trimEnd());
  }

  if (!result.check.valid) {
    printCheckDiagnostics("Change plan show completed with diagnostics", result.check);
    return 1;
  }
  return 0;
}

async function runLifecycleCommand(
  command: LifecycleCliCommand
): Promise<number> {
  let result: ChangePlanLifecycleResult;
  switch (command.action) {
    case "plan":
      result = await planChangePlanDirectory(command.changeDirectory);
      break;
    case "implement":
      result = await implementChangePlanDirectory(command.changeDirectory);
      break;
    case "shelve":
      result = await shelveChangePlanDirectory(
        command.changeDirectory,
        command.reason
      );
      break;
    case "reconcile":
      result = await reconcileChangePlanDirectory(command.changeDirectory);
      break;
    case "resume":
      result = await resumeChangePlanDirectory(command.changeDirectory);
      break;
  }

  if (command.json) {
    console.log(JSON.stringify(result, null, 2));
    return result.success ? 0 : 1;
  }
  if (!result.success) {
    console.error(
      `Change plan ${result.action} failed [${result.errorCode}]: ${result.error}`
    );
    if (result.diagnostics.length > 0) {
      for (const diagnostic of result.diagnostics) {
        console.error(formatDiagnostic(diagnostic));
      }
    }
    return 1;
  }

  const changeName = path.basename(path.resolve(command.changeDirectory));
  console.log(
    `Change plan ${changeName}: `
    + `${result.fromStage} -> ${result.metadata.stage} (${result.action}).`
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
    `Archived change plan ${result.check.changeName} to `
    + `${result.archivedDirectory} `
    + `(${result.check.completedTaskCount}/${result.check.taskCount} tasks completed).`
  );
  return 0;
}

function invalidArguments(message: string): number {
  console.error(message);
  console.error("Run change-plan.mjs --help for usage.");
  return 2;
}

function parseStage(value: string | undefined): ChangePlanStage | undefined {
  if (
    value === "draft"
    || value === "plan"
    || value === "implementation"
    || value === "shelved"
  ) {
    return value;
  }
  return undefined;
}

function parseCollectionSelection(
  all: boolean,
  archived: boolean
): ChangePlanCollectionSelection | undefined {
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
        reason: { type: "string" },
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
  const reasonValue = parsed.values.reason;
  const reason = typeof reasonValue === "string" ? reasonValue : undefined;
  const stageValue = parsed.values.stage;
  const stageArgument = typeof stageValue === "string" ? stageValue : undefined;
  if (command === "list") {
    if (operands.length > 1 || operands[0]?.trim().length === 0) {
      return invalidArguments(
        "Expected: change-plan.mjs list [change-root] "
        + "[--archived | --all | --stage <stage>] [--json]"
      );
    }
    if (reasonValue !== undefined) {
      return invalidArguments("--reason is only valid with shelve.");
    }
    const selection = parseCollectionSelection(
      parsed.values.all === true,
      parsed.values.archived === true
    );
    if (
      selection === undefined
      || (stageValue !== undefined && selection !== "active")
    ) {
      return invalidArguments(
        "--archived, --all, and --stage cannot be used together."
      );
    }
    const stage = parseStage(stageArgument);
    if (stageValue !== undefined && stage === undefined) {
      return invalidArguments(
        "--stage must be draft, plan, implementation, or shelved."
      );
    }
    return await runListCommand(operands[0], selection, stage, json);
  }

  if (command === "check-all") {
    if (operands.length > 1 || operands[0]?.trim().length === 0) {
      return invalidArguments(
        "Expected: change-plan.mjs check-all [change-root] "
        + "[--archived | --all] [--json]"
      );
    }
    if (reasonValue !== undefined) {
      return invalidArguments("--reason is only valid with shelve.");
    }
    if (stageValue !== undefined) {
      return invalidArguments("--stage is only valid with list.");
    }
    const selection = parseCollectionSelection(
      parsed.values.all === true,
      parsed.values.archived === true
    );
    if (selection === undefined) {
      return invalidArguments("--archived and --all cannot be used together.");
    }
    return await runCollectionCheckCommand(
      operands[0],
      selection,
      json
    );
  }

  if (
    parsed.values.all === true
    || parsed.values.archived === true
    || stageValue !== undefined
  ) {
    return invalidArguments(
      "--archived and --all are only valid with list or check-all; "
      + "--stage is only valid with list."
    );
  }
  const changeDirectory = operands[0];
  if (
    operands.length !== 1
    || changeDirectory === undefined
    || changeDirectory.trim().length === 0
  ) {
    return invalidArguments(
      "Expected: one <change-directory> operand."
    );
  }

  if (command === "shelve") {
    if (reason === undefined || reason.trim().length === 0) {
      return invalidArguments("shelve requires a non-empty --reason <text>.");
    }
    return await runLifecycleCommand({
      action: "shelve",
      changeDirectory,
      json,
      reason: reason.trim()
    });
  }
  if (reasonValue !== undefined) {
    return invalidArguments("--reason is only valid with shelve.");
  }

  if (command === "show") {
    return await runShowCommand(changeDirectory, json);
  }
  if (command === "check") {
    return await runCheckCommand(changeDirectory, json);
  }
  if (
    command === "plan"
    || command === "implement"
    || command === "reconcile"
    || command === "resume"
  ) {
    return await runLifecycleCommand({
      action: command,
      changeDirectory,
      json
    });
  }
  if (command === "archive") {
    return await runArchiveCommand(changeDirectory, json);
  }
  return invalidArguments(`Unknown change-plan command: ${command ?? "<missing>"}`);
}

export {
  archiveChangePlanDirectory,
  checkChangePlanCollection,
  checkChangePlanDirectory,
  implementChangePlanDirectory,
  listChangePlans,
  parseChangePlanMetadata,
  planChangePlanDirectory,
  readChangePlanMetadata,
  reconcileChangePlanDirectory,
  resumeChangePlanDirectory,
  shelveChangePlanDirectory,
  showChangePlanDirectory,
  ChangePlanMetadataError
};
export type {
  ChangePlanAssessment,
  ChangePlanArchiveResult,
  ChangePlanArtifactContents,
  ChangePlanArtifactName,
  ChangePlanCheckResult,
  ChangePlanCollectionCheckResult,
  ChangePlanCollectionOptions,
  ChangePlanCollectionSelection,
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
  ChangePlanMetadata,
  ChangePlanMetadataName,
  ChangePlanShowResult,
  ChangePlanStage,
  ChangePlanStatus,
  ChangePlanTaskProgress,
  ChangePlanTaskSection,
  ChangePlanTaskSectionProgress
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

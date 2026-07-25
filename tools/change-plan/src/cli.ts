#!/usr/bin/env node

import process from "node:process";
import { parseArgs } from "node:util";
import { isMainModule } from "../../shared/src/node/main-module.ts";
import { archiveChangePlanDirectory } from "./archive.ts";
import { listChangePlans, showChangePlanDirectory } from "./catalog.ts";
import { checkChangePlanDirectory } from "./check.ts";
import {
  changePlanArtifactNames,
  type ChangePlanCheckResult,
  type ChangePlanDiagnostic,
  type ChangePlanListStatus
} from "./types.ts";

function helpText(): string {
  return [
    "Usage:",
    "  change-plan.mjs list [change-root] [--archived | --all] [--json]",
    "  change-plan.mjs show <change-directory> [--json]",
    "  change-plan.mjs check <change-directory> [--json]",
    "  change-plan.mjs archive <change-directory> [--json]",
    "",
    "Manage the basic lifecycle of proposal.md, design.md, and tasks.md change plans.",
    "Commands apply mechanical checks only; they do not approve plans or judge semantics.",
    "",
    "Options:",
    "  --archived   List archived changes instead of active changes",
    "  --all        List active and archived changes",
    "  --json       Write the structured result to stdout",
    "  -h, --help   Show this help"
  ].join("\n");
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
    + `${result.completedTaskCount}/${result.taskCount} tasks completed).`
  );
  return 0;
}

async function runListCommand(
  changeRoot: string | undefined,
  status: ChangePlanListStatus,
  json: boolean
): Promise<number> {
  const result = await listChangePlans({ changeRoot, status });
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
  console.log(`Directory: ${result.check.changeDirectory}`);
  console.log(
    `Tasks: ${result.check.completedTaskCount}/${result.check.taskCount}`
  );
  console.log(`Structure: ${result.check.valid ? "valid" : "invalid"}`);
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
        json: { type: "boolean" }
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
  if (command === "list") {
    if (operands.length > 1 || operands[0]?.trim().length === 0) {
      return invalidArguments(
        "Expected: change-plan.mjs list [change-root] [--archived | --all] [--json]"
      );
    }
    if (parsed.values.all === true && parsed.values.archived === true) {
      return invalidArguments("--archived and --all cannot be used together.");
    }
    const status: ChangePlanListStatus = parsed.values.all === true
      ? "all"
      : parsed.values.archived === true
        ? "archived"
        : "active";
    return await runListCommand(operands[0], status, json);
  }

  if (parsed.values.all === true || parsed.values.archived === true) {
    return invalidArguments("--archived and --all are only valid with list.");
  }
  if (operands.length !== 1 || operands[0]?.trim().length === 0) {
    return invalidArguments(
      "Expected: show <change-directory>, check <change-directory>, "
      + "or archive <change-directory>."
    );
  }

  if (command === "show") {
    return await runShowCommand(operands[0], json);
  }
  if (command === "check") {
    return await runCheckCommand(operands[0], json);
  }
  if (command === "archive") {
    return await runArchiveCommand(operands[0], json);
  }
  return invalidArguments(`Unknown change-plan command: ${command ?? "<missing>"}`);
}

export {
  archiveChangePlanDirectory,
  checkChangePlanDirectory,
  listChangePlans,
  showChangePlanDirectory
};
export type {
  ChangePlanArchiveResult,
  ChangePlanArtifactContents,
  ChangePlanArtifactName,
  ChangePlanCheckResult,
  ChangePlanDiagnostic,
  ChangePlanDiagnosticCode,
  ChangePlanListEntry,
  ChangePlanListOptions,
  ChangePlanListResult,
  ChangePlanListStatus,
  ChangePlanShowResult,
  ChangePlanStatus
} from "./types.ts";

if (isMainModule(import.meta.url)) {
  try {
    process.exitCode = await runChangePlanCli();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

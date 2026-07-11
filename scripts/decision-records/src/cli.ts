#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { expectedIndex, validateDecisionRecords } from "./index.ts";
import { scanDecisionRecords } from "./scan.ts";
import {
  decisionStatuses,
  decisionStatusSet,
  type DecisionStatus
} from "./types.ts";

type Command = "check" | "list" | "sync-index";

type CliArgs = {
  all: boolean;
  command: Command;
  decisionsDir: string;
  help: boolean;
  statusText: string | null;
  workspaceRoot: string;
  write: boolean;
};

function usage(): string {
  return [
    "Usage:",
    "  node decision-records.mjs [check] [options]",
    "  node decision-records.mjs list [--all | --status <statuses>] [options]",
    "  node decision-records.mjs sync-index [--write] [options]",
    "",
    "Commands:",
    "  check       Validate directories, files, statuses, links, and the active index.",
    "  list        List active decisions by default. Use --all or --status for history.",
    "  sync-index  Check the generated active section. Use --write to update the index.",
    "",
    "Options:",
    "  --root <path>           Workspace root. Defaults to the current directory.",
    "  --decisions-dir <path>  Decision directory. Defaults to docs/decisions under --root.",
    "  --all                   Include all statuses with list.",
    "  --status <statuses>     Comma-separated statuses for list.",
    "  --write                 Apply sync-index changes to decision-record-index.md.",
    "  -h, --help              Show this help text.",
    "",
    "Exit codes: 0 success, 1 validation or index drift, 2 invalid arguments."
  ].join("\n");
}

function parseArgs(argv: string[]): CliArgs {
  const remaining = [...argv];
  let command: Command = "check";
  let workspaceRoot = process.cwd();
  let decisionsDir = "docs/decisions";
  let statusText: string | null = null;
  let all = false;
  let write = false;
  let help = false;

  if (remaining[0] && !remaining[0].startsWith("-")) {
    const candidate = remaining.shift();
    if (!candidate || !new Set<Command>(["check", "list", "sync-index"]).has(candidate as Command)) {
      throw new Error("Unsupported command: " + candidate);
    }
    command = candidate as Command;
  }

  for (let index = 0; index < remaining.length; index += 1) {
    const arg = remaining[index];

    if (arg === "-h" || arg === "--help") {
      help = true;
      continue;
    }

    if (arg === "--all") {
      all = true;
      continue;
    }

    if (arg === "--write") {
      write = true;
      continue;
    }

    if (arg === "--root" || arg === "--decisions-dir" || arg === "--status") {
      const value = remaining[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(arg + " requires a value");
      }

      if (arg === "--root") {
        workspaceRoot = value;
      } else if (arg === "--decisions-dir") {
        decisionsDir = value;
      } else {
        statusText = value;
      }
      index += 1;
      continue;
    }

    throw new Error("Unsupported argument: " + arg);
  }

  if (command !== "list" && (all || statusText !== null)) {
    throw new Error("--all and --status are only valid with list");
  }

  if (command !== "sync-index" && write) {
    throw new Error("--write is only valid with sync-index");
  }

  if (all && statusText !== null) {
    throw new Error("Use either --all or --status, not both");
  }

  return {
    all,
    command,
    decisionsDir,
    help,
    statusText,
    workspaceRoot,
    write
  };
}

function selectedStatuses(args: CliArgs): Set<DecisionStatus> {
  if (args.all) {
    return new Set(decisionStatuses);
  }

  if (args.statusText === null) {
    return new Set(["active"]);
  }

  const statuses = args.statusText
    .split(",")
    .map((status) => status.trim())
    .filter((status) => status.length > 0);

  if (statuses.length === 0) {
    throw new Error("--status must include at least one status");
  }

  for (const status of statuses) {
    if (!decisionStatusSet.has(status)) {
      throw new Error("Unsupported decision status: " + status);
    }
  }

  return new Set(statuses as DecisionStatus[]);
}

function printErrors(errors: string[]): void {
  console.error("Decision records command failed:");
  for (const error of errors) {
    console.error("- " + error);
  }
}

async function runCheck(args: CliArgs): Promise<number> {
  const result = await validateDecisionRecords({
    decisionsDir: args.decisionsDir,
    workspaceRoot: args.workspaceRoot
  });

  if (result.errors.length > 0) {
    printErrors(result.errors);
    return 1;
  }

  console.log(
    "Decision records check passed ("
    + result.areaCount
    + " areas, "
    + result.decisionCount
    + " decisions, "
    + result.activeCount
    + " active, "
    + result.archivedCount
    + " archived)."
  );
  return 0;
}

async function runList(args: CliArgs): Promise<number> {
  const scan = await scanDecisionRecords({
    decisionsDir: args.decisionsDir,
    workspaceRoot: args.workspaceRoot
  });
  if (scan.errors.length > 0) {
    printErrors(scan.errors);
    return 1;
  }

  const statuses = selectedStatuses(args);
  const records = scan.records
    .filter((record) => record.fileStatus !== undefined && statuses.has(record.fileStatus as DecisionStatus))
    .sort((left, right) => {
      const areaOrder = left.areaId.localeCompare(right.areaId);
      if (areaOrder !== 0) {
        return areaOrder;
      }

      const dateOrder = right.datePrefix.localeCompare(left.datePrefix);
      return dateOrder !== 0 ? dateOrder : left.fileName.localeCompare(right.fileName);
    });

  if (records.length === 0) {
    console.log("No decisions matched the selected statuses.");
    return 0;
  }

  for (const record of records) {
    console.log(
      (record.fileStatus ?? "").padEnd(11)
      + " "
      + record.fullDate
      + " "
      + record.relativePath
      + " - "
      + record.title
    );
  }
  return 0;
}

async function runSyncIndex(args: CliArgs): Promise<number> {
  const scan = await scanDecisionRecords({
    decisionsDir: args.decisionsDir,
    workspaceRoot: args.workspaceRoot
  });
  if (scan.errors.length > 0) {
    printErrors(scan.errors);
    return 1;
  }

  const generated = expectedIndex(scan);
  if (generated.errors.length > 0 || generated.text === null) {
    printErrors(generated.errors);
    return 1;
  }

  const current = scan.index.replace(/\r\n/g, "\n");
  if (current === generated.text) {
    console.log("Active decision index is current.");
    return 0;
  }

  if (!args.write) {
    console.error("Active decision index is out of sync.");
    console.error("Run sync-index --write to update " + scan.indexRelativePath + ".");
    return 1;
  }

  await fs.writeFile(scan.indexPath, generated.text, "utf8");
  console.log("Updated " + scan.indexRelativePath + " with active decisions.");
  return 0;
}

function isMainModule(): boolean {
  const entryPoint = process.argv[1];
  return entryPoint !== undefined
    && pathToFileURL(path.resolve(entryPoint)).href === import.meta.url;
}

async function main(): Promise<void> {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
      console.log(usage());
      process.exit(0);
    }

    let exitCode: number;
    if (args.command === "check") {
      exitCode = await runCheck(args);
    } else if (args.command === "list") {
      exitCode = await runList(args);
    } else {
      exitCode = await runSyncIndex(args);
    }
    process.exit(exitCode);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error("");
    console.error(usage());
    process.exit(2);
  }
}

export { scanDecisionRecords, validateDecisionRecords };
export type { DecisionValidationResult } from "./types.ts";

if (isMainModule()) {
  await main();
}

#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { parseArgs as parseNodeArgs } from "node:util";
import { expectedIndex, validateDecisionRecords } from "./index.ts";
import { scanDecisionRecords } from "./scan.ts";
import {
  compareDecisionRecords,
  type DecisionRecord,
  type DecisionScan
} from "./types.ts";

type Command = "activate" | "archive" | "check" | "list" | "sync-index" | "trace";
type TraceDirection = "both" | "predecessors" | "successors";

const commandSet: ReadonlySet<string> = new Set<Command>([
  "activate",
  "archive",
  "check",
  "list",
  "sync-index",
  "trace"
]);
const traceDirectionSet: ReadonlySet<string> = new Set<TraceDirection>([
  "both",
  "predecessors",
  "successors"
]);

type CliArgs = {
  all: boolean;
  archived: boolean;
  byPath: string | null;
  command: Command;
  decisionsDir: string;
  help: boolean;
  recordPaths: string[];
  traceDepth: number | null;
  traceDirection: TraceDirection;
  workspaceRoot: string;
  write: boolean;
};

function usage(): string {
  return [
    "Usage:",
    "  node decision-records.mjs [check] [options]",
    "  node decision-records.mjs list [--archived | --all] [options]",
    "  node decision-records.mjs trace <decision-path> [--direction <value>] [--depth <n>] [options]",
    "  node decision-records.mjs sync-index [--write] [options]",
    "  node decision-records.mjs activate <decision-path> [options]",
    "  node decision-records.mjs archive <decision-path...> [--by <decision-path>] [options]",
    "",
    "Commands:",
    "  check       Validate path format, Markdown records, relations, and the JSON index.",
    "  list        List current decisions by default. Use --archived or --all for history.",
    "  trace       Trace predecessors, successors, or both, with an optional maximum depth.",
    "  sync-index  Refresh generated title, background, decision, and sorting without changing membership.",
    "  activate    Add an existing decision file to the current index.",
    "  archive     Remove decisions from the current index. With --by, validate and activate their successor.",
    "",
    "Options:",
    "  --root <path>           Workspace root. Defaults to the current directory.",
    "  --decisions-dir <path>  Decision directory. Defaults to docs/decisions under --root.",
    "  --archived              List only logically archived decisions.",
    "  --all                   List current and logically archived decisions.",
    "  --by <decision-path>    Successor that directly relates to every archived decision.",
    "  --direction <value>     Trace predecessors, successors, or both. Defaults to both.",
    "  --depth <n>             Maximum relation hops for trace. Defaults to unlimited.",
    "  --write                 Apply sync-index metadata changes.",
    "  -h, --help              Show this help text.",
    "",
    "Decision paths are relative to the decision directory, for example topic/260713-title.md.",
    "Exit codes: 0 success, 1 validation or index drift, 2 invalid arguments."
  ].join("\n");
}

function parseArgs(argv: string[]): CliArgs {
  const { positionals, values } = parseNodeArgs({
    allowPositionals: true,
    args: argv,
    options: {
      all: { type: "boolean" },
      archived: { type: "boolean" },
      by: { type: "string" },
      depth: { type: "string" },
      "decisions-dir": { type: "string" },
      direction: { type: "string" },
      help: { short: "h", type: "boolean" },
      root: { type: "string" },
      write: { type: "boolean" }
    },
    strict: true
  });

  const candidate = positionals[0] ?? "check";
  if (!commandSet.has(candidate)) {
    throw new Error("Unsupported command: " + candidate);
  }

  const command = candidate as Command;
  const recordPaths = positionals.slice(1);

  const all = values.all ?? false;
  const archived = values.archived ?? false;
  const byPath = values.by ?? null;
  const directionValue = values.direction ?? "both";
  const depthValue = values.depth ?? null;
  const write = values.write ?? false;

  if (command !== "list" && (all || archived)) {
    throw new Error("--all and --archived are only valid with list");
  }
  if (all && archived) {
    throw new Error("Use either --all or --archived, not both");
  }
  if (command !== "sync-index" && write) {
    throw new Error("--write is only valid with sync-index");
  }
  if (command !== "archive" && byPath !== null) {
    throw new Error("--by is only valid with archive");
  }
  if (command !== "trace" && (values.direction !== undefined || depthValue !== null)) {
    throw new Error("--direction and --depth are only valid with trace");
  }
  if (!traceDirectionSet.has(directionValue)) {
    throw new Error(
      "--direction must be predecessors, successors, or both"
    );
  }
  if (depthValue !== null && !/^(0|[1-9]\d*)$/.test(depthValue)) {
    throw new Error("--depth must be a non-negative integer");
  }
  const traceDepth = depthValue === null ? null : Number(depthValue);
  if (traceDepth !== null && !Number.isSafeInteger(traceDepth)) {
    throw new Error("--depth must be a safe non-negative integer");
  }
  if ((command === "activate" || command === "archive" || command === "trace")
    && recordPaths.length === 0) {
    throw new Error(command + " requires a decision path");
  }
  if ((command === "activate" || command === "trace") && recordPaths.length > 1) {
    throw new Error(command + " accepts exactly one decision path");
  }
  if (command !== "activate"
    && command !== "archive"
    && command !== "trace"
    && recordPaths.length > 0) {
    throw new Error(command + " does not accept a decision path");
  }

  return {
    all,
    archived,
    byPath,
    command,
    decisionsDir: values["decisions-dir"] ?? "docs/decisions",
    help: values.help ?? false,
    recordPaths,
    traceDepth,
    traceDirection: directionValue as TraceDirection,
    workspaceRoot: values.root ?? process.cwd(),
    write
  };
}

function normalizeDecisionPath(value: string): string {
  return value.replace(/\\/g, "/").replace(/^\.\//, "");
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
    + result.currentCount
    + " current, "
    + result.archivedCount
    + " archived)."
  );
  return 0;
}

async function runList(args: CliArgs): Promise<number> {
  const result = await validateDecisionRecords({
    decisionsDir: args.decisionsDir,
    workspaceRoot: args.workspaceRoot
  });
  if (result.errors.length > 0) {
    printErrors(result.errors);
    return 1;
  }

  const records = result.scan.records
    .filter((record) => args.all || (args.archived ? record.archived : record.current))
    .sort(compareDecisionRecords);

  if (records.length === 0) {
    console.log("No decisions matched the selected lifecycle.");
    return 0;
  }

  for (const record of records) {
    console.log(
      (record.current ? "current" : "archived").padEnd(8)
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

async function runTrace(args: CliArgs): Promise<number> {
  const result = await validateDecisionRecords({
    decisionsDir: args.decisionsDir,
    workspaceRoot: args.workspaceRoot
  });
  if (result.errors.length > 0) {
    printErrors(result.errors);
    return 1;
  }

  const recordPath = args.recordPaths[0];
  const start = recordPath === undefined ? null : findRecord(result.scan, recordPath);
  if (!start) {
    console.error("Decision does not exist: " + recordPath);
    return 1;
  }

  const edges = result.scan.records.flatMap((record) =>
    record.relations.map((relation) => ({
      source: record.relativePath,
      target: relation.target,
      type: relation.type
    }))
  );
  const predecessorEdgesByPath = new Map<string, typeof edges>();
  const successorEdgesByPath = new Map<string, typeof edges>();
  for (const edge of edges) {
    const predecessorEdges = predecessorEdgesByPath.get(edge.source) ?? [];
    predecessorEdges.push(edge);
    predecessorEdgesByPath.set(edge.source, predecessorEdges);

    const successorEdges = successorEdgesByPath.get(edge.target) ?? [];
    successorEdges.push(edge);
    successorEdgesByPath.set(edge.target, successorEdges);
  }

  const tracedPaths = new Set<string>();
  const pendingPaths = [{ depth: 0, path: start.relativePath }];
  let pendingIndex = 0;
  while (pendingIndex < pendingPaths.length) {
    const pending = pendingPaths[pendingIndex];
    pendingIndex += 1;
    if (pending === undefined || tracedPaths.has(pending.path)) {
      continue;
    }
    tracedPaths.add(pending.path);
    if (args.traceDepth !== null && pending.depth >= args.traceDepth) {
      continue;
    }

    if (args.traceDirection !== "successors") {
      for (const edge of predecessorEdgesByPath.get(pending.path) ?? []) {
        pendingPaths.push({ depth: pending.depth + 1, path: edge.target });
      }
    }
    if (args.traceDirection !== "predecessors") {
      for (const edge of successorEdgesByPath.get(pending.path) ?? []) {
        pendingPaths.push({ depth: pending.depth + 1, path: edge.source });
      }
    }
  }

  console.log("Decisions:");
  for (const record of result.scan.records
    .filter((candidate) => tracedPaths.has(candidate.relativePath))
    .sort(compareDecisionRecords)) {
    console.log(
      "- "
      + (record.current ? "current" : "archived")
      + " "
      + record.relativePath
      + " - "
      + record.title
    );
  }

  const tracedEdges = edges
    .filter((edge) => tracedPaths.has(edge.source) && tracedPaths.has(edge.target))
    .sort((left, right) =>
      left.source.localeCompare(right.source)
      || left.type.localeCompare(right.type)
      || left.target.localeCompare(right.target)
    );
  console.log("Relations:");
  if (tracedEdges.length === 0) {
    console.log("- none");
  } else {
    for (const edge of tracedEdges) {
      console.log("- " + edge.source + " --" + edge.type + "--> " + edge.target);
    }
  }
  return 0;
}

async function runSyncIndex(args: CliArgs): Promise<number> {
  const scan = await scanDecisionRecords({
    decisionsDir: args.decisionsDir,
    workspaceRoot: args.workspaceRoot
  });
  if (scan.index === null) {
    printErrors(scan.errors);
    return 1;
  }
  if (scan.errors.length > 0) {
    printErrors(scan.errors);
    return 1;
  }

  const generated = expectedIndex(scan);
  if (generated.errors.length > 0 || generated.text === null) {
    printErrors(generated.errors);
    return 1;
  }

  const current = scan.indexText.replace(/\r\n/g, "\n");
  if (current === generated.text) {
    console.log("Current decision index is up to date.");
    return 0;
  }

  if (!args.write) {
    console.error("Current decision index is out of sync.");
    console.error("Run sync-index --write to update " + scan.indexRelativePath + ".");
    return 1;
  }

  await fs.writeFile(scan.indexPath, generated.text, "utf8");
  const validation = await validateDecisionRecords({
    decisionsDir: args.decisionsDir,
    workspaceRoot: args.workspaceRoot
  });
  if (validation.errors.length > 0) {
    await fs.writeFile(scan.indexPath, scan.indexText, "utf8");
    printErrors(validation.errors);
    return 1;
  }

  console.log("Updated " + scan.indexRelativePath + " metadata without changing membership.");
  return 0;
}

function findRecord(scan: DecisionScan, value: string) {
  const recordPath = normalizeDecisionPath(value);
  return scan.records.find((record) => record.relativePath === recordPath) ?? null;
}

async function applyMembership(
  args: CliArgs,
  scan: DecisionScan,
  currentPaths: Set<string>,
  successMessage: string
): Promise<number> {
  const generated = expectedIndex(scan, currentPaths);
  if (generated.errors.length > 0 || generated.text === null) {
    printErrors(generated.errors);
    return 1;
  }

  await fs.writeFile(scan.indexPath, generated.text, "utf8");
  const validation = await validateDecisionRecords({
    decisionsDir: args.decisionsDir,
    workspaceRoot: args.workspaceRoot
  });
  if (validation.errors.length > 0) {
    await fs.writeFile(scan.indexPath, scan.indexText, "utf8");
    printErrors(validation.errors);
    return 1;
  }

  console.log(successMessage);
  return 0;
}

async function runActivate(args: CliArgs): Promise<number> {
  const scan = await scanDecisionRecords({
    decisionsDir: args.decisionsDir,
    workspaceRoot: args.workspaceRoot
  });
  const recordPath = args.recordPaths[0];
  if (scan.index === null || recordPath === undefined) {
    printErrors(scan.errors);
    return 1;
  }

  const record = findRecord(scan, recordPath);
  if (!record) {
    console.error("Decision does not exist: " + recordPath);
    return 1;
  }
  if (scan.currentPaths.has(record.relativePath)) {
    console.log("Decision is already current: " + record.relativePath);
    return 0;
  }

  const currentPaths = new Set(scan.currentPaths);
  currentPaths.add(record.relativePath);
  return await applyMembership(
    args,
    scan,
    currentPaths,
    "Activated " + record.relativePath + "."
  );
}

async function runArchive(args: CliArgs): Promise<number> {
  const scan = await scanDecisionRecords({
    decisionsDir: args.decisionsDir,
    workspaceRoot: args.workspaceRoot
  });
  if (scan.index === null || args.recordPaths.length === 0) {
    printErrors(scan.errors);
    return 1;
  }

  const currentPaths = new Set(scan.currentPaths);
  const records: DecisionRecord[] = [];
  const seenRecordPaths = new Set<string>();
  for (const recordPath of args.recordPaths) {
    const record = findRecord(scan, recordPath);
    if (!record) {
      console.error("Decision does not exist: " + recordPath);
      return 1;
    }
    if (!scan.currentPaths.has(record.relativePath)) {
      console.error("Decision is already archived: " + record.relativePath);
      return 1;
    }
    if (seenRecordPaths.has(record.relativePath)) {
      console.error("Decision path is repeated: " + record.relativePath);
      return 1;
    }
    seenRecordPaths.add(record.relativePath);
    records.push(record);
    currentPaths.delete(record.relativePath);
  }
  let successorMessage = "";
  if (args.byPath !== null) {
    const successor = findRecord(scan, args.byPath);
    if (!successor) {
      console.error("Successor decision does not exist: " + args.byPath);
      return 1;
    }
    if (seenRecordPaths.has(successor.relativePath)) {
      console.error("Successor must not also be archived: " + successor.relativePath);
      return 1;
    }
    const directTargets = new Set(successor.relations.map((relation) => relation.target));
    const missingTargets = records
      .map((record) => record.relativePath)
      .filter((recordPath) => !directTargets.has(recordPath));
    if (missingTargets.length > 0) {
      console.error(
        "Successor " + successor.relativePath
        + " must directly relate to every archived decision: "
        + missingTargets.join(", ")
      );
      return 1;
    }
    currentPaths.add(successor.relativePath);
    successorMessage = " and activated " + successor.relativePath;
  }

  return await applyMembership(
    args,
    scan,
    currentPaths,
    "Archived " + records.map((record) => record.relativePath).join(", ") + successorMessage + "."
  );
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
    } else if (args.command === "trace") {
      exitCode = await runTrace(args);
    } else if (args.command === "sync-index") {
      exitCode = await runSyncIndex(args);
    } else if (args.command === "activate") {
      exitCode = await runActivate(args);
    } else {
      exitCode = await runArchive(args);
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

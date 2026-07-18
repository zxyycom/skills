#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { CommanderError } from "commander";
import {
  createCliProgram,
  type CliArgs,
  type Command
} from "./cli-args.ts";
import { expectedIndex, validateDecisionRecords } from "./index.ts";
import { traceDecisionRelations } from "./relation-graph.ts";
import { scanDecisionRecords } from "./scan.ts";
import {
  compareDecisionRecords,
  type DecisionRecord,
  type DecisionScan,
  type DecisionScanOptions,
  type DecisionValidationResult
} from "./types.ts";

type CommandHandler = (args: CliArgs) => Promise<number>;

function decisionScanOptions(args: CliArgs): DecisionScanOptions {
  return {
    decisionsDir: args.decisionsDir,
    workspaceRoot: args.workspaceRoot
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

async function validatedResult(
  args: CliArgs
): Promise<DecisionValidationResult | null> {
  const result = await validateDecisionRecords(decisionScanOptions(args));
  if (result.errors.length > 0) {
    printErrors(result.errors);
    return null;
  }
  return result;
}

async function runCheck(args: CliArgs): Promise<number> {
  const result = await validatedResult(args);
  if (!result) {
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
  const result = await validatedResult(args);
  if (!result) {
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
  const result = await validatedResult(args);
  if (!result) {
    return 1;
  }

  const recordPath = args.recordPaths[0];
  const start = recordPath === undefined ? null : findRecord(result.scan, recordPath);
  if (!start) {
    console.error("Decision does not exist: " + recordPath);
    return 1;
  }

  const trace = traceDecisionRelations(
    result.scan.records,
    start.relativePath,
    {
      direction: args.traceDirection,
      maxDepth: args.traceDepth
    }
  );

  console.log("Decisions:");
  for (const record of result.scan.records
    .filter((candidate) => trace.paths.has(candidate.relativePath))
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

  console.log("Relations:");
  if (trace.edges.length === 0) {
    console.log("- none");
  } else {
    for (const edge of trace.edges) {
      console.log("- " + edge.source + " --" + edge.type + "--> " + edge.target);
    }
  }
  return 0;
}

async function writeValidatedIndex(
  args: CliArgs,
  scan: DecisionScan,
  text: string,
  successMessage: string
): Promise<number> {
  await fs.writeFile(scan.indexPath, text, "utf8");
  const validation = await validateDecisionRecords(decisionScanOptions(args));
  if (validation.errors.length > 0) {
    await fs.writeFile(scan.indexPath, scan.indexText, "utf8");
    printErrors(validation.errors);
    return 1;
  }

  console.log(successMessage);
  return 0;
}

async function runSyncIndex(args: CliArgs): Promise<number> {
  const scan = await scanDecisionRecords(decisionScanOptions(args));
  if (scan.index === null || scan.errors.length > 0) {
    printErrors(scan.errors);
    return 1;
  }

  const generated = expectedIndex(scan);
  if (generated.errors.length > 0 || generated.text === null) {
    printErrors(generated.errors);
    return 1;
  }

  if (scan.indexText.replace(/\r\n/g, "\n") === generated.text) {
    console.log("Current decision index is up to date.");
    return 0;
  }
  if (!args.write) {
    console.error("Current decision index is out of sync.");
    console.error("Run sync-index --write to update " + scan.indexRelativePath + ".");
    return 1;
  }

  return await writeValidatedIndex(
    args,
    scan,
    generated.text,
    "Updated " + scan.indexRelativePath + " metadata without changing membership."
  );
}

function findRecord(scan: DecisionScan, value: string): DecisionRecord | null {
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
  return await writeValidatedIndex(args, scan, generated.text, successMessage);
}

async function runActivate(args: CliArgs): Promise<number> {
  const scan = await scanDecisionRecords(decisionScanOptions(args));
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
  const scan = await scanDecisionRecords(decisionScanOptions(args));
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
      .filter((archivedPath) => !directTargets.has(archivedPath));
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
    "Archived " + records.map((record) => record.relativePath).join(", ")
      + successorMessage + "."
  );
}

const commandHandlers: Record<Command, CommandHandler> = {
  activate: runActivate,
  archive: runArchive,
  check: runCheck,
  list: runList,
  "sync-index": runSyncIndex,
  trace: runTrace
};

function isMainModule(): boolean {
  const entryPoint = process.argv[1];
  return entryPoint !== undefined
    && pathToFileURL(path.resolve(entryPoint)).href === import.meta.url;
}

async function main(): Promise<void> {
  const program = createCliProgram(
    async (args) => await commandHandlers[args.command](args)
  );

  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    if (error instanceof CommanderError) {
      process.exitCode = error.exitCode === 0 ? 0 : 2;
      return;
    }

    throw error;
  }
}

export { scanDecisionRecords, validateDecisionRecords };
export type { DecisionValidationResult } from "./types.ts";

if (isMainModule()) {
  await main();
}

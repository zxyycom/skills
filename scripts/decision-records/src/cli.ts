#!/usr/bin/env node

import fs from "node:fs/promises";
import process from "node:process";
import { CommanderError } from "commander";
import { isMainModule } from "../../lib/main-module.ts";
import {
  createCliProgram,
  type CliArgs,
  type Command
} from "./cli-args.ts";
import { expectedIndex, validateDecisionRecords } from "./index.ts";
import { traceDecisionRelations } from "./relation-graph.ts";
import {
  scanDecisionRecords,
  unindexedDecisionError
} from "./scan.ts";
import {
  compareDecisionRecords,
  type DecisionIndexEntry,
  type DecisionRecord,
  type DecisionScan,
  type DecisionScanOptions,
  type DecisionStatus,
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

function printWarnings(errors: string[]): void {
  console.error("Decision records query completed with warnings:");
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

async function queryResult(
  args: CliArgs
): Promise<DecisionValidationResult | null> {
  const result = await validateDecisionRecords(decisionScanOptions(args));
  if (result.scan.index === null) {
    printErrors(result.errors);
    return null;
  }
  if (result.errors.length > 0) {
    printWarnings(result.errors);
  }
  return result;
}

function invalidRecordSuffix(record: DecisionRecord): string {
  return record.markdownExists && record.bodyValid ? "" : " [invalid]";
}

function indexedRecords(scan: DecisionScan): DecisionRecord[] {
  return scan.records.filter((record) => record.indexed);
}

function currentCreatedAt(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
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
    + result.activeCount
    + " active, "
    + result.archivedCount
    + " archived)."
  );
  return 0;
}

async function runList(args: CliArgs): Promise<number> {
  const result = await queryResult(args);
  if (!result) {
    return 1;
  }

  const records = indexedRecords(result.scan)
    .filter((record) => args.status === "all" || record.status === args.status)
    .filter((record) => args.topic === null || record.areaId === args.topic)
    .sort(compareDecisionRecords);
  if (records.length === 0) {
    console.log(
      "No decisions matched status "
      + args.status
      + (args.topic === null ? "" : " and topic " + args.topic)
      + "."
    );
    return 0;
  }

  for (const record of records) {
    const timestamp = record.createdAt ?? "unknown";
    console.log(
      record.status
      + " "
      + (args.fullTime ? timestamp : timestamp.slice(0, 10))
      + " "
      + record.relativePath
      + invalidRecordSuffix(record)
    );
    console.log("  title: " + record.projection.title);
    console.log("  purpose: " + record.projection.purpose);
    console.log("  background: " + record.projection.background);
    console.log("  decision: " + record.projection.decision);
  }
  return 0;
}

async function runShow(args: CliArgs): Promise<number> {
  const result = await queryResult(args);
  if (!result) {
    return 1;
  }

  const recordPath = args.recordPaths[0];
  const record = recordPath === undefined
    ? null
    : findIndexedRecord(result.scan, recordPath);
  if (!record) {
    console.error("Indexed decision does not exist: " + recordPath);
    return 1;
  }
  if (!record.markdownExists) {
    console.error("Decision body does not exist: " + record.relativePath);
    return 1;
  }

  console.log("path: " + record.relativePath);
  console.log("status: " + record.status);
  console.log("createdAt: " + record.createdAt);
  console.log("");
  console.log((await fs.readFile(record.decisionPath, "utf8")).trimEnd());
  return 0;
}

async function runTrace(args: CliArgs): Promise<number> {
  const result = await queryResult(args);
  if (!result) {
    return 1;
  }

  const recordPath = args.recordPaths[0];
  const start = recordPath === undefined
    ? null
    : findIndexedRecord(result.scan, recordPath);
  if (!start) {
    console.error("Indexed decision does not exist: " + recordPath);
    return 1;
  }

  const records = indexedRecords(result.scan);
  const trace = traceDecisionRelations(
    records,
    start.relativePath,
    {
      direction: args.traceDirection,
      maxDepth: args.traceDepth
    }
  );

  console.log("Decisions:");
  for (const record of records
    .filter((candidate) => trace.paths.has(candidate.relativePath))
    .sort(compareDecisionRecords)) {
    console.log(
      "- "
      + record.status
      + " "
      + record.relativePath
      + " - "
      + record.projection.title
      + invalidRecordSuffix(record)
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
    if (scan.indexExists) {
      await fs.writeFile(scan.indexPath, scan.indexText, "utf8");
    } else {
      await fs.rm(scan.indexPath, { force: true });
    }
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
    console.log("Decision index is up to date.");
    return 0;
  }
  if (!args.write) {
    console.error("Decision index is out of sync.");
    console.error("Run sync-index --write to update " + scan.indexRelativePath + ".");
    return 1;
  }

  return await writeValidatedIndex(
    args,
    scan,
    generated.text,
    "Updated " + scan.indexRelativePath
      + " projections and relations without changing status or createdAt."
  );
}

function findRecord(scan: DecisionScan, value: string): DecisionRecord | null {
  const recordPath = normalizeDecisionPath(value);
  return scan.records.find((record) => record.relativePath === recordPath) ?? null;
}

function findIndexedRecord(scan: DecisionScan, value: string): DecisionRecord | null {
  const record = findRecord(scan, value);
  return record?.indexed ? record : null;
}

async function applyIndexEntries(
  args: CliArgs,
  scan: DecisionScan,
  entries: readonly DecisionIndexEntry[],
  successMessage: string
): Promise<number> {
  const generated = expectedIndex(scan, entries);
  if (generated.errors.length > 0 || generated.text === null) {
    printErrors(generated.errors);
    return 1;
  }
  return await writeValidatedIndex(args, scan, generated.text, successMessage);
}

function canInitializeIndex(scan: DecisionScan): boolean {
  return scan.decisionsDirectoryAvailable
    && !scan.indexExists
    && scan.index === null
    && scan.records.length === 1
    && scan.errors.length === 1
    && scan.errors[0] === scan.indexRelativePath + " is required";
}

function entryFromRecord(
  record: DecisionRecord,
  status: DecisionStatus,
  createdAt: string
): DecisionIndexEntry | null {
  if (!record.document) {
    return null;
  }
  return {
    path: record.relativePath,
    status,
    createdAt,
    title: record.document.title,
    purpose: record.document.purpose,
    background: record.document.background,
    decision: record.document.decision,
    relations: record.document.relations
  };
}

async function runActivate(args: CliArgs): Promise<number> {
  const scan = await scanDecisionRecords(decisionScanOptions(args));
  const recordPath = args.recordPaths[0];
  if (recordPath === undefined) {
    printErrors(scan.errors);
    return 1;
  }

  const record = findRecord(scan, recordPath);
  if (!record) {
    console.error("Decision does not exist: " + recordPath);
    return 1;
  }

  if (record.indexed) {
    if (scan.index === null || scan.errors.length > 0) {
      printErrors(scan.errors);
      return 1;
    }
    if (record.status === "active") {
      console.log("Decision is already active: " + record.relativePath);
      return 0;
    }

    const entries = scan.index.records.map((entry) => (
      entry.path === record.relativePath
        ? { ...entry, status: "active" as const }
        : entry
    ));
    return await applyIndexEntries(
      args,
      scan,
      entries,
      "Activated " + record.relativePath + "."
    );
  }

  const initializesIndex = canInitializeIndex(scan);
  const permittedUnindexedError = unindexedDecisionError(
    scan.indexRelativePath,
    record.relativePath
  );
  const blockingErrors = initializesIndex
    ? []
    : scan.errors.filter((error) => error !== permittedUnindexedError);
  if ((!initializesIndex && scan.index === null)
    || blockingErrors.length > 0
    || !record.bodyValid
    || !record.markdownExists) {
    printErrors(blockingErrors.length > 0 ? blockingErrors : scan.errors);
    return 1;
  }

  const entry = entryFromRecord(record, "active", currentCreatedAt());
  if (!entry) {
    console.error("Decision body is unavailable: " + record.relativePath);
    return 1;
  }
  const entries = [...(scan.index?.records ?? []), entry];
  return await applyIndexEntries(
    args,
    scan,
    entries,
    initializesIndex
      ? "Initialized " + scan.indexRelativePath
        + " and activated " + record.relativePath + "."
      : "Registered and activated " + record.relativePath + "."
  );
}

async function runArchive(args: CliArgs): Promise<number> {
  const scan = await scanDecisionRecords(decisionScanOptions(args));
  if (scan.index === null || scan.errors.length > 0 || args.recordPaths.length === 0) {
    printErrors(scan.errors);
    return 1;
  }

  const archivedPaths = new Set<string>();
  for (const recordPath of args.recordPaths) {
    const record = findIndexedRecord(scan, recordPath);
    if (!record) {
      console.error("Indexed decision does not exist: " + recordPath);
      return 1;
    }
    if (record.status === "archived") {
      console.error("Decision is already archived: " + record.relativePath);
      return 1;
    }
    if (archivedPaths.has(record.relativePath)) {
      console.error("Decision path is repeated: " + record.relativePath);
      return 1;
    }
    archivedPaths.add(record.relativePath);
  }

  const entries = scan.index.records.map((entry) => (
    archivedPaths.has(entry.path)
      ? { ...entry, status: "archived" as const }
      : entry
  ));
  return await applyIndexEntries(
    args,
    scan,
    entries,
    "Archived " + [...archivedPaths].join(", ") + "."
  );
}

const commandHandlers: Record<Command, CommandHandler> = {
  activate: runActivate,
  archive: runArchive,
  check: runCheck,
  list: runList,
  show: runShow,
  "sync-index": runSyncIndex,
  trace: runTrace
};

export async function runDecisionRecordsCli(
  argv: readonly string[] = process.argv.slice(2)
): Promise<number> {
  let exitCode = 0;
  const program = createCliProgram(
    async (args) => await commandHandlers[args.command](args),
    (value) => {
      exitCode = value;
    }
  );

  try {
    await program.parseAsync(["node", "decision-records.mjs", ...argv]);
  } catch (error) {
    if (error instanceof CommanderError) {
      return error.exitCode === 0 ? 0 : 2;
    }

    throw error;
  }
  return exitCode;
}

export { scanDecisionRecords, validateDecisionRecords };
export type {
  DecisionDocument,
  DecisionIndex,
  DecisionIndexEntry,
  DecisionListStatus,
  DecisionProjection,
  DecisionRecord,
  DecisionRelation,
  DecisionRelationType,
  DecisionScan,
  DecisionScanOptions,
  DecisionStatus,
  DecisionValidationResult
} from "./types.ts";

if (isMainModule(import.meta.url)) {
  process.exitCode = await runDecisionRecordsCli();
}

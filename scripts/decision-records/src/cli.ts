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
import { discardDecision } from "./discard-decision.ts";
import { type HeadDecisionPathsResult } from "./head-decision-paths.ts";
import {
  expectedIndex,
  loadDecisionValidationContext,
  validateDecisionRecords,
  validateDecisionScan,
  type DecisionValidationContext,
  type DecisionValidationOptions
} from "./index.ts";
import { traceDecisionRelations } from "./relation-graph.ts";
import { scanDecisionRecords } from "./scan.ts";
import {
  compareDecisionRecords,
  type DecisionIndexEntry,
  type DecisionRecord,
  type DecisionScan,
  type DecisionScanOptions,
  type DecisionStatus
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

async function loadCommandContext(
  args: CliArgs,
  validationOptions: DecisionValidationOptions = {}
): Promise<DecisionValidationContext> {
  return await loadDecisionValidationContext(
    decisionScanOptions(args),
    validationOptions
  );
}

async function validatedResult(
  args: CliArgs
): Promise<DecisionValidationContext | null> {
  const context = await loadCommandContext(args);
  const { result } = context;
  if (result.errors.length > 0) {
    printErrors(result.errors);
    return null;
  }
  return context;
}

async function queryResult(
  args: CliArgs
): Promise<DecisionValidationContext | null> {
  const context = await loadCommandContext(args);
  const { result } = context;
  if (context.headDecisionPaths.errors.length > 0) {
    printErrors(context.headDecisionPaths.errors);
    return null;
  }
  if (result.scan.index === null) {
    printErrors(result.errors);
    return null;
  }
  if (result.errors.length > 0) {
    printWarnings(result.errors);
  }
  return context;
}

function invalidRecordSuffix(record: DecisionRecord): string {
  return record.markdownExists && record.bodyValid ? "" : " [invalid]";
}

function pendingRecordSuffix(
  record: DecisionRecord,
  headPaths: ReadonlySet<string>
): string {
  return record.markdownExists && !headPaths.has(record.relativePath)
    ? " [pending]"
    : "";
}

function recordSuffix(
  record: DecisionRecord,
  headPaths: ReadonlySet<string>
): string {
  return invalidRecordSuffix(record) + pendingRecordSuffix(record, headPaths);
}

function indexedRecords(scan: DecisionScan): DecisionRecord[] {
  return scan.records.filter((record) => record.indexed);
}

function currentCreatedAt(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

async function runCheck(args: CliArgs): Promise<number> {
  const context = await validatedResult(args);
  if (!context) {
    return 1;
  }
  const { result } = context;
  const pendingCount = indexedRecords(result.scan).filter((record) => (
    record.markdownExists
      && !context.headDecisionPaths.paths.has(record.relativePath)
  )).length;

  console.log(
    "Decision records check passed ("
    + result.areaCount
    + " areas, "
    + result.decisionCount
    + " decisions, "
    + result.activeCount
    + " active, "
    + result.archivedCount
    + " archived, "
    + pendingCount
    + " pending)."
  );
  return 0;
}

async function runList(args: CliArgs): Promise<number> {
  const context = await queryResult(args);
  if (!context) {
    return 1;
  }
  const { result } = context;
  const headPaths = context.headDecisionPaths.paths;

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
      + recordSuffix(record, headPaths)
    );
    console.log("  title: " + record.projection.title);
    console.log("  purpose: " + record.projection.purpose);
    console.log("  background: " + record.projection.background);
    console.log("  decision: " + record.projection.decision);
  }
  return 0;
}

async function runShow(args: CliArgs): Promise<number> {
  const context = await queryResult(args);
  if (!context) {
    return 1;
  }
  const { result } = context;

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
  console.log(
    "pending: "
    + (!context.headDecisionPaths.paths.has(record.relativePath) ? "true" : "false")
  );
  console.log("");
  console.log((await fs.readFile(record.decisionPath, "utf8")).trimEnd());
  return 0;
}

async function runTrace(args: CliArgs): Promise<number> {
  const context = await queryResult(args);
  if (!context) {
    return 1;
  }
  const { result } = context;

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
      + recordSuffix(record, context.headDecisionPaths.paths)
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
  headDecisionPaths: HeadDecisionPathsResult,
  text: string,
  successMessage: string
): Promise<number> {
  await fs.writeFile(scan.indexPath, text, "utf8");
  const validationScan = await scanDecisionRecords(decisionScanOptions(args));
  const validation = validateDecisionScan(validationScan, headDecisionPaths);
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
  const context = await loadCommandContext(args, { checkIndexText: false });
  const { headDecisionPaths, result } = context;
  const { scan } = result;
  if (result.errors.length > 0 || scan.index === null) {
    printErrors(result.errors);
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
    headDecisionPaths,
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
  headDecisionPaths: HeadDecisionPathsResult,
  entries: readonly DecisionIndexEntry[],
  successMessage: string
): Promise<number> {
  const generated = expectedIndex(scan, entries);
  if (generated.errors.length > 0 || generated.text === null) {
    printErrors(generated.errors);
    return 1;
  }
  return await writeValidatedIndex(
    args,
    scan,
    headDecisionPaths,
    generated.text,
    successMessage
  );
}

function canInitializeIndex(scan: DecisionScan): boolean {
  return scan.decisionsDirectoryAvailable
    && !scan.indexExists
    && scan.index === null
    && scan.records.length === 1
    && scan.unindexedPaths.size === 0
    && scan.indexMembershipIssues.some(
      (issue) => issue.kind === "missing-index"
    );
}

function canRegisterUnindexedRecord(
  scan: DecisionScan,
  record: DecisionRecord
): boolean {
  return scan.index !== null
    && scan.unindexedPaths.has(record.relativePath)
    && scan.indexMembershipIssues.some((issue) => (
      issue.kind === "unindexed-decision"
        && issue.path === record.relativePath
    ));
}

function permittedActivationScanErrors(
  scan: DecisionScan,
  record: DecisionRecord,
  initializesIndex: boolean
): Set<string> {
  return new Set(
    scan.indexMembershipIssues
      .filter((issue) => initializesIndex
        ? issue.kind === "missing-index"
        : issue.kind === "unindexed-decision"
          && issue.path === record.relativePath)
      .map((issue) => issue.message)
  );
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
  const context = await loadCommandContext(args);
  const { headDecisionPaths, result } = context;
  const { scan } = result;
  if (headDecisionPaths.errors.length > 0) {
    printErrors(headDecisionPaths.errors);
    return 1;
  }
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
    if (scan.index === null || result.errors.length > 0) {
      printErrors(result.errors);
      return 1;
    }
    if (record.status === "active") {
      console.log(
        "Decision is already active: "
        + record.relativePath
        + pendingRecordSuffix(record, headDecisionPaths.paths)
      );
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
      headDecisionPaths,
      entries,
      activationMessage(
        headDecisionPaths.paths,
        record.relativePath,
        "Activated"
      )
    );
  }

  const initializesIndex = canInitializeIndex(scan);
  const canRegisterTarget = initializesIndex
    || canRegisterUnindexedRecord(scan, record);
  const permittedScanErrors = permittedActivationScanErrors(
    scan,
    record,
    initializesIndex
  );
  const activationValidation = validateDecisionScan(
    scan,
    headDecisionPaths,
    {
      checkIndexText: false,
      scanErrorPolicy: "omit"
    }
  );
  const blockingErrors = [
    ...scan.errors.filter((error) => !permittedScanErrors.has(error)),
    ...activationValidation.errors
  ];
  if (!canRegisterTarget
    || blockingErrors.length > 0
    || !record.bodyValid
    || !record.markdownExists) {
    printErrors(
      blockingErrors.length > 0
        ? blockingErrors
        : activationValidation.errors
    );
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
    headDecisionPaths,
    entries,
    activationMessage(
      headDecisionPaths.paths,
      record.relativePath,
      initializesIndex
        ? "Initialized " + scan.indexRelativePath + " and activated"
        : "Registered and activated"
    )
  );
}

function activationMessage(
  headPaths: ReadonlySet<string>,
  relativePath: string,
  prefix: string
): string {
  return prefix
    + " "
    + relativePath
    + (headPaths.has(relativePath) ? "." : " [pending].");
}

async function runArchive(args: CliArgs): Promise<number> {
  const context = await validatedResult(args);
  if (!context) {
    return 1;
  }
  const { headDecisionPaths, result } = context;
  const { scan } = result;
  if (scan.index === null || args.recordPaths.length === 0) {
    console.error("At least one indexed decision path is required.");
    return 1;
  }

  const archivedPaths = new Set<string>();
  for (const recordPath of args.recordPaths) {
    const record = findIndexedRecord(scan, recordPath);
    if (!record) {
      console.error("Indexed decision does not exist: " + recordPath);
      return 1;
    }
    if (!headDecisionPaths.paths.has(record.relativePath)) {
      printErrors([
        "Cannot archive decision file that is not present in Git HEAD: "
          + record.relativePath,
        "Edit the pending decision in place, or discard it if it should not "
          + "become an established decision."
      ]);
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
    headDecisionPaths,
    entries,
    "Archived " + [...archivedPaths].join(", ") + "."
  );
}

async function runDiscard(args: CliArgs): Promise<number> {
  const context = await validatedResult(args);
  if (!context) {
    return 1;
  }
  const { headDecisionPaths, result } = context;
  const { scan } = result;
  if (scan.index === null) {
    printErrors(result.errors);
    return 1;
  }

  const recordPath = args.recordPaths[0];
  const record = recordPath === undefined
    ? null
    : findIndexedRecord(scan, recordPath);
  if (!record || !record.markdownExists) {
    console.error("Indexed decision does not exist: " + recordPath);
    return 1;
  }
  if (headDecisionPaths.paths.has(record.relativePath)) {
    printErrors([
      "Cannot discard decision file already present in Git HEAD: "
        + record.relativePath,
      "Use archive or create a real evolution decision instead."
    ]);
    return 1;
  }

  const entries = scan.index.records.filter((entry) => (
    entry.path !== record.relativePath
  ));
  const generated = expectedIndex(scan, entries);
  if (generated.errors.length > 0 || generated.text === null) {
    printErrors(generated.errors);
    return 1;
  }

  const discardErrors = await discardDecision({
    indexText: generated.text,
    record,
    scan,
    validate: async () => validateDecisionScan(
      await scanDecisionRecords(decisionScanOptions(args)),
      headDecisionPaths
    ).errors
  });
  if (discardErrors.length > 0) {
    printErrors(discardErrors);
    return 1;
  }

  console.log(
    "Discarded pending decision "
    + record.relativePath
    + " and removed its index entry. Restage decision files before committing "
    + "if they were already staged."
  );
  return 0;
}

const commandHandlers: Record<Command, CommandHandler> = {
  activate: runActivate,
  archive: runArchive,
  check: runCheck,
  discard: runDiscard,
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
  DecisionIndexMembershipIssue,
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

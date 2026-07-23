#!/usr/bin/env node

import fs from "node:fs/promises";
import process from "node:process";
import { CommanderError } from "commander";
import {
  queryStateIndex,
  stateIndexQueryMaximumLimit,
  type StateIndexFilter,
  type StateIndexResult
} from "../../index-runtime/src/index.ts";
import { isMainModule } from "../../shared/src/node/main-module.ts";
import {
  createCliProgram,
  type CliArgs,
  type Command
} from "./cli-args.ts";
import {
  parseDecisionMarkdown,
  replaceDecisionMetadata
} from "./decision-metadata.ts";
import {
  applyDecisionChanges,
  type DecisionFileChange
} from "./decision-transaction.ts";
import {
  createDecisionStateIndexDefinition,
  decisionIndexDiagnosticMessages,
  loadCurrentDecisionIndex,
  syncDecisionIndex
} from "./decision-state-index.ts";
import { isNewDecisionIdentityPath } from "./decision-path.ts";
import { loadHeadDecisionPaths } from "./head-decision-paths.ts";
import {
  headPathConsistencyErrors,
  loadDecisionValidationContext,
  selectDecisionIndexSourcePaths,
  validateDecisionRecords,
  validateDecisionScan,
  type DecisionValidationContext,
  type DecisionValidationOptions
} from "./index.ts";
import { traceDecisionRelations } from "./relation-graph.ts";
import { scanDecisionRecords } from "./scan.ts";
import {
  compareDecisionRecords,
  type DecisionAlignment,
  type DecisionIndex,
  type DecisionIndexEntry,
  type DecisionRecord,
  type DecisionScan,
  type DecisionScanOptions
} from "./types.ts";

type CommandHandler = (args: CliArgs) => Promise<number>;

type DecisionQueryContext = {
  headDecisionPaths: Awaited<ReturnType<typeof loadHeadDecisionPaths>>;
  index: DecisionIndex;
  scan: DecisionScan;
};

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

function activationCandidates(scan: DecisionScan): DecisionRecord[] {
  return scan.records
    .filter((record) => record.activationCandidate)
    .sort(compareDecisionRecords);
}

function printActivationCandidateWarnings(scan: DecisionScan): void {
  const candidates = activationCandidates(scan);
  if (candidates.length === 0) {
    return;
  }

  console.error("Decision records command completed with warnings:");
  for (const candidate of candidates) {
    console.error(
      "- Unactivated decision candidate remains: " + candidate.relativePath
    );
  }
  console.error(
    "- Activate or discard every candidate before strict check; "
    + "check will continue to fail while any remain."
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

async function validatedMaintenanceResult(
  args: CliArgs
): Promise<DecisionValidationContext | null> {
  const context = await loadCommandContext(args, {
    scanErrorPolicy: "allow-activation-candidates"
  });
  if (context.result.errors.length > 0) {
    printErrors(context.result.errors);
    return null;
  }
  return context;
}

async function queryResult(
  args: CliArgs
): Promise<DecisionQueryContext | null> {
  const scan = await scanDecisionRecords({
    ...decisionScanOptions(args),
    sourceMode: "index-first"
  });
  if (scan.index === null) {
    printErrors(scan.errors);
    return null;
  }
  const [headDecisionPaths, currentIndex] = await Promise.all([
    loadHeadDecisionPaths(scan.decisionsDirectory),
    loadCurrentDecisionIndex({
      decisionsDirectory: scan.decisionsDirectory
    })
  ]);
  if (headDecisionPaths.errors.length > 0) {
    printErrors(headDecisionPaths.errors);
    return null;
  }
  if (currentIndex.status === "error") {
    printErrors(decisionIndexDiagnosticMessages(
      currentIndex.diagnostics,
      scan.indexRelativePath
    ));
    return null;
  }
  if (!sameDecisionIndexSnapshot(scan.index, currentIndex.value)) {
    printErrors([
      scan.indexRelativePath + " changed while preparing the query; retry"
    ]);
    return null;
  }
  const warnings = [
    ...scan.errors,
    ...headPathConsistencyErrors(scan, headDecisionPaths.paths)
  ];
  if (warnings.length > 0) {
    printWarnings([...new Set(warnings)]);
  }
  return {
    headDecisionPaths,
    index: currentIndex.value,
    scan
  };
}

function sameDecisionIndexSnapshot(
  left: DecisionIndex,
  right: DecisionIndex
): boolean {
  return left.sourceRevision === right.sourceRevision
    && left.entries.length === right.entries.length
    && left.entries.every((entry, index) => entry.id === right.entries[index]?.id);
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

function queryDecisionEntry(
  index: DecisionIndex,
  stateId: string
): StateIndexResult<DecisionIndexEntry | null> {
  const queried = queryStateIndex({
    definition: createDecisionStateIndexDefinition(),
    index,
    query: {
      filters: [{
        key: "id",
        kind: "exact",
        operator: "all",
        values: [stateId]
      }],
      limit: 1
    }
  });
  if (queried.status === "error") {
    return queried;
  }
  return {
    diagnostics: [],
    status: "ok",
    value: queried.value.entries[0] ?? null
  };
}

function queryAllDecisionEntries(
  index: DecisionIndex,
  filters: readonly StateIndexFilter[]
): StateIndexResult<DecisionIndexEntry[]> {
  const entries: DecisionIndexEntry[] = [];
  let offset = 0;
  while (true) {
    const queried = queryStateIndex({
      definition: createDecisionStateIndexDefinition(),
      index,
      query: {
        filters: [...filters],
        limit: stateIndexQueryMaximumLimit,
        offset,
        sort: [{ direction: "asc", key: "id" }]
      }
    });
    if (queried.status === "error") {
      return queried;
    }
    entries.push(...queried.value.entries);
    offset += queried.value.entries.length;
    if (offset >= queried.value.total || queried.value.entries.length === 0) {
      return { diagnostics: [], status: "ok", value: entries };
    }
  }
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
    + result.alignedCount
    + " aligned, "
    + result.unalignedCount
    + " unaligned, "
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
  const headPaths = context.headDecisionPaths.paths;
  const filters: StateIndexFilter[] = [];
  if (args.status !== "all") {
    filters.push({
      key: "status",
      kind: "exact",
      operator: "all",
      values: [args.status]
    });
  }
  if (args.alignment !== "all") {
    filters.push({
      key: "alignment",
      kind: "exact",
      operator: "all",
      values: [args.alignment]
    });
  }
  if (args.topic !== null) {
    filters.push({
      key: "topic",
      kind: "exact",
      operator: "all",
      values: [args.topic]
    });
  }
  const queried = queryAllDecisionEntries(context.index, filters);
  if (queried.status === "error") {
    printErrors(decisionIndexDiagnosticMessages(
      queried.diagnostics,
      context.scan.indexRelativePath
    ));
    return 1;
  }
  const recordsByPath = new Map(
    indexedRecords(context.scan).map((record) => [record.relativePath, record])
  );
  const records = queried.value
    .map((entry) => recordsByPath.get(entry.id))
    .filter((record): record is DecisionRecord => record !== undefined);
  if (records.length === 0) {
    console.log(
      "No decisions matched status "
      + args.status
      + " and alignment "
      + args.alignment
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
      + (record.alignment ?? "null")
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
  const recordPath = args.recordPaths[0];
  const matched = recordPath === undefined
    ? null
    : queryDecisionEntry(context.index, normalizeDecisionPath(recordPath));
  if (matched?.status === "error") {
    printErrors(decisionIndexDiagnosticMessages(
      matched.diagnostics,
      context.scan.indexRelativePath
    ));
    return 1;
  }
  const record = matched?.status === "ok" && matched.value !== null
    ? findIndexedRecord(context.scan, matched.value.id)
    : null;
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
  console.log("alignment: " + record.alignment);
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
  const recordPath = args.recordPaths[0];
  const start = recordPath === undefined
    ? null
    : findIndexedRecord(context.scan, recordPath);
  if (!start) {
    console.error("Indexed decision does not exist: " + recordPath);
    return 1;
  }

  const queried = queryAllDecisionEntries(context.index, []);
  if (queried.status === "error") {
    printErrors(decisionIndexDiagnosticMessages(
      queried.diagnostics,
      context.scan.indexRelativePath
    ));
    return 1;
  }
  const recordsByPath = new Map(
    indexedRecords(context.scan).map((record) => [record.relativePath, record])
  );
  const records = queried.value
    .map((entry) => recordsByPath.get(entry.id))
    .filter((record): record is DecisionRecord => record !== undefined);
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
      + (record.alignment ?? "null")
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

async function runSyncIndex(args: CliArgs): Promise<number> {
  const context = await loadCommandContext(args, { checkIndexText: false });
  const { headDecisionPaths, result } = context;
  const { scan } = result;
  const sourceValidation = await validateDecisionScan(scan, headDecisionPaths, {
    checkIndexText: false,
    scanErrorPolicy: "source-only"
  });
  if (sourceValidation.errors.length > 0) {
    printErrors(sourceValidation.errors);
    return 1;
  }
  if (scan.index !== null) {
    const activationCandidateErrorSet = new Set(scan.activationCandidateErrors);
    const membershipErrors = scan.indexErrors.filter(
      (error) => !activationCandidateErrorSet.has(error)
    );
    if (membershipErrors.length > 0) {
      printErrors(membershipErrors);
      return 1;
    }
  }

  const selection = selectDecisionIndexSourcePaths(scan);
  if (selection.errors.length > 0) {
    printErrors(selection.errors);
    return 1;
  }

  const synchronized = await syncDecisionIndex({
    decisionsDirectory: scan.decisionsDirectory,
    mode: args.write ? "write" : "check",
    relativePaths: selection.relativePaths
  });
  if (synchronized.status === "error") {
    if (!args.write && (
      synchronized.state === "index-invalid"
      || synchronized.state === "index-missing"
      || synchronized.state === "index-stale"
    )) {
      console.error("Decision index is out of sync.");
      console.error("Run sync-index --write to update " + scan.indexRelativePath + ".");
      return 1;
    }
    printErrors(decisionIndexDiagnosticMessages(
      synchronized.diagnostics,
      scan.indexRelativePath
    ));
    return 1;
  }

  console.log(
    synchronized.state === "written"
      ? "Rebuilt " + scan.indexRelativePath + " from decision Markdown files."
      : "Decision index is up to date."
  );
  printActivationCandidateWarnings(scan);
  return 0;
}

function findRecord(scan: DecisionScan, value: string): DecisionRecord | null {
  const recordPath = normalizeDecisionPath(value);
  return scan.records.find((record) => record.relativePath === recordPath) ?? null;
}

function findIndexedRecord(scan: DecisionScan, value: string): DecisionRecord | null {
  const record = findRecord(scan, value);
  return record?.indexed ? record : null;
}

async function applySourceChanges(
  args: CliArgs,
  context: DecisionValidationContext,
  changes: readonly DecisionFileChange[],
  successMessage: string,
  registerPaths: ReadonlySet<string> = new Set<string>()
): Promise<number> {
  const errors = await applyDecisionChanges({
    changes,
    headDecisionPaths: context.headDecisionPaths,
    originalScan: context.result.scan,
    registerPaths,
    scanOptions: decisionScanOptions(args)
  });
  if (errors.length > 0) {
    printErrors(errors);
    return 1;
  }
  console.log(successMessage);
  printActivationCandidateWarnings(
    await scanDecisionRecords(decisionScanOptions(args))
  );
  return 0;
}

async function runActivate(args: CliArgs): Promise<number> {
  const context = await loadCommandContext(args, {
    scanErrorPolicy: "allow-activation-candidates"
  });
  const { headDecisionPaths, result } = context;
  const { scan } = result;
  if (headDecisionPaths.errors.length > 0) {
    printErrors(headDecisionPaths.errors);
    return 1;
  }
  const requestedAlignment: DecisionAlignment | null = args.alignment === "all"
    ? null
    : args.alignment;
  if (requestedAlignment === null) {
    console.error("activate requires --alignment aligned or unaligned.");
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

  if (!record.markdownExists) {
    console.error("Decision body does not exist: " + record.relativePath);
    return 1;
  }

  const currentText = await fs.readFile(record.decisionPath, "utf8");
  const metadataErrors: string[] = [];
  const parsed = parseDecisionMarkdown({
    allowNullCreatedAt: true,
    errors: metadataErrors,
    markdown: currentText,
    relativePath: record.relativePath
  });
  if (!parsed || metadataErrors.length > 0) {
    printErrors(metadataErrors);
    return 1;
  }

  let createdAt: string;
  let prefix: string;
  if (record.indexed) {
    if (scan.index === null || result.errors.length > 0 || !record.document) {
      printErrors(result.errors);
      return 1;
    }
    if (record.status === "active") {
      if (record.alignment !== requestedAlignment) {
        console.error(
          record.alignment === "unaligned"
            ? "Use mark-aligned to change an active decision from unaligned to aligned."
            : "An aligned active decision cannot be changed back to unaligned."
        );
        return 1;
      }
      console.log(
        "Decision is already active and " + requestedAlignment + ": "
        + record.relativePath
        + pendingRecordSuffix(record, headDecisionPaths.paths)
      );
      printActivationCandidateWarnings(scan);
      return 0;
    }
    if (parsed.metadata.createdAt === null) {
      console.error("Indexed decision createdAt must not be null: " + record.relativePath);
      return 1;
    }
    createdAt = parsed.metadata.createdAt;
    prefix = "Activated";
  } else {
    if (headDecisionPaths.paths.has(record.relativePath)) {
      printErrors([
        "Decision file present in Git HEAD cannot be activated as a new "
          + "decision candidate: "
          + record.relativePath,
        "Restore valid established metadata and index membership instead."
      ]);
      return 1;
    }
    if (!isNewDecisionIdentityPath(record.relativePath)) {
      printErrors([
        "New decision identity path must use kebab-case semantic slugs "
          + "without date tokens: "
          + record.relativePath
      ]);
      return 1;
    }
    if (parsed.metadata.status !== "active"
      || parsed.metadata.alignment !== requestedAlignment
      || parsed.metadata.createdAt !== null) {
      printErrors([
        "New decision activation candidate must declare status: active, alignment: "
          + requestedAlignment
          + ", and createdAt: null: "
          + record.relativePath
      ]);
      return 1;
    }
    createdAt = currentCreatedAt();
    prefix = "Activated new decision";
  }

  const nextText = replaceDecisionMetadata(currentText, {
    alignment: requestedAlignment,
    createdAt,
    status: "active"
  });
  if (nextText === null) {
    console.error("Decision frontmatter is unavailable: " + record.relativePath);
    return 1;
  }
  return await applySourceChanges(
    args,
    context,
    [{
      decisionPath: record.decisionPath,
      nextText
    }],
    activationMessage(
      headDecisionPaths.paths,
      record.relativePath,
      prefix + " as " + requestedAlignment
    ),
    record.indexed
      ? new Set<string>()
      : new Set([record.relativePath])
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

async function runMarkAligned(args: CliArgs): Promise<number> {
  const context = await validatedMaintenanceResult(args);
  if (!context) {
    return 1;
  }
  const { headDecisionPaths, result } = context;
  const recordPath = args.recordPaths[0];
  const record = recordPath === undefined
    ? null
    : findIndexedRecord(result.scan, recordPath);
  if (!record || !record.markdownExists || record.createdAt === null) {
    console.error("Indexed decision does not exist: " + recordPath);
    return 1;
  }
  if (record.status !== "active" || record.alignment !== "unaligned") {
    console.error(
      "mark-aligned requires an active unaligned decision: " + record.relativePath
    );
    return 1;
  }

  const currentText = await fs.readFile(record.decisionPath, "utf8");
  const nextText = replaceDecisionMetadata(currentText, {
    alignment: "aligned",
    createdAt: record.createdAt,
    status: "active"
  });
  if (nextText === null) {
    console.error("Decision frontmatter is unavailable: " + record.relativePath);
    return 1;
  }
  return await applySourceChanges(
    args,
    context,
    [{
      decisionPath: record.decisionPath,
      nextText
    }],
    "Marked aligned "
      + record.relativePath
      + pendingRecordSuffix(record, headDecisionPaths.paths)
      + "."
  );
}

async function runArchive(args: CliArgs): Promise<number> {
  const context = await validatedMaintenanceResult(args);
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
  const changes: DecisionFileChange[] = [];
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
    if (record.createdAt === null) {
      console.error("Decision createdAt is unavailable: " + record.relativePath);
      return 1;
    }
    const currentText = await fs.readFile(record.decisionPath, "utf8");
    const nextText = replaceDecisionMetadata(currentText, {
      alignment: null,
      createdAt: record.createdAt,
      status: "archived"
    });
    if (nextText === null) {
      console.error("Decision frontmatter is unavailable: " + record.relativePath);
      return 1;
    }
    changes.push({
      decisionPath: record.decisionPath,
      nextText
    });
  }

  return await applySourceChanges(
    args,
    context,
    changes,
    "Archived " + [...archivedPaths].join(", ") + "."
  );
}

async function runDiscard(args: CliArgs): Promise<number> {
  const context = await loadCommandContext(args, { checkIndexText: false });
  const { headDecisionPaths, result } = context;
  const { scan } = result;
  if (headDecisionPaths.errors.length > 0) {
    printErrors(headDecisionPaths.errors);
    return 1;
  }

  const recordPath = args.recordPaths[0];
  const record = recordPath === undefined
    ? null
    : findRecord(scan, recordPath);
  if (!record || !record.markdownExists) {
    console.error("Decision does not exist: " + recordPath);
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

  const referencingPaths = scan.records
    .filter((candidate) => candidate.relativePath !== record.relativePath)
    .filter((candidate) => (
      candidate.document?.relations ?? candidate.projection.relations
    ).some(
      (relation) => relation.target === record.relativePath
    ))
    .map((candidate) => candidate.relativePath);
  if (referencingPaths.length > 0) {
    printErrors([
      "Cannot discard decision file while it is still referenced: "
        + record.relativePath,
      "Remove references from: " + referencingPaths.join(", ")
    ]);
    return 1;
  }

  return await applySourceChanges(
    args,
    context,
    [{
      decisionPath: record.decisionPath,
      nextText: null
    }],
    "Discarded "
    + (record.activationCandidate
      ? "unactivated decision candidate "
      : record.indexed
        ? "pending decision "
        : "unregistered decision file ")
    + record.relativePath
    + (record.indexed
      ? " and removed its index entry."
      : " before it entered the decision index.")
    + " Restage decision files before committing "
    + "if they were already staged."
  );
}

const commandHandlers: Record<Command, CommandHandler> = {
  activate: runActivate,
  archive: runArchive,
  check: runCheck,
  discard: runDiscard,
  list: runList,
  "mark-aligned": runMarkAligned,
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
  DecisionAlignment,
  DecisionDocument,
  DecisionIndex,
  DecisionIndexEntry,
  DecisionIndexState,
  DecisionListAlignment,
  DecisionListStatus,
  DecisionMetadata,
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

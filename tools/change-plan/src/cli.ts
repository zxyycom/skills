#!/usr/bin/env node

import path from "node:path";
import process from "node:process";
import { parseArgs } from "node:util";
import { isMainModule } from "../../shared/src/node/main-module.ts";
import {
  checkChangePlanCollection,
  listChangePlans,
  showChangePlanDirectory
} from "./catalog.ts";
import { checkChangePlanDirectory } from "./check.ts";
import { planChangePlanDirectory } from "./lifecycle.ts";
import { runComplete } from "./cli-complete.ts";
import {
  formatDiagnostic,
  formatGitDistance,
  helpText,
  printArtifacts,
  printDiagnostics,
  writeLine
} from "./cli-output.ts";
import { completeChangePlanDirectory } from "./complete.ts";
import {
  ChangePlanMetadataError,
  parseChangePlanMetadata,
  readChangePlanMetadata
} from "./metadata.ts";
import {
  type ChangePlanCollectionCheckResult,
  type ChangePlanLifecycleResult,
  type ChangePlanStage
} from "./types.ts";

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

async function runCheck(
  directory: string,
  json: boolean,
  io: ChangePlanCliIo
): Promise<number> {
  const result = await checkChangePlanDirectory(directory);
  if (json) {
    writeLine(io.stdout, JSON.stringify(result, null, 2));
    return result.valid ? 0 : 1;
  }
  if (!result.valid) {
    printDiagnostics("Change plan check failed", result, io);
    return 1;
  }
  writeLine(
    io.stdout,
    `Change plan check passed (${result.changeName}; ${result.completedTaskCount}/${result.taskCount} tasks completed; stage ${result.stage ?? "none"}).`
  );
  if (result.distance !== null)
    writeLine(io.stdout, formatGitDistance(result.distance));
  return 0;
}

async function runCollectionCheck(
  root: string | undefined,
  json: boolean,
  io: ChangePlanCliIo
): Promise<number> {
  const result: ChangePlanCollectionCheckResult =
    await checkChangePlanCollection({
      changeRoot: root
    });
  if (json) {
    writeLine(io.stdout, JSON.stringify(result, null, 2));
    return result.valid ? 0 : 1;
  }
  const summary = `${result.changeRoot}; ${result.validCount}/${result.checkedCount} changes valid`;
  if (result.valid) {
    writeLine(io.stdout, `Change plan collection check passed (${summary}).`);
    return 0;
  }
  writeLine(io.stderr, `Change plan collection check failed (${summary}).`);
  for (const error of result.errors) writeLine(io.stderr, `- ${error}`);
  for (const entry of result.entries) {
    if (!entry.valid) printDiagnostics("Change plan check failed", entry, io);
  }
  return 1;
}

async function runList(
  root: string | undefined,
  stage: ChangePlanStage | undefined,
  json: boolean,
  io: ChangePlanCliIo
): Promise<number> {
  const result = await listChangePlans({ changeRoot: root, stage });
  if (json) {
    writeLine(io.stdout, JSON.stringify(result, null, 2));
    return result.errors.length === 0 ? 0 : 1;
  }
  if (result.errors.length > 0) {
    writeLine(io.stderr, "Change plan list failed:");
    for (const error of result.errors) writeLine(io.stderr, `- ${error}`);
    return 1;
  }
  writeLine(io.stdout, `Changes (${result.changeRoot}):`);
  if (result.entries.length === 0) writeLine(io.stdout, "- none");
  for (const entry of result.entries) {
    writeLine(
      io.stdout,
      `- ${entry.changeName} stage=${entry.stage ?? "none"} ${entry.completedTaskCount}/${entry.taskCount} ${entry.valid ? "valid" : "invalid"} ${entry.changeDirectory}`
    );
  }
  return 0;
}

async function runShow(
  directory: string,
  json: boolean,
  io: ChangePlanCliIo
): Promise<number> {
  const result = await showChangePlanDirectory(directory);
  if (json) {
    writeLine(io.stdout, JSON.stringify(result, null, 2));
    return result.check.valid ? 0 : 1;
  }
  writeLine(io.stdout, `Change: ${result.check.changeName}`);
  writeLine(io.stdout, `Stage: ${result.check.stage ?? "none"}`);
  writeLine(io.stdout, `Directory: ${result.check.changeDirectory}`);
  writeLine(io.stdout, `Check: ${result.check.valid ? "valid" : "invalid"}`);
  printArtifacts(result.artifacts, io);
  if (!result.check.valid)
    printDiagnostics(
      "Change plan show completed with diagnostics",
      result.check,
      io
    );
  return result.check.valid ? 0 : 1;
}

async function runPlan(
  directory: string,
  json: boolean,
  io: ChangePlanCliIo
): Promise<number> {
  const result: ChangePlanLifecycleResult =
    await planChangePlanDirectory(directory);
  if (json) {
    writeLine(io.stdout, JSON.stringify(result, null, 2));
    return result.success ? 0 : 1;
  }
  if (!result.success) {
    writeLine(
      io.stderr,
      `Change plan plan failed [${result.errorCode}]: ${result.error}`
    );
    for (const diagnostic of result.diagnostics)
      writeLine(io.stderr, formatDiagnostic(diagnostic));
    return 1;
  }
  writeLine(
    io.stdout,
    `Change plan ${path.basename(path.resolve(directory))}: ${result.fromStage} -> ${result.metadata.stage} (plan).`
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
        help: { short: "h", type: "boolean" },
        json: { type: "boolean" },
        preflight: { type: "boolean" },
        stage: { type: "string" }
      },
      strict: true
    });
  } catch (error) {
    return invalidArguments(
      error instanceof Error ? error.message : String(error),
      io
    );
  }
  if (parsed.values.help === true) {
    writeLine(io.stdout, helpText());
    return 0;
  }
  const [command, ...operands] = parsed.positionals;
  const json = parsed.values.json === true;
  const preflight = parsed.values.preflight === true;
  const stageValue = parsed.values.stage;
  const stageArgument = typeof stageValue === "string" ? stageValue : undefined;
  const stage = parseStage(stageArgument);
  if (stageValue !== undefined && stage === undefined)
    return invalidArguments("--stage must be draft or plan.", io);
  if (command === "list") {
    if (operands.length > 1 || operands[0]?.trim().length === 0 || preflight)
      return invalidArguments(
        "Expected: change-plan.mjs list [change-root] [--stage <stage>] [--json]",
        io
      );
    return await runList(
      operands[0] === undefined
        ? path.join(cwd, "changes")
        : path.resolve(cwd, operands[0]),
      stage,
      json,
      io
    );
  }
  if (command === "check-all") {
    if (
      operands.length > 1 ||
      operands[0]?.trim().length === 0 ||
      stageValue !== undefined ||
      preflight
    )
      return invalidArguments(
        "Expected: change-plan.mjs check-all [change-root] [--json]",
        io
      );
    return await runCollectionCheck(
      operands[0] === undefined
        ? path.join(cwd, "changes")
        : path.resolve(cwd, operands[0]),
      json,
      io
    );
  }
  if (stageValue !== undefined)
    return invalidArguments("--stage is only valid with list.", io);
  const directory = operands[0];
  if (
    operands.length !== 1 ||
    directory === undefined ||
    directory.trim().length === 0
  )
    return invalidArguments("Expected: one <change-directory> operand.", io);
  const resolvedDirectory = path.resolve(cwd, directory);
  if (command === "show")
    return preflight
      ? invalidArguments("--preflight is only valid with complete.", io)
      : await runShow(resolvedDirectory, json, io);
  if (command === "check")
    return preflight
      ? invalidArguments("--preflight is only valid with complete.", io)
      : await runCheck(resolvedDirectory, json, io);
  if (command === "plan")
    return preflight
      ? invalidArguments("--preflight is only valid with complete.", io)
      : await runPlan(resolvedDirectory, json, io);
  if (command === "complete")
    return await runComplete(resolvedDirectory, preflight, json, io);
  return invalidArguments(
    `Unknown change-plan command: ${command ?? "<missing>"}`,
    io
  );
}

export {
  completeChangePlanDirectory,
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
  ChangePlanArtifactContents,
  ChangePlanArtifactName,
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
  ChangePlanMetadata,
  ChangePlanMetadataName,
  ChangePlanShowResult,
  ChangePlanStage,
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

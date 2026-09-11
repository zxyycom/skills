#!/usr/bin/env node

import path from "node:path";
import process from "node:process";
import { isMainModule } from "../../shared/src/node/main-module.ts";
import { parseGlobalArguments } from "./cli-arguments.ts";
import type {
  TaskGraphCliInternalOptions,
  TaskGraphCliOptions
} from "./cli-contract.ts";
import {
  executeInvocation,
  failure,
  outputFailure,
  resolveInvocation,
  writeJsonResult,
  writeOutput
} from "./cli-output.ts";
import { TaskGraphError } from "./errors.ts";
import { loadNativeLockBinding } from "./runtime.ts";
import { TaskGraphService } from "./service.ts";
import { defaultTaskGraphIndexPath } from "./types.ts";

/** @internal */
export type { TaskGraphCliInternalOptions } from "./cli-contract.ts";
export type { TaskGraphCliOptions } from "./cli-contract.ts";

/** @internal */
export function runTaskGraphCli(
  argv: readonly string[],
  options: TaskGraphCliInternalOptions
): Promise<number>;
export function runTaskGraphCli(
  argv?: readonly string[],
  options?: TaskGraphCliOptions
): Promise<number>;
export async function runTaskGraphCli(
  argv: readonly string[] = process.argv.slice(2),
  options: TaskGraphCliInternalOptions = {}
): Promise<number> {
  const io = options.io ?? {
    stdout: (text: string) => process.stdout.write(text)
  };
  let globals;
  try {
    globals = parseGlobalArguments(argv);
  } catch (error) {
    if (!(error instanceof TaskGraphError)) throw error;
    writeJsonResult(
      io,
      failure(
        path.resolve(process.cwd(), defaultTaskGraphIndexPath),
        null,
        error
      )
    );
    return 1;
  }
  let service: TaskGraphService;
  try {
    service = new TaskGraphService({
      ...options.serviceOptions,
      root: globals.root,
      indexPath: globals.indexPath,
      loadNativeLock:
        options.serviceOptions?.loadNativeLock ??
        (() => loadNativeLockBinding(options.runtimeOptions))
    });
  } catch (error) {
    if (!(error instanceof TaskGraphError)) throw error;
    const fallbackPath = path.resolve(
      globals.root,
      globals.indexPath ?? defaultTaskGraphIndexPath
    );
    writeJsonResult(io, failure(fallbackPath, null, error));
    return 1;
  }
  const invocation = resolveInvocation(globals, options.columns);
  try {
    const output = await executeInvocation(
      service,
      invocation,
      options.runtimeOptions ?? {}
    );
    writeOutput(io, output);
    return 0;
  } catch (error) {
    if (!(error instanceof TaskGraphError)) throw error;
    const runtimeInvocation =
      globals.remaining[0] === "runtime" ||
      (globals.remaining[0] === "help" && globals.remaining[1] === "runtime");
    let revision: number | null = null;
    if (!runtimeInvocation && !error.code.startsWith("RUNTIME_")) {
      try {
        revision = (await service.info()).revision;
      } catch {
        // The error envelope still remains valid without a readable index.
      }
    }
    writeOutput(
      io,
      outputFailure(
        invocation,
        failure(service.store.indexPath, revision, error)
      )
    );
    return 1;
  }
}

if (isMainModule(import.meta.url)) {
  try {
    process.exitCode = await runTaskGraphCli();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
  }
}

export * from "./index.ts";

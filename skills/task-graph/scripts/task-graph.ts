#!/usr/bin/env node
/*
 * Synced TypeScript runtime; repository maintenance edits tools/task-graph/src/cli.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/task-graph/src/cli.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/task-graph/src/cli.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/task-graph
 * Rebuild: bun run sync:task-graph-cli
 */
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
let runtime: typeof import("./runtime/tools/task-graph/src/cli.ts");
try {
  runtime = await import("./runtime/tools/task-graph/src/cli.ts");
} catch (error) {
  const skillDirectory = fileURLToPath(new URL("../", import.meta.url));
  const diagnostic = error instanceof Error ? error.message : String(error);
  throw new Error(diagnostic + '\nRestore compatible dependencies explicitly:\n  pnpm --dir ' + JSON.stringify(skillDirectory) + ' install --ignore-workspace --prod --frozen-lockfile --config.node-linker=isolated\nIf package files or manifest/lockfile are damaged, re-obtain this skill. No installation was attempted.', { cause: error });
}
import type * as Public from "./task-graph.d.mts";
export type * from "./task-graph.d.mts";
// Bind the same runtime references to the existing public declaration contract.
// Emitted nominal brands/private fields and existing readonly projections do not create new runtime identities.
const publicRuntime = runtime as unknown as typeof Public;
export const applyTaskGraphOperations: typeof Public.applyTaskGraphOperations = publicRuntime.applyTaskGraphOperations;
export const cancelTask: typeof Public.cancelTask = publicRuntime.cancelTask;
export const claimTask: typeof Public.claimTask = publicRuntime.claimTask;
export const completeTask: typeof Public.completeTask = publicRuntime.completeTask;
export const defaultTaskGraphIndexPath: typeof Public.defaultTaskGraphIndexPath = publicRuntime.defaultTaskGraphIndexPath;
export const emptyTaskIndex: typeof Public.emptyTaskIndex = publicRuntime.emptyTaskIndex;
export const failTask: typeof Public.failTask = publicRuntime.failTask;
export const parseTaskGraphApplyRequest: typeof Public.parseTaskGraphApplyRequest = publicRuntime.parseTaskGraphApplyRequest;
export const parseTaskIndex: typeof Public.parseTaskIndex = publicRuntime.parseTaskIndex;
export const projectTaskGraph: typeof Public.projectTaskGraph = publicRuntime.projectTaskGraph;
export const releaseTask: typeof Public.releaseTask = publicRuntime.releaseTask;
export const removeTasks: typeof Public.removeTasks = publicRuntime.removeTasks;
export const renewTaskLease: typeof Public.renewTaskLease = publicRuntime.renewTaskLease;
export const retryTask: typeof Public.retryTask = publicRuntime.retryTask;
export const runTaskGraphCli: typeof Public.runTaskGraphCli = publicRuntime.runTaskGraphCli;
export const serializeTaskIndex: typeof Public.serializeTaskIndex = publicRuntime.serializeTaskIndex;
export const taskControlModes: typeof Public.taskControlModes = publicRuntime.taskControlModes;
export const taskEffectiveStates: typeof Public.taskEffectiveStates = publicRuntime.taskEffectiveStates;
export const taskExecutionPhases: typeof Public.taskExecutionPhases = publicRuntime.taskExecutionPhases;
export type TaskGraphError = Public.TaskGraphError;
export const TaskGraphError: typeof Public.TaskGraphError = publicRuntime.TaskGraphError;
export const taskGraphRuntimeProtocolVersion: typeof Public.taskGraphRuntimeProtocolVersion = publicRuntime.taskGraphRuntimeProtocolVersion;
export const taskGraphSchemaVersion: typeof Public.taskGraphSchemaVersion = publicRuntime.taskGraphSchemaVersion;
export type TaskGraphService = Public.TaskGraphService;
export const TaskGraphService: typeof Public.TaskGraphService = publicRuntime.TaskGraphService;
export const taskGraphSupportedNodeRange: typeof Public.taskGraphSupportedNodeRange = publicRuntime.taskGraphSupportedNodeRange;
export const taskGraphVersion: typeof Public.taskGraphVersion = publicRuntime.taskGraphVersion;
export const validateTaskIndexGraph: typeof Public.validateTaskIndexGraph = publicRuntime.validateTaskIndexGraph;
if (process.argv[1] !== undefined && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try {
    process.exitCode = await runtime.runTaskGraphCli();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

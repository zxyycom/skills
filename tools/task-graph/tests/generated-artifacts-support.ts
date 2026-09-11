import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

export const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  ".."
);
export const generatedScriptPath = path.join(
  repositoryRoot,
  "skills",
  "task-graph",
  "scripts",
  "task-graph.mjs"
);
export const generatedDeclarationPath = path.join(
  repositoryRoot,
  "skills",
  "task-graph",
  "scripts",
  "task-graph.d.mts"
);
export const generatedDeclarationDirectory = path.join(
  repositoryRoot,
  "skills",
  "task-graph",
  "scripts",
  "task-graph-sdk"
);
export const generatedSchemaPath = path.join(
  repositoryRoot,
  "skills",
  "task-graph",
  "references",
  "task-graph-index.schema.json"
);
export const execFileAsync = promisify(execFile);

export const publicRuntimeExports = [
  "TaskGraphError",
  "TaskGraphService",
  "applyTaskGraphOperations",
  "cancelTask",
  "claimTask",
  "completeTask",
  "defaultTaskGraphIndexPath",
  "emptyTaskIndex",
  "failTask",
  "parseTaskGraphApplyRequest",
  "parseTaskIndex",
  "projectTaskGraph",
  "releaseTask",
  "removeTasks",
  "renewTaskLease",
  "retryTask",
  "runTaskGraphCli",
  "serializeTaskIndex",
  "taskControlModes",
  "taskEffectiveStates",
  "taskExecutionPhases",
  "taskGraphRuntimeProtocolVersion",
  "taskGraphSchemaVersion",
  "taskGraphSupportedNodeRange",
  "taskGraphVersion",
  "validateTaskIndexGraph"
] as const;

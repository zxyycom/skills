import type { RuntimeContextOptions } from "./runtime.ts";
import type {
  TaskGraphResult,
  TaskIndexStageResult,
  TaskListItem
} from "./types.ts";

export type CliIo = {
  stdout: (text: string) => void;
};

export type GlobalArguments = {
  help: boolean;
  indexPath?: string;
  json: boolean;
  remaining: string[];
  root: string;
  version: boolean;
};

export type CliInvocation =
  | { kind: "help"; pathTokens: readonly string[] }
  | { kind: "index-stage"; tokens: readonly string[] }
  | { kind: "json-command"; tokens: readonly string[] }
  | { columns: number; kind: "task-list"; tokens: readonly string[] }
  | { kind: "version" };

type TaskListResult = TaskGraphResult<Record<string, TaskListItem>>;
type TaskIndexStageCliResult = TaskGraphResult<TaskIndexStageResult>;

export type CliOutput =
  | { kind: "json"; result: TaskGraphResult }
  | { kind: "index-stage"; result: TaskIndexStageCliResult }
  | { columns: number; kind: "task-list"; result: TaskListResult };

export type OptionDefinition = {
  kind: "boolean" | "string";
  multiple?: boolean;
};

export type ParsedCommandOptions = {
  positionals: string[];
  values: Record<string, string | string[] | true>;
};

export type DispatchResult =
  | { revision: number; data: unknown }
  | { revision: number | null; data: unknown };

export type CommandHelp = {
  input?: { default: "stdin"; fileOption: "--file"; format: "json" };
  options: readonly HelpParameter[];
  positionals: readonly HelpParameter[];
  requiresMutationRuntime?: true;
  usage: string;
};

export type HelpParameter = {
  default?: boolean | string | number | null;
  enum?: readonly string[];
  multiple?: boolean;
  name: string;
  required: boolean;
  type: "boolean" | "integer" | "key-value" | "string";
};

export type TaskGraphCliOptions = {
  io?: CliIo;
  serviceOptions?: Omit<
    import("./service.ts").TaskGraphServiceOptions,
    "root" | "indexPath"
  >;
};

/** @internal */
export type TaskGraphCliInternalOptions = {
  columns?: number;
  io?: CliIo;
  runtimeOptions?: RuntimeContextOptions;
  serviceOptions?: Omit<
    import("./service.ts").TaskGraphServiceInternalOptions,
    "root" | "indexPath"
  >;
};

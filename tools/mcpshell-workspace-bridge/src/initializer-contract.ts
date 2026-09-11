import type { BridgeConfig, FailureKind } from "./shared.ts";

export type InitializerCommand = "apply" | "preview" | "remove";
export type InitializerPaths = Readonly<{
  agentProjectDirectory: string;
  skillDirectory: string;
}>;
export type InitializerRequest = Readonly<{
  command: InitializerCommand;
  config?: BridgeConfig;
  identity: string;
  removeEnv?: boolean;
}>;
export type InitializerAction = Readonly<{
  action: "create" | "unchanged" | "update";
  resource: string;
}>;
export type InitializerResult = Readonly<{
  actions?: readonly InitializerAction[];
  command: InitializerCommand;
  error?: string;
  failure_kind: FailureKind | "config_conflict" | null;
  files: readonly string[];
  identity: string;
  ok: boolean;
  wrote: boolean;
}>;
export type PlannedWrite = Readonly<{
  action: InitializerAction["action"];
  content: string;
  filePath: string;
  resource: string;
}>;
export type InitializationPlan = Readonly<{
  actions: readonly InitializerAction[];
  environment: PlannedWrite;
  registration: PlannedWrite;
}>;

/*
 * Synced TypeScript runtime; repository maintenance edits tools/mcpshell-workspace-bridge/src/initializer/initializer-contract.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/mcpshell-workspace-bridge/src/initializer/initializer-contract.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/mcpshell-workspace-bridge/src/initializer/initializer-contract.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/mcpshell-workspace-tools
 * Rebuild: bun run sync:mcpshell-workspace-bridge
 */
import type { BridgeConfig, FailureKind } from "../shared.ts";

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

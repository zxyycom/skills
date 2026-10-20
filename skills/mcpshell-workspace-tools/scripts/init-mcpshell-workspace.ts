#!/usr/bin/env node
/*
 * Synced TypeScript runtime; repository maintenance edits tools/mcpshell-workspace-bridge/src/initializer.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/mcpshell-workspace-bridge/src/initializer.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/mcpshell-workspace-bridge/src/initializer.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/mcpshell-workspace-tools
 * Rebuild: bun run sync:mcpshell-workspace-bridge
 */
import path from "node:path";
import { pathToFileURL } from "node:url";
import { runInitializerCli } from "./runtime/tools/mcpshell-workspace-bridge/src/initializer.ts";
export { runInitializer, readCliRequest } from "./runtime/tools/mcpshell-workspace-bridge/src/initializer.ts";
export type { InitializerAction, InitializerCommand, InitializerPaths, InitializerRequest, InitializerResult } from "./runtime/tools/mcpshell-workspace-bridge/src/initializer.ts";
if (process.argv[1] !== undefined && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  await runInitializerCli(import.meta.url);
}

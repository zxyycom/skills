import fs from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import {
  BridgeError,
  agentProjectDirectoryFromSkillDirectory,
  isMainModule,
  skillDirectoryFromScriptUrl,
  validateBridgeConfig,
  type BridgeConfig,
  type FailureKind
} from "./shared.ts";

const generatedToolsPath =
  "skills/mcpshell-workspace-tools/references/mcpshell-tools.yaml";
const agentConfigResource = ".codex/config.toml";
const environmentResource = "skills/mcpshell-workspace-tools/.env.mcpshell";

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

export type InitializerResult = Readonly<{
  command: InitializerCommand;
  error?: string;
  failure_kind: FailureKind | "config_conflict" | null;
  files: readonly string[];
  identity: string;
  ok: boolean;
  wrote: boolean;
}>;

function validateIdentity(identity: string): string {
  if (!/^[A-Za-z0-9_-]+$/u.test(identity)) {
    throw new BridgeError(
      "invalid_input",
      "identity must contain only letters, digits, underscores, and hyphens"
    );
  }
  return identity;
}

function managedMarker(identity: string): string {
  return `# Managed by mcpshell-workspace-bridge: ${identity}`;
}

function tableHeader(identity: string): string {
  return `[mcp_servers.${identity}]`;
}

function renderedTable(identity: string): string {
  return `${managedMarker(identity)}\n${tableHeader(identity)}\ncommand = "mcpshell"\nargs = ["mcp", "--tools", "${generatedToolsPath}"]\n`;
}

function findTableRange(
  source: string,
  identity: string
): Readonly<{ end: number; start: number }> | null {
  const header = tableHeader(identity);
  const match = new RegExp(
    `^[\t ]*${header.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}[\t ]*(?:#.*)?$`,
    "mu"
  ).exec(source);
  if (match === null || match.index === undefined) {
    return null;
  }
  const following = /\n[\t ]*\[/gu;
  following.lastIndex = match.index + match[0].length;
  const next = following.exec(source);
  return {
    start: match.index,
    end:
      next === null || next.index === undefined ? source.length : next.index + 1
  };
}

function managedRange(
  source: string,
  identity: string
): Readonly<{ end: number; start: number }> | null {
  const start = source.indexOf(
    `${managedMarker(identity)}\n${tableHeader(identity)}\n`
  );
  if (start === -1) {
    return null;
  }
  const tableStart =
    start + `${managedMarker(identity)}\n${tableHeader(identity)}\n`.length;
  const following = /\n[\t ]*\[/gu;
  following.lastIndex = tableStart;
  const next = following.exec(source);
  return {
    start,
    end:
      next === null || next.index === undefined ? source.length : next.index + 1
  };
}

function mergeTable(
  source: string,
  identity: string
): Readonly<{ changed: boolean; source: string }> {
  const owned = managedRange(source, identity);
  const table = findTableRange(source, identity);
  if (table !== null && owned === null) {
    throw new BridgeError(
      "config_invalid",
      `config_conflict: ${tableHeader(identity)} is not owned by this bridge`
    );
  }
  const rendered = renderedTable(identity);
  if (owned !== null) {
    const next = `${source.slice(0, owned.start)}${rendered}${source.slice(owned.end)}`;
    return { changed: next !== source, source: next };
  }
  const separator = source.length === 0 || source.endsWith("\n") ? "" : "\n";
  return {
    changed: true,
    source: `${source}${separator}${source.length === 0 ? "" : "\n"}${rendered}`
  };
}

function removeTable(
  source: string,
  identity: string
): Readonly<{ changed: boolean; source: string }> {
  const owned = managedRange(source, identity);
  const table = findTableRange(source, identity);
  if (table !== null && owned === null) {
    throw new BridgeError(
      "config_invalid",
      `config_conflict: ${tableHeader(identity)} is not owned by this bridge`
    );
  }
  if (owned === null) {
    return { changed: false, source };
  }
  const prefix = source.slice(0, owned.start);
  const suffix = source.slice(owned.end);
  return {
    changed: true,
    source: prefix + suffix
  };
}

async function readTextIfPresent(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return "";
    }
    throw error;
  }
}

async function assertEnvironmentIgnore(skillDirectory: string): Promise<void> {
  const ignorePath = path.join(skillDirectory, ".gitignore");
  const source = await readTextIfPresent(ignorePath);
  const matches = source
    .split(/\r?\n/u)
    .filter((line) => line === "/.env.mcpshell");
  if (matches.length !== 1) {
    throw new BridgeError(
      "config_invalid",
      "skill .gitignore must contain exactly one /.env.mcpshell rule"
    );
  }
}

function renderEnvironment(config: BridgeConfig): string {
  return [
    `MCPSHELL_BACKEND_HANDLE=${config.backendHandle}`,
    `MCPSHELL_PROJECT_ROOT=${config.projectRoot}`,
    `MCPSHELL_STAGING_ROOT=${config.stagingRoot}`,
    ""
  ].join("\n");
}

async function atomicWrite(filePath: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temporary = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.mcpshell-${process.pid}-${Date.now()}`
  );
  await fs.writeFile(temporary, content, "utf8");
  await fs.rename(temporary, filePath);
}

function failureResult(
  command: InitializerCommand,
  identity: string,
  error: unknown
): InitializerResult {
  const message = error instanceof Error ? error.message : String(error);
  const conflict = message.startsWith("config_conflict:");
  return {
    command,
    error: message,
    failure_kind: conflict
      ? "config_conflict"
      : error instanceof BridgeError
        ? error.failureKind
        : "config_invalid",
    files: [],
    identity,
    ok: false,
    wrote: false
  };
}

export async function runInitializer(
  request: InitializerRequest,
  paths: InitializerPaths
): Promise<InitializerResult> {
  try {
    const identity = validateIdentity(request.identity);
    const configPath = path.join(
      paths.agentProjectDirectory,
      ".codex",
      "config.toml"
    );
    const envPath = path.join(paths.skillDirectory, ".env.mcpshell");
    const toolsPath = path.join(
      paths.skillDirectory,
      "references",
      "mcpshell-tools.yaml"
    );
    const configSource = await readTextIfPresent(configPath);
    if (request.command === "remove") {
      const merged = removeTable(configSource, identity);
      if (request.removeEnv) {
        await fs.rm(envPath, { force: true });
      }
      if (merged.changed) {
        await atomicWrite(configPath, merged.source);
      }
      return {
        command: request.command,
        failure_kind: null,
        files: request.removeEnv
          ? [agentConfigResource, environmentResource]
          : [agentConfigResource],
        identity,
        ok: true,
        wrote: merged.changed || request.removeEnv === true
      };
    }

    if (request.config === undefined) {
      throw new BridgeError(
        "invalid_input",
        "backend, project root, and staging root are required"
      );
    }
    const config = validateBridgeConfig(request.config);
    await assertEnvironmentIgnore(paths.skillDirectory);
    try {
      await fs.access(toolsPath);
    } catch {
      throw new BridgeError(
        "config_invalid",
        "MCPShell tool definitions are unavailable"
      );
    }
    const merged = mergeTable(configSource, identity);
    if (request.command === "preview") {
      return {
        command: request.command,
        failure_kind: null,
        files: [agentConfigResource, environmentResource, generatedToolsPath],
        identity,
        ok: true,
        wrote: false
      };
    }
    await atomicWrite(envPath, renderEnvironment(config));
    if (merged.changed) {
      await atomicWrite(configPath, merged.source);
    }
    return {
      command: request.command,
      failure_kind: null,
      files: [agentConfigResource, environmentResource, generatedToolsPath],
      identity,
      ok: true,
      wrote: true
    };
  } catch (error) {
    return failureResult(request.command, request.identity, error);
  }
}

function readCliRequest(): InitializerRequest {
  const command = (process.argv[2] ?? "preview") as InitializerCommand;
  if (command !== "preview" && command !== "apply" && command !== "remove") {
    throw new Error(
      "usage: init-mcpshell-workspace.mjs [preview|apply|remove] --identity <name> [...]"
    );
  }
  const { values } = parseArgs({
    args: process.argv.slice(3),
    options: {
      backend: { type: "string" },
      identity: { type: "string" },
      "project-root": { type: "string" },
      "remove-env": { type: "boolean" },
      "staging-root": { type: "string" }
    },
    strict: true
  });
  if (values.identity === undefined) {
    throw new BridgeError("invalid_input", "--identity is required");
  }
  return {
    command,
    config:
      command === "remove"
        ? undefined
        : {
            backendHandle: values.backend ?? "",
            projectRoot: values["project-root"] ?? "",
            stagingRoot: values["staging-root"] ?? ""
          },
    identity: values.identity,
    removeEnv: values["remove-env"] ?? false
  };
}

async function main(): Promise<void> {
  const skillDirectory = skillDirectoryFromScriptUrl(import.meta.url);
  const result = await runInitializer(readCliRequest(), {
    agentProjectDirectory:
      agentProjectDirectoryFromSkillDirectory(skillDirectory),
    skillDirectory
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (isMainModule(import.meta.url)) {
  await main();
}

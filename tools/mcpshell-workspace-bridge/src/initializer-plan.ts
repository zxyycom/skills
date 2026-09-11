import fs from "node:fs/promises";
import path from "node:path";
import {
  BridgeError,
  readBridgeConfig,
  validateBridgeConfig
} from "./shared.ts";
import {
  agentConfigResource,
  assertEnvironmentIgnore,
  assertNoOtherOwnedIdentity,
  environmentAction,
  environmentResource,
  mergeTable,
  readOptionalText,
  readTextIfPresent,
  renderEnvironment
} from "./initializer-config.ts";
import type {
  InitializationPlan,
  InitializerCommand,
  InitializerPaths,
  InitializerRequest,
  InitializerResult,
  PlannedWrite
} from "./initializer-contract.ts";

async function planningInputs(
  request: InitializerRequest,
  paths: InitializerPaths,
  identity: string
): Promise<
  Readonly<{
    configPath: string;
    configSource: string;
    envPath: string;
    config: import("./shared.ts").BridgeConfig;
  }>
> {
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
  assertNoOtherOwnedIdentity(configSource, identity);
  const config =
    request.config === undefined
      ? await readBridgeConfig(paths.skillDirectory)
      : validateBridgeConfig(request.config);
  await assertEnvironmentIgnore(paths.skillDirectory);
  try {
    await fs.access(toolsPath);
  } catch {
    throw new BridgeError(
      "config_invalid",
      "MCPShell tool definitions are unavailable"
    );
  }
  return { config, configPath, configSource, envPath };
}

async function environmentPlan(
  request: InitializerRequest,
  envPath: string,
  config: import("./shared.ts").BridgeConfig
): Promise<PlannedWrite> {
  const content = renderEnvironment(config);
  const source =
    request.config === undefined ? null : await readOptionalText(envPath);
  return {
    action:
      request.config === undefined
        ? "unchanged"
        : environmentAction(source, content),
    content,
    filePath: envPath,
    resource: environmentResource
  };
}

export async function initializationPlan(
  request: InitializerRequest,
  paths: InitializerPaths,
  identity: string
): Promise<InitializationPlan> {
  const inputs = await planningInputs(request, paths, identity);
  const environment = await environmentPlan(
    request,
    inputs.envPath,
    inputs.config
  );
  const merged = mergeTable(inputs.configSource, identity);
  const registration: PlannedWrite = {
    action: merged.action,
    content: merged.source,
    filePath: inputs.configPath,
    resource: agentConfigResource
  };
  return {
    actions: [
      { action: environment.action, resource: environment.resource },
      { action: registration.action, resource: registration.resource }
    ],
    environment,
    registration
  };
}

export async function atomicWrite(
  filePath: string,
  content: string
): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temporary = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.mcpshell-${process.pid}-${Date.now()}`
  );
  await fs.writeFile(temporary, content, "utf8");
  await fs.rename(temporary, filePath);
}

export function failureResult(
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

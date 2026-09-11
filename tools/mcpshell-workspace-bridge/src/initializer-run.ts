import fs from "node:fs/promises";
import path from "node:path";
import { validateIdentity } from "./initializer-config.ts";
import {
  atomicWrite,
  failureResult,
  initializationPlan
} from "./initializer-plan.ts";
import type {
  InitializerPaths,
  InitializerRequest,
  InitializerResult
} from "./initializer-contract.ts";
import {
  agentConfigResource,
  environmentResource,
  generatedToolsPath,
  readOptionalText,
  readTextIfPresent,
  removeTable
} from "./initializer-config.ts";

function successfulResult(
  request: InitializerRequest,
  identity: string,
  wrote: boolean,
  actions?: InitializerResult["actions"]
): InitializerResult {
  return {
    ...(actions === undefined ? {} : { actions }),
    command: request.command,
    failure_kind: null,
    files:
      request.command === "remove" && !request.removeEnv
        ? [agentConfigResource]
        : [
            agentConfigResource,
            environmentResource,
            ...(request.command === "remove" ? [] : [generatedToolsPath])
          ],
    identity,
    ok: true,
    wrote
  };
}

async function removeConfiguration(
  request: InitializerRequest,
  paths: InitializerPaths,
  identity: string
): Promise<InitializerResult> {
  const configPath = path.join(
    paths.agentProjectDirectory,
    ".codex",
    "config.toml"
  );
  const envPath = path.join(paths.skillDirectory, ".env.mcpshell");
  const merged = removeTable(await readTextIfPresent(configPath), identity);
  const environment = request.removeEnv
    ? await readOptionalText(envPath)
    : null;
  if (environment !== null) await fs.rm(envPath, { force: true });
  if (merged.changed) await atomicWrite(configPath, merged.source);
  return successfulResult(
    request,
    identity,
    merged.changed || environment !== null
  );
}

async function applyOrPreview(
  request: InitializerRequest,
  paths: InitializerPaths,
  identity: string
): Promise<InitializerResult> {
  const plan = await initializationPlan(request, paths, identity);
  if (request.command === "preview")
    return successfulResult(request, identity, false, plan.actions);
  if (plan.environment.action !== "unchanged")
    await atomicWrite(plan.environment.filePath, plan.environment.content);
  if (plan.registration.action !== "unchanged")
    await atomicWrite(plan.registration.filePath, plan.registration.content);
  return successfulResult(
    request,
    identity,
    plan.actions.some((action) => action.action !== "unchanged"),
    plan.actions
  );
}

export async function runInitializer(
  request: InitializerRequest,
  paths: InitializerPaths
): Promise<InitializerResult> {
  try {
    const identity = validateIdentity(request.identity);
    return request.command === "remove"
      ? await removeConfiguration(request, paths, identity)
      : await applyOrPreview(request, paths, identity);
  } catch (error) {
    return failureResult(request.command, request.identity, error);
  }
}

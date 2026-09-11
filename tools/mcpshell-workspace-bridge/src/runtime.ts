import process from "node:process";
import {
  BridgeError,
  bridgeResult,
  isMainModule,
  parseReplace,
  readBridgeConfig,
  skillDirectoryFromScriptUrl,
  validateBridgeConfig,
  type BridgeConfig,
  type BridgeResult
} from "./shared.ts";
import {
  operationName,
  type RuntimeInput,
  type RuntimeMode,
  type RuntimeOptions
} from "./runtime-contract.ts";
import { runGet, runPatch, runPut, runShell } from "./runtime-operations.ts";

export type {
  RuntimeInput,
  RuntimeMode,
  RuntimeOptions
} from "./runtime-contract.ts";

export async function runWorkspaceOperation(
  mode: RuntimeMode,
  input: RuntimeInput,
  unsafeConfig: BridgeConfig,
  runtime: RuntimeOptions = {}
): Promise<BridgeResult> {
  try {
    const config = validateBridgeConfig(unsafeConfig);
    switch (mode) {
      case "apply-patch":
        return await runPatch(input, config, runtime);
      case "get-file":
        return await runGet(input, config, runtime);
      case "put-file":
        return await runPut(input, config, runtime);
      case "shell":
        return await runShell(input, config, runtime);
    }
  } catch (error) {
    if (error instanceof BridgeError) {
      return bridgeResult(operationName(mode), error.failureKind, {
        stderr: error.message,
        target: { exit_code: null, timed_out: false }
      });
    }
    const detail = error instanceof Error ? error.message : String(error);
    return bridgeResult(operationName(mode), "protocol_error", {
      stderr: `workspace bridge failed: ${detail}`,
      target: { exit_code: null, timed_out: false }
    });
  }
}

function modeInput(mode: RuntimeMode): RuntimeInput {
  switch (mode) {
    case "apply-patch":
      return { patch: process.env.MCPSHELL_WORKSPACE_PATCH };
    case "get-file":
    case "put-file":
      return {
        destinationPath: process.env.MCPSHELL_WORKSPACE_DESTINATION_PATH,
        replace: parseReplace(process.env.MCPSHELL_WORKSPACE_REPLACE),
        sourcePath: process.env.MCPSHELL_WORKSPACE_SOURCE_PATH
      };
    case "shell":
      return { command: process.env.MCPSHELL_WORKSPACE_COMMAND };
  }
}

async function main(): Promise<void> {
  const mode = process.argv[2] as RuntimeMode | undefined;
  if (
    mode !== "shell" &&
    mode !== "apply-patch" &&
    mode !== "put-file" &&
    mode !== "get-file"
  ) {
    throw new Error(
      "usage: mcpshell-workspace.mjs <shell|apply-patch|put-file|get-file>"
    );
  }
  let result: BridgeResult;
  try {
    const config = await readBridgeConfig(
      skillDirectoryFromScriptUrl(import.meta.url)
    );
    result = await runWorkspaceOperation(mode, modeInput(mode), config);
  } catch (error) {
    const failureKind =
      error instanceof BridgeError ? error.failureKind : "protocol_error";
    const detail = error instanceof Error ? error.message : String(error);
    result = bridgeResult(operationName(mode), failureKind, {
      stderr: detail,
      target: { exit_code: null, timed_out: false }
    });
  }
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (isMainModule(import.meta.url)) {
  await main();
}

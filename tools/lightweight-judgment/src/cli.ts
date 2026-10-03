import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  loadConfiguration,
  type Configuration,
  type LocalRuntime
} from "./configuration.ts";
import { JudgmentFailure } from "./failure.ts";
import type { JsonValue } from "./json.ts";
import { loadInput } from "./input.ts";
import { parseOptions, type Options } from "./options.ts";
import {
  failureOutcome,
  successOutcome,
  type InvocationState,
  type CliOutcome
} from "./output.ts";
import { endpoint, validateModel, validateRequest } from "./request.ts";
import { sendRequest, type Fetch } from "./transport.ts";

export type { CliOutcome } from "./output.ts";

export const help = `Lightweight Judgment — Node.js >=24.18\nUsage: node /absolute/path/lightweight-judgment/scripts/lightweight-judgment.mjs [--config path] doctor|json|ask [options]\n  doctor                         本地配置与密钥存在性检查（离线）\n  json --file path | --json text | -\n  ask --type choice|score|noul --question text\n      --text text | --text-file path | --state-json JSON | --state-file path\n      [--id answer] [--option key=description ...] [--level text ...]\n  --model jev-*|typesafe/jev-*|~typesafe/jev-*  --timeout-ms 1..2147483647\n  --dry-run (json/ask)            本地预览，不读取密钥、不联网\n  --help                         不读取配置、输入或凭据\nOne request, no retry or redirect; configuration stores apiKeyEnv, never a key.\n`;

export type CliRuntime = LocalRuntime &
  Readonly<{ readStdin(): Promise<string>; fetch: Fetch; now(): number }>;

function requiredKey(config: Configuration, runtime: CliRuntime): string {
  const key = runtime.env[config.apiKeyEnv];
  if (!key?.trim()) {
    throw new JudgmentFailure(
      "configuration",
      "配置指定的密钥环境变量缺失或为空。"
    );
  }
  return key;
}

type DoctorResult = Readonly<{
  configPath: string;
  endpoint: string;
  model: string;
  timeoutMs: number;
  apiKeyEnv: string;
  hasApiKey: true;
  offline: true;
}>;

function doctor(
  config: Configuration,
  options: Options,
  runtime: CliRuntime
): DoctorResult {
  // Only existence is consumed. Never put the credential into output state.
  requiredKey(config, runtime);
  const model =
    options.values.model === undefined
      ? config.model
      : validateModel(options.values.model, "input", "--model");
  return {
    configPath: config.path,
    endpoint,
    model,
    timeoutMs: config.timeoutMs,
    apiKeyEnv: config.apiKeyEnv,
    hasApiKey: true,
    offline: true
  };
}

async function infer(
  options: Options,
  config: Configuration,
  runtime: CliRuntime,
  state: InvocationState
): Promise<JsonValue> {
  const request = validateRequest(
    await loadInput(options, runtime),
    options.values.model,
    config.model
  );
  state.requestModel = request.model;
  if (options.dryRun) {
    return { endpoint, request };
  }
  state.apiKey = requiredKey(config, runtime);
  state.attempts = 1;
  state.started = runtime.now();
  return await sendRequest(
    request,
    state.apiKey,
    config.timeoutMs,
    runtime.fetch
  );
}

export async function runCli(
  argv: readonly string[],
  runtime: CliRuntime
): Promise<CliOutcome> {
  if (argv.includes("--help")) {
    return { exitCode: 0, stdout: help, stderr: "" };
  }
  const state: InvocationState = {
    attempts: 0,
    started: undefined,
    requestModel: undefined,
    apiKey: undefined
  };
  try {
    const options = parseOptions(argv);
    const config = await loadConfiguration(
      options.values.config,
      options.values["timeout-ms"],
      runtime
    );
    const result =
      options.command === "doctor"
        ? doctor(config, options, runtime)
        : await infer(options, config, runtime, state);
    return successOutcome(result, state, runtime.now());
  } catch (error) {
    return failureOutcome(error, state, runtime.now());
  }
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin)
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return new TextDecoder("utf-8", { fatal: true }).decode(
    Buffer.concat(chunks)
  );
}

export function productionRuntime(): CliRuntime {
  return {
    env: process.env,
    home: os.homedir(),
    now: () => performance.now(),
    fetch: (url, init) => fetch(url, init),
    readFile: async (file) =>
      new TextDecoder("utf-8", { fatal: true }).decode(await fs.readFile(file)),
    readStdin
  };
}
if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  const outcome = await runCli(process.argv.slice(2), productionRuntime());
  process.stdout.write(outcome.stdout);
  process.stderr.write(outcome.stderr);
  process.exitCode = outcome.exitCode;
}

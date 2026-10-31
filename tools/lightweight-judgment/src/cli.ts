import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  loadConfiguration,
  resolveApiKey,
  type Configuration,
  type LocalRuntime
} from "./configuration.ts";
import { JudgmentFailure, normalizeFailure } from "./failure.ts";
import { type JsonValue } from "./protocol/json.ts";
import { CallLog, type CallCompletion } from "./logging/call-log.ts";
import { localMetadata } from "./local-metadata.ts";
import { parseStatisticsOptions } from "./statistics/stats-options.ts";
import { statistics, type StatisticsResult } from "./statistics/statistics.ts";
import { loadInput } from "./input.ts";
import {
  parseArguments,
  parseOptions,
  type Options,
  type ParsedArguments
} from "./options.ts";
import {
  failureOutcome,
  successOutcome,
  type InvocationState,
  type CliOutcome
} from "./output.ts";
import { validateRequest } from "./protocol/request.ts";
import {
  adapterContract,
  validateAdapterModel,
  type AdapterContract
} from "./adapters/adapter-contract.ts";
import { prepareRequest } from "./adapters/adapter-request.ts";
import { sendRequest, type Fetch } from "./adapters/transport.ts";

export type { CliOutcome } from "./output.ts";

export const help = `Lightweight Judgment — Node.js >=24.18
Usage: node /absolute/path/lightweight-judgment/scripts/lightweight-judgment.ts [--config path] doctor|json|ask|stats [options]
将示例中的绝对路径替换为实际 skill 和输入文件路径。

命令：
  doctor                         本地配置与密钥存在性检查（离线）
  json --file path | --json text | -
                                 完整请求，恰选一种输入；- 表示 stdin
  ask --type choice|score|noul|box --question text
      --text text | --text-file path | --state-json JSON | --state-file path
                                 单题上下文，恰选一种输入
      [--id answer] [--option key=description ...] [--level text ...]
                                 Choice 用 --option；Score 按低到高重复 --level
  stats [--database path | --config path]  已有调用日志的只读离线统计
      [--from UTC --to UTC] [--endpoint URL] [--request-model id --response-model id]
      [--status status --run-id id --tag key=value ...]
      [--group-by endpoint,requestModel,status,tag:key] [--bucket requestBytes=100,1000 ...]
      [--percentiles 50,90,95,99] [--max-rows 100000]
      不取环境密钥、不联网、不创建/迁移库；完整口径见 references/statistics.md。
  --run-id id --run-index n (json/ask) 本地批次顺序，成对提供；--tag key=value 可重复
  --model id（按 config.adapter 校验）  --timeout-ms 1..2147483647
  --endpoint URL                 覆盖本次所选 adapter 完整地址
  --dry-run (json/ask)            预览最终请求，不取环境密钥、不联网或建库
  --help                         展示帮助，不读取配置、输入或凭据

配置与凭据：
  --config > LIGHTWEIGHT_JUDGMENT_CONFIG > ~/.config/lightweight-judgment/config.json
  只读取选中的文件，不合并；仅默认文件缺失时使用内置默认值。
  默认 model=typesafe/jev-1.13、apiKeyEnv=OPENROUTER_API_KEY、timeoutMs=15000。
  endpoint 默认 https://openrouter.ai/api/v1/systemone；仅 HTTPS 或回环 HTTP。
  可在私有配置中设置 apiKey，优先于 apiKeyEnv；不自动读取 .env。
  adapter 默认 openrouter-systemone；其他值 typesafe、openrouter-decisions、openai-decisions。
  新 adapter 显式配置 endpoint、model 和 apiKey/apiKeyEnv；不会继承旧凭据。
  images、longContext 默认 false，仅可信配置启用；完整模态与转换合同见 references/protocol-adapters.md。
  logging: { enabled: false, saveRequest: false, saveResponse: true }。
  logging.databasePath 默认 ~/.local/share/lightweight-judgment/calls.sqlite3。
  日志默认关闭；开启后的真实调用自动建库，发送前记录，返回后更新，不自动重放。
  doctor 只报告本地配置、密钥存在与日志设置，不建库，不验证鉴权或余额。

离线试跑：
  node /absolute/path/lightweight-judgment/scripts/lightweight-judgment.ts json --file /absolute/path/request.json --dry-run
  node /absolute/path/lightweight-judgment/scripts/lightweight-judgment.ts ask --type noul --text "请回退版本。" --question "是否明确请求回退版本？" --dry-run
  取得外发与费用授权后，去掉 --dry-run 才发送请求。
  长文本与敏感材料优先使用文件或 stdin；预览输出仍包含待发正文。

结果与退出码：
  除帮助外 stdout 为一个 JSON 对象，stderr 为诊断。
  0：调用或离线检查成功；否定、不确定类别或低 confidence 也可有效。
  2：configuration/input，本次未发送；3：远端或传输失败，检查 error.kind。
  4：日志存储或 stats 读取/统计失败；stats 不带 persistence；推理需检查 attempts 与 meta.persistence。
  CLI 每次只发送一个请求，不自动重试、跟随重定向或切换服务。
  完整请求与返回格式见 skill 包内 references/cli.md。
`;

export type CliRuntime = LocalRuntime &
  Readonly<{ readStdin(): Promise<string>; fetch: Fetch; now(): number }>;

type DoctorResult = Readonly<{
  adapterContract: AdapterContract;
  images: boolean;
  longContext: boolean;
  configPath: string;
  endpoint: string;
  model: string;
  timeoutMs: number;
  apiKeyEnv: string;
  credentialSource: "config" | "environment";
  logging: Configuration["logging"];
  hasApiKey: true;
  offline: true;
}>;

function doctor(
  config: Configuration,
  options: Options,
  runtime: CliRuntime
): DoctorResult {
  // Only existence is consumed. Never put the credential into output state.
  const model =
    options.values.model === undefined
      ? config.model
      : validateAdapterModel(
          options.values.model,
          config.adapter,
          "input",
          "--model"
        );
  resolveApiKey(config, runtime);
  return {
    adapterContract: adapterContract(config.adapter),
    images: config.images,
    longContext: config.longContext,
    configPath: config.path,
    endpoint: config.endpoint,
    model,
    timeoutMs: config.timeoutMs,
    apiKeyEnv: config.apiKeyEnv,
    credentialSource: config.apiKey === undefined ? "environment" : "config",
    logging: config.logging,
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
  const metadata = localMetadata(
    options.values["run-id"],
    options.values["run-index"],
    options.tags
  );
  const request = validateRequest(
    await loadInput(options, runtime),
    options.values.model,
    config.model,
    config.adapter
  );
  state.requestModel = request.model;
  const prepared = prepareRequest(request, config);
  state.adapterContract = prepared.adapterContract;
  if (options.dryRun) {
    return {
      endpoint: config.endpoint,
      adapterContract: prepared.adapterContract,
      request: prepared.wire,
      headers: prepared.headers,
      manifest: prepared.manifest
    };
  }
  state.apiKey = resolveApiKey(config, runtime);
  const body = prepared.body;
  const log = config.logging.enabled
    ? CallLog.start(config, request, metadata, prepared)
    : undefined;
  state.attempts = 1;
  state.started = runtime.now();
  let completion: CallCompletion;
  try {
    const result = await sendRequest(
      request,
      {
        endpoint: config.endpoint,
        adapter: config.adapter,
        responseRequest: prepared.responseRequest,
        headers: prepared.headers,
        body,
        apiKey: state.apiKey,
        timeoutMs: config.timeoutMs,
        ...(log === undefined
          ? {}
          : {
              received: (status: number, bytes?: Uint8Array) =>
                log.received(status, bytes)
            })
      },
      runtime.fetch
    );
    completion = { ok: true, result: result.result };
    state.normalized = result.normalized;
  } catch (error) {
    completion = {
      ok: false,
      error: normalizeFailure(error, "invalid_response")
    };
  }
  state.elapsedMs = Math.max(0, Math.round(runtime.now() - state.started));
  state.persistence = log?.finish(completion, state.elapsedMs);
  if (!completion.ok) throw completion.error;
  return completion.result;
}

async function runStatistics(
  parsed: ParsedArguments,
  runtime: CliRuntime
): Promise<StatisticsResult> {
  const options = parseStatisticsOptions(parsed, runtime.home);
  const file =
    options.database ??
    (await loadConfiguration({ path: options.config }, runtime)).logging
      .databasePath;
  return statistics(file, options);
}

function initialState(): InvocationState {
  return {
    attempts: 0,
    started: undefined,
    requestModel: undefined,
    apiKey: undefined
  };
}

export async function runCli(
  argv: readonly string[],
  runtime: CliRuntime
): Promise<CliOutcome> {
  if (argv.includes("--help")) {
    return { exitCode: 0, stdout: help, stderr: "" };
  }
  const state = initialState();
  let statsCommand = false;
  try {
    const parsed = parseArguments(argv);
    statsCommand = parsed.positionals[0] === "stats";
    if (statsCommand) {
      return successOutcome(
        await runStatistics(parsed, runtime),
        state,
        runtime.now()
      );
    }
    const options = parseOptions(parsed);
    const config = await loadConfiguration(
      {
        path: options.values.config,
        timeoutMs: options.values["timeout-ms"],
        endpoint: options.values.endpoint
      },
      runtime
    );
    const result =
      options.command === "doctor"
        ? doctor(config, options, runtime)
        : await infer(options, config, runtime, state);
    return successOutcome(result, state, runtime.now());
  } catch (error) {
    if (
      error instanceof JudgmentFailure &&
      error.kind === "storage" &&
      !statsCommand
    ) {
      state.persistence = { status: "failed" };
    }
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

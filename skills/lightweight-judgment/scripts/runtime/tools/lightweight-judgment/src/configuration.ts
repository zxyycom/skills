/*
 * Synced TypeScript runtime; repository maintenance edits tools/lightweight-judgment/src/configuration.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/lightweight-judgment/src/configuration.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/lightweight-judgment/src/configuration.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/lightweight-judgment
 * Rebuild: bun run sync:lightweight-judgment-cli
 */
import path from "node:path";
import * as v from "valibot";
import { fail, JudgmentFailure } from "./failure.ts";
import { parseJson, hasOnlyFields } from "./json.ts";
import { defaultModel } from "./request.ts";
import {
  adapters,
  validateAdapterModel,
  type Adapter
} from "./adapter-contract.ts";

const defaultEndpoint = "https://openrouter.ai/api/v1/systemone";

const apiKeySchema = v.pipe(
  v.string(),
  v.regex(/^[\x21-\x7e]+$/u),
  v.brand("ApiKey")
);

export type ApiKey = v.InferOutput<typeof apiKeySchema>;

export type LoggingConfiguration = Readonly<{
  enabled: boolean;
  databasePath: string;
  saveRequest: boolean;
  saveResponse: boolean;
}>;

export type Configuration = Readonly<{
  path: string;
  model: string;
  adapter: Adapter;
  images: boolean;
  longContext: boolean;
  apiKeyEnv: string;
  apiKey?: ApiKey;
  endpoint: string;
  timeoutMs: number;
  logging: LoggingConfiguration;
}>;

type ConfigurationOverrides = Readonly<{
  path?: string;
  endpoint?: string;
  timeoutMs?: string;
}>;

export type LocalRuntime = Readonly<{
  env: Readonly<Record<string, string | undefined>>;
  home: string;
  readFile(path: string): Promise<string>;
}>;

function defaultMissing(error: unknown, explicit: boolean): boolean {
  if (explicit) {
    return false;
  }
  if (!(error instanceof Error)) {
    return false;
  }
  return "code" in error && error.code === "ENOENT";
}

async function readConfiguration(
  file: string,
  explicit: boolean,
  runtime: LocalRuntime
): Promise<unknown> {
  try {
    return parseJson(await runtime.readFile(file), "configuration", "config");
  } catch (error) {
    if (error instanceof JudgmentFailure) {
      throw error;
    }
    if (defaultMissing(error, explicit)) {
      return {};
    }
    return fail("configuration", "config", "选中的配置文件不存在或不可读");
  }
}

const maximumTimeoutMs = 2147483647;

const timeoutSchema = v.pipe(
  v.number(),
  v.integer(),
  v.minValue(1),
  v.maxValue(maximumTimeoutMs)
);

const loggingSchema = v.strictObject({
  enabled: v.optional(v.boolean(), false),
  databasePath: v.optional(v.pipe(v.string(), v.minLength(1))),
  saveRequest: v.optional(v.boolean(), false),
  saveResponse: v.optional(v.boolean(), true)
});

const configurationSchema = v.strictObject({
  adapter: v.optional(v.picklist(adapters), "openrouter-systemone"),
  images: v.optional(v.boolean(), false),
  longContext: v.optional(v.boolean(), false),
  model: v.optional(v.string()),
  endpoint: v.optional(v.string()),
  apiKey: v.optional(apiKeySchema),
  apiKeyEnv: v.optional(
    v.pipe(v.string(), v.regex(/^[A-Za-z_][A-Za-z0-9_]*$/u))
  ),
  timeoutMs: v.optional(timeoutSchema, 15000),
  logging: v.optional(loggingSchema, {})
});

function parseConfiguration(
  raw: unknown
): v.InferOutput<typeof configurationSchema> {
  if (!hasOnlyFields(raw, Object.keys(configurationSchema.entries))) {
    fail("configuration", "config", "配置不是对象或包含未知字段");
  }
  if (
    raw.logging !== undefined &&
    !hasOnlyFields(raw.logging, Object.keys(loggingSchema.entries))
  ) {
    fail("configuration", "config.logging", "日志配置不是对象或包含未知字段");
  }
  const parsed = v.safeParse(configurationSchema, raw);
  if (!parsed.success) {
    fail(
      "configuration",
      "config",
      "配置字段须为合法 model、endpoint、apiKey、apiKeyEnv、timeoutMs、logging"
    );
  }
  return parsed.output;
}

function validateExplicitAdapter(
  values: v.InferOutput<typeof configurationSchema>
): void {
  if (
    values.model === undefined ||
    values.endpoint === undefined ||
    (values.apiKey === undefined && values.apiKeyEnv === undefined)
  )
    fail(
      "configuration",
      "config",
      "新 adapter 必须显式配置 model、endpoint 和 apiKey 或 apiKeyEnv"
    );
}

function validateAdapterOptions(
  values: v.InferOutput<typeof configurationSchema>
): void {
  if (values.adapter === "openrouter-systemone") {
    if (values.images || values.longContext)
      fail(
        "configuration",
        "config",
        "兼容 systemone adapter 不支持实验图片或长上下文开关"
      );
    return;
  }
  validateExplicitAdapter(values);
  if (values.adapter === "openai-decisions" && values.longContext)
    fail(
      "configuration",
      "config.longContext",
      "OpenAI Decisions 没有长上下文 opt-in；不得使用 TypeSafe 开关"
    );
}

function credentialConfiguration(
  values: Pick<
    v.InferOutput<typeof configurationSchema>,
    "apiKey" | "apiKeyEnv"
  >
): Pick<Configuration, "apiKey" | "apiKeyEnv"> {
  return {
    apiKeyEnv: values.apiKeyEnv ?? "OPENROUTER_API_KEY",
    ...(values.apiKey === undefined ? {} : { apiKey: values.apiKey })
  };
}

function validateConfiguration(
  raw: unknown,
  file: string,
  home: string
): Configuration {
  const values = parseConfiguration(raw);
  validateAdapterOptions(values);
  return {
    path: file,
    adapter: values.adapter,
    images: values.images,
    longContext: values.longContext,
    model: validateAdapterModel(
      values.model ?? defaultModel,
      values.adapter,
      "configuration",
      "config.model"
    ),
    ...credentialConfiguration(values),
    endpoint: validateEndpoint(
      values.endpoint ?? defaultEndpoint,
      "configuration"
    ),
    timeoutMs: values.timeoutMs,
    logging: {
      ...values.logging,
      databasePath: loggingPath(values.logging.databasePath, file, home)
    }
  };
}

export async function loadConfiguration(
  overrides: ConfigurationOverrides,
  runtime: LocalRuntime
): Promise<Configuration> {
  const selected = overrides.path ?? runtime.env.LIGHTWEIGHT_JUDGMENT_CONFIG;
  const file =
    selected ??
    path.join(runtime.home, ".config/lightweight-judgment/config.json");
  const configuration = validateConfiguration(
    await readConfiguration(file, selected !== undefined, runtime),
    file,
    runtime.home
  );
  let timeoutMs = configuration.timeoutMs;
  if (overrides.timeoutMs !== undefined) {
    timeoutMs = parseTimeoutOverride(overrides.timeoutMs);
  }
  let endpoint = configuration.endpoint;
  if (overrides.endpoint !== undefined) {
    endpoint = validateEndpoint(overrides.endpoint, "input");
  }
  return { ...configuration, timeoutMs, endpoint };
}

export function resolveApiKey(
  config: Configuration,
  runtime: LocalRuntime
): ApiKey {
  if (config.apiKey !== undefined) return config.apiKey;
  const parsed = v.safeParse(apiKeySchema, runtime.env[config.apiKeyEnv]);
  if (!parsed.success) {
    fail(
      "configuration",
      "apiKeyEnv",
      "指定的密钥变量缺失或无效；需要非空且无空白的可打印 ASCII 值"
    );
  }
  return parsed.output;
}

function validateEndpoint(
  value: string,
  kind: "input" | "configuration"
): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return fail(kind, "endpoint", "需要完整的 adapter HTTP(S) URL");
  }
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (
    (url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    fail(
      kind,
      "endpoint",
      "仅允许 HTTPS 或回环 HTTP，且不得含凭据、查询参数或片段"
    );
  }
  return url.href;
}

function loggingPath(
  value: string | undefined,
  file: string,
  home: string
): string {
  if (value === undefined)
    return path.join(home, ".local/share/lightweight-judgment/calls.sqlite3");
  if (value.startsWith("~/")) return path.resolve(home, value.slice(2));
  return path.resolve(path.dirname(file), value);
}

function parseTimeoutOverride(value: string): number {
  if (!/^[1-9]\d*$/u.test(value)) {
    fail("input", "--timeout-ms", "需要正整数");
  }
  const parsed = v.safeParse(timeoutSchema, Number(value));
  if (!parsed.success) {
    fail("input", "--timeout-ms", `超出定时器范围 1–${maximumTimeoutMs}`);
  }
  return parsed.output;
}

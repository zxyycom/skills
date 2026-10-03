import path from "node:path";
import * as v from "valibot";
import { fail, JudgmentFailure } from "./failure.ts";
import { parseJson, hasOnlyFields } from "./json.ts";
import { defaultModel, validateModel, type JevModel } from "./request.ts";

export type Configuration = Readonly<{
  path: string;
  model: JevModel;
  apiKeyEnv: string;
  timeoutMs: number;
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

const configurationSchema = v.strictObject({
  model: v.optional(v.string(), defaultModel),
  apiKeyEnv: v.optional(
    v.pipe(v.string(), v.regex(/^[A-Za-z_][A-Za-z0-9_]*$/u)),
    "OPENROUTER_API_KEY"
  ),
  timeoutMs: v.optional(timeoutSchema, 15000)
});

function validateConfiguration(raw: unknown, file: string): Configuration {
  if (!hasOnlyFields(raw, ["model", "apiKeyEnv", "timeoutMs"])) {
    fail("configuration", "config", "配置不是对象或包含未知字段");
  }
  const parsed = v.safeParse(configurationSchema, raw);
  if (!parsed.success) {
    fail(
      "configuration",
      "config",
      "配置字段须为合法 model、apiKeyEnv、timeoutMs"
    );
  }
  return {
    path: file,
    model: validateModel(parsed.output.model, "configuration", "config.model"),
    apiKeyEnv: parsed.output.apiKeyEnv,
    timeoutMs: parsed.output.timeoutMs
  };
}

export async function loadConfiguration(
  explicitPath: string | undefined,
  timeout: string | undefined,
  runtime: LocalRuntime
): Promise<Configuration> {
  const selected = explicitPath ?? runtime.env.LIGHTWEIGHT_JUDGMENT_CONFIG;
  const file =
    selected ??
    path.join(runtime.home, ".config/lightweight-judgment/config.json");
  const configuration = validateConfiguration(
    await readConfiguration(file, selected !== undefined, runtime),
    file
  );
  if (timeout === undefined) {
    return configuration;
  }
  return {
    ...configuration,
    timeoutMs: parseTimeoutOverride(timeout)
  };
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

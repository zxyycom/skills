import { deflateSync } from "node:zlib";
import { loadConfiguration } from "../src/configuration.ts";
import { validateRequest } from "../src/request.ts";
import { prepareRequest } from "../src/adapter-request.ts";
import { parseJson } from "../src/json.ts";
import { runtime, request } from "./runtime-fixture.ts";
export const openai = {
  adapter: "openai-decisions",
  model: "gpt-6-luna",
  endpoint: "https://decisions.test/v1/decisions",
  apiKeyEnv: "NATIVE_KEY"
};
export const typesafe = {
  adapter: "typesafe",
  model: "jev-1.14.0",
  endpoint: "https://native.test/v1/systemone",
  apiKeyEnv: "TYPESAFE_KEY"
};
export const router = {
  adapter: "openrouter-decisions",
  model: "typesafe/jev-1.14",
  endpoint: "https://router.test/api/alpha/decisions",
  apiKeyEnv: "ROUTER_KEY"
};
export const usage = {
  input_tokens: 23,
  output_tokens: 0,
  total_tokens: 23,
  input_tokens_details: { cached_tokens: 0, cache_write_tokens: 0 },
  output_tokens_details: { reasoning_tokens: 0 }
};
export function configured(
  config: unknown,
  overrides: Parameters<typeof runtime>[0] = {}
) {
  return runtime({
    readFile: async () => JSON.stringify(config),
    env: {
      NATIVE_KEY: "native-key",
      TYPESAFE_KEY: "typesafe-key",
      ROUTER_KEY: "router-key"
    },
    ...overrides
  });
}
export async function prepared(source: string, config: unknown) {
  const selected = await loadConfiguration({}, configured(config));
  const carrier = validateRequest(
    parseJson(source),
    undefined,
    selected.model,
    selected.adapter
  );
  return { carrier, prepared: prepareRequest(carrier, selected) };
}
export function png(width = 280, height = 280): string {
  function crc(bytes: Buffer): number {
    let value = 0xffffffff;
    for (const byte of bytes) {
      value ^= byte;
      for (let i = 0; i < 8; i++)
        value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0);
    }
    return (value ^ 0xffffffff) >>> 0;
  }
  function chunk(name: string, data: Buffer): Buffer {
    const result = Buffer.alloc(12 + data.length);
    result.writeUInt32BE(data.length);
    result.write(name, 4, "ascii");
    data.copy(result, 8);
    result.writeUInt32BE(crc(result.subarray(4, -4)), result.length - 4);
    return result;
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  const image = Buffer.concat([
    Buffer.from("89504e470d0a1a0a", "hex"),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(Buffer.alloc(height * (width * 3 + 1)))),
    chunk("IEND", Buffer.alloc(0))
  ]);
  return `data:image/png;base64,${image.toString("base64")}`;
}
export function image(url = png()) {
  return { type: "image_url", image_url: { url } };
}
export function input(
  state: unknown,
  questions: unknown = request.questions
): string {
  return JSON.stringify({ state, questions });
}

/*
 * Synced TypeScript runtime; repository maintenance edits tools/lightweight-judgment/src/adapter-request.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/lightweight-judgment/src/adapter-request.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/lightweight-judgment/src/adapter-request.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/lightweight-judgment
 * Rebuild: bun run sync:lightweight-judgment-cli
 */
import type { Configuration } from "./configuration.ts";
import { adapterContract, type AdapterContract } from "./adapter-contract.ts";
import {
  validateCarrierCapabilities,
  validateDecodedImageBudget,
  validateImageBodyBudget,
  validateJevImageDimensions,
  validateOpenaiCapabilities
} from "./adapter-capabilities.ts";
import { fail } from "./failure.ts";
import {
  orderedKeys,
  stringifyJson,
  type JsonValue,
  type JsonObject
} from "./json.ts";
import { scanImages, type Images } from "./images.ts";
import { compileOpenaiRequest } from "./openai-request.ts";
import { validateRequest, type Request } from "./request.ts";

export type PreparedRequest = Readonly<{
  adapterContract: AdapterContract;
  wire: JsonObject;
  body: string;
  headers: Readonly<Record<string, string>>;
  manifest: JsonObject;
  carrierJson: string | null;
  responseRequest: Request;
}>;
type CompiledRequest = Readonly<{
  wire: JsonObject;
  headers: Readonly<Record<string, string>>;
}>;

function compileTypesafeRequest(
  request: Request,
  config: Configuration,
  images: Images
): CompiledRequest {
  const headers: Record<string, string> = {};
  if (config.longContext) headers["TypeSafe-Danger-Zone-Long-Context"] = "true";
  if (images.occurrences.length === 0) return { wire: request, headers };
  headers["TypeSafe-Danger-Zone-Images"] = "true";
  validateJevImageDimensions(images.occurrences, "TypeSafe ");
  const assets: Record<string, JsonValue> = Object.create(null);
  for (const image of images.occurrences)
    assets[image.reference] = {
      data_base64: image.base64,
      format: image.format
    };
  return {
    wire: {
      ...request,
      state: images.replace(request.state, '$["state"]'),
      questions: images.replace(request.questions, '$["questions"]'),
      assets
    },
    headers
  };
}

function compileRequest(
  request: Request,
  config: Configuration,
  images: Images
): CompiledRequest {
  switch (config.adapter) {
    case "typesafe":
      return compileTypesafeRequest(request, config, images);
    case "openrouter-decisions":
      if (request.model.startsWith("typesafe/"))
        validateJevImageDimensions(images.occurrences, "可移植 Jev ");
      return { wire: request, headers: {} };
    case "openai-decisions":
      validateOpenaiCapabilities(request, images.occurrences);
      return {
        wire: compileOpenaiRequest(request, images),
        headers: {}
      };
    case "openrouter-systemone":
      return { wire: request, headers: {} };
  }
}

function responseRequest(
  request: Request,
  wire: JsonObject,
  config: Configuration,
  images: Images
): Request {
  if (config.adapter !== "typesafe" || images.occurrences.length === 0)
    return request;
  return validateRequest(
    { state: wire.state, questions: wire.questions, model: request.model },
    undefined,
    request.model,
    config.adapter
  );
}

function manifest(
  request: Request,
  config: Configuration,
  images: Images
): JsonObject {
  const nativeOpenai = config.adapter === "openai-decisions";
  return {
    renderer: nativeOpenai ? "jev-to-decisions/v1" : "jev-carrier/v1",
    questions: orderedKeys(request.questions).map((id, ordinal) => ({
      id,
      ordinal,
      type: request.questions[id].type,
      ...(nativeOpenai ? { name: `q${ordinal}` } : {})
    })),
    images: images.occurrences.map(
      ({ path, reference, scope, width, height, bytes }) => ({
        path,
        reference,
        scope,
        width,
        height,
        bytes
      })
    ),
    longContext: config.longContext
  };
}

export function prepareRequest(
  request: Request,
  config: Configuration
): PreparedRequest {
  // Scanning happens even when images are off, before credentials, logging or transport.
  const images = scanImages(request, config.images);
  validateCarrierCapabilities(request, config, images.occurrences);
  const { wire, headers } = compileRequest(request, config, images);
  validateDecodedImageBudget(request, config, images.occurrences);
  const body = stringifyJson(wire);
  validateImageBodyBudget(body, request, config, images.occurrences);
  const expectedResponse = responseRequest(request, wire, config, images);
  if (config.adapter === "typesafe" && images.occurrences.length * 36 > 65536)
    fail("input", "images", "TypeSafe 生成图片引用总长度超过 65536 字节");
  const carrierJson = stringifyJson(request);
  return {
    adapterContract: adapterContract(config.adapter),
    wire,
    body,
    headers,
    carrierJson: body === carrierJson ? null : carrierJson,
    responseRequest: expectedResponse,
    manifest: manifest(request, config, images)
  };
}

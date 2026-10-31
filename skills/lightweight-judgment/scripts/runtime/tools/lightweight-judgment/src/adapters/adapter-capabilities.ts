/*
 * Synced TypeScript runtime; repository maintenance edits tools/lightweight-judgment/src/adapters/adapter-capabilities.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/lightweight-judgment/src/adapters/adapter-capabilities.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/lightweight-judgment/src/adapters/adapter-capabilities.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/lightweight-judgment
 * Rebuild: bun run sync:lightweight-judgment-cli
 */
import type { Configuration } from "../configuration.ts";
import { fail } from "../failure.ts";
import { orderedKeys, stringifyJson } from "../protocol/json.ts";
import type { ImageOccurrence } from "./images.ts";
import type { Request } from "../protocol/request.ts";

type Occurrences = readonly ImageOccurrence[];

const maximumOpenaiQuestions = 200;
const maximumOpenaiImageOccurrences = 128;
const maximumDecodedJevImageBytes = 32 * 1024 * 1024;
const maximumJevImageBodyBytes = 32 * 1024 * 1024;

function validateBoxes(
  request: Request,
  config: Configuration,
  images: Occurrences
): void {
  const boxes = orderedKeys(request.questions).filter(
    (id) => request.questions[id].type === "box"
  );
  if (boxes.length === 0) return;
  if (config.adapter === "openai-decisions")
    fail("input", "questions", "OpenAI Decisions 不支持 Box；整次请求未发送");
  if (!/^(?:typesafe\/)?jev-1\.14(?:[.-]|$)/u.test(request.model))
    fail("input", "questions", "Box 需要显式 Jev 1.14 模型");
  for (const id of boxes) {
    const path = `$["questions"][${JSON.stringify(id)}]["instructions"]`;
    if (
      !images.some(
        (image) => image.scope === "state" || image.path.startsWith(path)
      )
    )
      fail(
        "input",
        "questions",
        "每个 Box 需要共享 state 或自身 instructions 中的图片"
      );
  }
}

function validateRouterLongContext(
  request: Request,
  config: Configuration,
  images: Occurrences
): void {
  if (!request.model.startsWith("typesafe/")) return;
  if (config.longContext) return;
  if (
    images.length > 0 ||
    Buffer.byteLength(stringifyJson(request), "utf8") > 32000
  )
    fail(
      "input",
      "config.longContext",
      "OpenRouter 图片或超过 32000 字节可能自动启用长上下文，需 longContext=true 接受"
    );
}

function validateRouterOpenai(
  request: Request,
  config: Configuration,
  images: Occurrences
): void {
  if (config.longContext)
    fail(
      "input",
      "config.longContext",
      "OpenRouter OpenAI 上游没有 TypeSafe 长上下文开关"
    );
  const ids = orderedKeys(request.questions);
  if (ids.length > maximumOpenaiQuestions)
    fail("input", "questions", "OpenRouter OpenAI 上游最多 200 题");
  if (images.some((image) => image.scope === "question"))
    fail(
      "input",
      "images",
      "OpenRouter OpenAI 上游尚不支持本 CLI 的题目局部图合同"
    );
  if (images.length > maximumOpenaiImageOccurrences)
    fail("input", "images", "OpenRouter OpenAI 上游最多 128 图片 occurrence");
  if (
    ids.some((id) => {
      const q = request.questions[id];
      return q.type === "choice" && orderedKeys(q.criteria).length < 2;
    })
  )
    fail("input", "questions", "OpenRouter OpenAI Choice 至少两个候选");
}

export function validateCarrierCapabilities(
  request: Request,
  config: Configuration,
  images: Occurrences
): void {
  const hasBox = orderedKeys(request.questions).some(
    (id) => request.questions[id].type === "box"
  );
  if (
    config.adapter === "openrouter-systemone" &&
    (images.length > 0 || hasBox)
  )
    fail("input", "questions", "legacy systemone adapter 仅支持文本三原语");
  validateBoxes(request, config, images);
  if (config.adapter !== "openrouter-decisions") return;
  validateRouterLongContext(request, config, images);
  if (request.model === "openai/gpt-6-luna-decisions")
    validateRouterOpenai(request, config, images);
}

export function validateOpenaiCapabilities(
  request: Request,
  images: Occurrences
): void {
  if (orderedKeys(request.questions).length > maximumOpenaiQuestions)
    fail("input", "questions", "OpenAI Decisions 每次最多 200 题，不自动拆分");
  if (images.some((image) => image.scope === "question"))
    fail(
      "input",
      "images",
      "OpenAI 无题目局部图槽；不会提升到共享 input 或隐式分次发送"
    );
  if (images.length > maximumOpenaiImageOccurrences)
    fail("input", "images", "OpenAI Decisions 每次最多 128 个图片 occurrence");
}

function portableJevImage(image: ImageOccurrence): boolean {
  const { width, height } = image;
  const pixels = width * height;
  if (width < 280 || height < 280 || width > 1568 || height > 1568)
    return false;
  return pixels >= 78400 && pixels <= 2458624;
}
export function validateJevImageDimensions(
  images: Occurrences,
  provider: string
): void {
  if (images.some((image) => !portableJevImage(image)))
    fail(
      "input",
      "images",
      `${provider}图片边长须 280–1568 且像素数 78400–2458624；不会自动缩放`
    );
}

function boundsJevImages(
  request: Request,
  config: Configuration,
  images: Occurrences
): boolean {
  return (
    images.length > 0 &&
    config.adapter !== "openai-decisions" &&
    request.model !== "openai/gpt-6-luna-decisions"
  );
}
export function validateDecodedImageBudget(
  request: Request,
  config: Configuration,
  images: Occurrences
): void {
  if (!boundsJevImages(request, config, images)) return;
  if (
    images.reduce((total, image) => total + image.bytes, 0) >
    maximumDecodedJevImageBytes
  )
    fail(
      "input",
      "images",
      "图片 occurrence 解码字节合计超过 32 MiB；服务处理后预算仍由服务校验"
    );
}
export function validateImageBodyBudget(
  body: string,
  request: Request,
  config: Configuration,
  images: Occurrences
): void {
  if (!boundsJevImages(request, config, images)) return;
  if (Buffer.byteLength(body, "utf8") > maximumJevImageBodyBytes)
    fail("input", "request", "图片请求 HTTP JSON 正文超过 32 MiB");
}

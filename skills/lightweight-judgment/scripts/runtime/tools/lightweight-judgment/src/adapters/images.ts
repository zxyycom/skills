/*
 * Synced TypeScript runtime; repository maintenance edits tools/lightweight-judgment/src/adapters/images.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/lightweight-judgment/src/adapters/images.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/lightweight-judgment/src/adapters/images.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/lightweight-judgment
 * Rebuild: bun run sync:lightweight-judgment-cli
 */
import { createHash } from "node:crypto";
import { fail } from "../failure.ts";
import { imageDimensions } from "./image-dimensions.ts";
import {
  orderedKeys,
  preserveKeyOrder,
  record,
  stringifyJson,
  type JsonValue
} from "../protocol/json.ts";
import type { Request } from "../protocol/request.ts";

export type ImageOccurrence = Readonly<{
  path: string;
  scope: "state" | "question";
  url: string;
  format: "png" | "jpeg";
  base64: string;
  bytes: number;
  width: number;
  height: number;
  reference: string;
}>;
export type Images = Readonly<{
  occurrences: readonly ImageOccurrence[];
  replace(value: JsonValue, path: string): JsonValue;
}>;

const maximumDecodedImageBytes = 16 * 1024 * 1024;

function imageUrl(value: Readonly<Record<string, unknown>>): string {
  const invalid = () =>
    fail(
      "input",
      "images",
      "图片节点必须为 {type:image_url,image_url:{url:内联PNG/JPEG data URL}}"
    );
  if (Object.keys(value).length !== 2 || value.type !== "image_url") invalid();
  const image = value.image_url;
  if (!record(image)) return invalid();
  if (Object.keys(image).length !== 1 || typeof image.url !== "string")
    return invalid();
  return image.url;
}

function canonicalImageBytes(base64: string): Buffer {
  // Bound decoded allocation before Buffer is created; providers still validate full image pixels.
  if (base64.length > Math.ceil(maximumDecodedImageBytes / 3) * 4)
    fail("input", "images", "单张图片解码后不得超过 16 MiB");
  // A flat character scan has no input-sized regexp backtracking stack. Canonical
  // re-encoding below additionally checks padding placement and unused pad bits.
  if (
    base64.length === 0 ||
    base64.length % 4 !== 0 ||
    /[^A-Za-z0-9+/=]/u.test(base64)
  )
    fail("input", "images", "图片 Base64 字符或长度无效");
  const bytes = Buffer.from(base64, "base64");
  if (
    bytes.toString("base64") !== base64 ||
    bytes.length > maximumDecodedImageBytes
  )
    fail("input", "images", "图片 Base64 非规范或超过 16 MiB");
  return bytes;
}

function decodeNode(
  value: Readonly<Record<string, unknown>>
): Omit<ImageOccurrence, "path" | "scope" | "reference"> {
  const url = imageUrl(value);
  const match = /^data:image\/(png|jpeg);base64,/u.exec(url);
  if (match === null)
    fail(
      "input",
      "images",
      "仅接受标准 Base64 内联 PNG/JPEG，不读取路径或远程 URL"
    );
  const format = match[1] === "png" ? "png" : "jpeg";
  const base64 = url.slice(match[0].length);
  const bytes = canonicalImageBytes(base64);
  const { width, height } = imageDimensions(bytes, format);
  if (width === 0 || height === 0)
    fail("input", "images", "图片尺寸须为正整数");
  return { url, format, base64, bytes: bytes.length, width, height };
}

export function scanImages(request: Request, enabled: boolean): Images {
  const source = stringifyJson(request);
  const strings: string[] = [];
  function collect(value: JsonValue): void {
    if (typeof value === "string") strings.push(value);
    else if (Array.isArray(value)) value.forEach(collect);
    else if (record(value))
      for (const key of orderedKeys(value)) {
        strings.push(key);
        collect(value[key]);
      }
  }
  collect(request);
  const occurrences: ImageOccurrence[] = [];
  const byPath = new Map<string, ImageOccurrence>();
  function visit(
    value: JsonValue,
    path: string,
    scope: ImageOccurrence["scope"]
  ): void {
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${path}[${index}]`, scope));
      return;
    }
    if (!record(value)) return;
    if (
      value.type === "image_url" ||
      value.type === "input_image" ||
      Object.hasOwn(value, "image_url")
    ) {
      if (!enabled)
        fail(
          "input",
          "images",
          "发现图片节点；需要可信配置 images=true，关闭时不会原样透传"
        );
      const node = decodeNode(value);
      let salt = 0;
      let reference: string;
      do {
        const hex = createHash("sha256")
          .update(source)
          .update(`:${occurrences.length}:${salt++}`)
          .digest("hex");
        reference = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
      } while (
        strings.some((text) => text.includes(reference)) ||
        occurrences.some((image) => image.reference === reference)
      );
      const image = { ...node, path, scope, reference };
      occurrences.push(image);
      byPath.set(path, image);
      return;
    }
    for (const key of orderedKeys(value))
      visit(value[key], `${path}[${JSON.stringify(key)}]`, scope);
  }
  visit(request.state, '$["state"]', "state");
  for (const id of orderedKeys(request.questions)) {
    const question = request.questions[id];
    const path = `$["questions"][${JSON.stringify(id)}]`;
    visit(question.instructions, `${path}["instructions"]`, "question");
    if ("criteria" in question && question.criteria !== undefined)
      visit(question.criteria, `${path}["criteria"]`, "question");
  }
  function replace(value: JsonValue, path: string): JsonValue {
    const image = byPath.get(path);
    if (image !== undefined) return image.reference;
    if (Array.isArray(value))
      return value.map((item, index) => replace(item, `${path}[${index}]`));
    if (!record(value)) return value;
    const result: Record<string, JsonValue> = Object.create(null);
    const keys = orderedKeys(value);
    for (const key of keys)
      result[key] = replace(value[key], `${path}[${JSON.stringify(key)}]`);
    preserveKeyOrder(result, keys);
    return result;
  }
  return { occurrences, replace };
}

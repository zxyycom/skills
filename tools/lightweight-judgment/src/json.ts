import { fail, type FailureKind } from "./failure.ts";
import { parseNumber } from "./json-number.ts";

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | readonly JsonValue[]
  | JsonObject;

export type JsonObject = { readonly [key: string]: JsonValue };
import { preserveKeyOrder } from "./json-order.ts";
export { orderedKeys, preserveKeyOrder, stringifyJson } from "./json-order.ts";

const literalToken = /^(?:true|false|null)/u;

const numberToken = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/u;
// A local parser owns cursor/depth/key order, before JSON.parse can discard lexical information.
class JsonParser {
  private cursor = 0;
  constructor(
    private readonly text: string,
    private readonly kind: FailureKind
  ) {}
  private error(path: string, reason: string): never {
    return fail(this.kind, path, reason);
  }
  private space(): void {
    while (/[\t\n\r ]/u.test(this.text[this.cursor] ?? "x")) {
      this.cursor++;
    }
  }
  private string(path: string): string {
    const start = this.cursor++;
    while (this.cursor < this.text.length) {
      const char = this.text[this.cursor++];
      if (char === "\\") {
        this.cursor++;
        continue;
      }
      if (char !== '"') {
        continue;
      }
      try {
        const value: unknown = JSON.parse(this.text.slice(start, this.cursor));
        if (typeof value === "string") {
          return value;
        }
      } catch {
        return this.error(path, "非法 JSON 字符串");
      }
    }
    return this.error(path, "JSON 字符串未结束");
  }
  private nextMember(close: string, path: string): boolean {
    this.space();
    if (this.text[this.cursor] === close) {
      this.cursor++;
      return false;
    }
    if (this.text[this.cursor++] !== ",") {
      this.error(path, "缺少逗号或结束符");
    }
    this.space();
    return true;
  }
  private empty(close: string): boolean {
    this.cursor++;
    this.space();
    if (this.text[this.cursor] !== close) {
      return false;
    }
    this.cursor++;
    return true;
  }
  private object(path: string, depth: number): JsonValue {
    const result: Record<string, JsonValue> = {};
    const keys: string[] = [];
    const seen = new Set<string>();
    if (this.empty("}")) {
      preserveKeyOrder(result, keys);
      return result;
    }
    do {
      if (this.text[this.cursor] !== '"') {
        this.error(path, "对象键必须是字符串");
      }
      const key = this.string(path);
      const child = `${path}[${JSON.stringify(key)}]`;
      if (seen.has(key)) {
        this.error(child, "重复对象键");
      }
      seen.add(key);
      keys.push(key);
      this.space();
      if (this.text[this.cursor++] !== ":") {
        this.error(child, "缺少冒号");
      }
      Object.defineProperty(result, key, {
        value: this.value(child, depth + 1),
        enumerable: true,
        writable: true,
        configurable: true
      });
    } while (this.nextMember("}", path));
    preserveKeyOrder(result, keys);
    return result;
  }
  private array(path: string, depth: number): JsonValue {
    const result: JsonValue[] = [];
    if (this.empty("]")) {
      return result;
    }
    do {
      result.push(this.value(`${path}[${result.length}]`, depth + 1));
    } while (this.nextMember("]", path));
    return result;
  }
  private scalar(path: string): JsonValue {
    const tail = this.text.slice(this.cursor);
    const literal = literalToken.exec(tail);
    if (literal) {
      this.cursor += literal[0].length;
      switch (literal[0]) {
        case "true":
          return true;
        case "false":
          return false;
        default:
          return null;
      }
    }
    const number = numberToken.exec(tail);
    if (!number) {
      return this.error(path, "非法 JSON 值");
    }
    this.cursor += number[0].length;
    return parseNumber(number[0], this.kind, path);
  }
  private value(path: string, depth: number): JsonValue {
    if (depth > 128) {
      this.error(path, "JSON 嵌套超过 128 层");
    }
    this.space();
    switch (this.text[this.cursor]) {
      case '"':
        return this.string(path);
      case "{":
        return this.object(path, depth);
      case "[":
        return this.array(path, depth);
      default:
        return this.scalar(path);
    }
  }
  parse(label: string): JsonValue {
    const result = this.value(label, 0);
    this.space();
    if (this.cursor !== this.text.length) {
      this.error(label, "只接受单个 JSON 值");
    }
    return result;
  }
}

export function parseJson(
  text: string,
  kind: FailureKind = "input",
  label = "$"
): JsonValue {
  return new JsonParser(text, kind).parse(label);
}

export function record(
  value: unknown
): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function hasOnlyFields(
  value: unknown,
  fields: readonly string[]
): value is Readonly<Record<string, unknown>> {
  return (
    record(value) && Object.keys(value).every((key) => fields.includes(key))
  );
}

/*
 * Synced TypeScript runtime; repository maintenance edits tools/lightweight-judgment/src/adapters/adapter-contract.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/lightweight-judgment/src/adapters/adapter-contract.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/lightweight-judgment/src/adapters/adapter-contract.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/lightweight-judgment
 * Rebuild: bun run sync:lightweight-judgment-cli
 */
import { fail, type FailureKind } from "../failure.ts";

export const adapters = [
  "openrouter-systemone",
  "typesafe",
  "openrouter-decisions",
  "openai-decisions"
] as const;
export type Adapter = (typeof adapters)[number];
export type AdapterContract = `${Adapter}/v1`;
export function adapterContract(adapter: Adapter): AdapterContract {
  return `${adapter}/v1`;
}
const modelPatterns: Readonly<Record<Adapter, RegExp>> = {
  "openai-decisions": /^gpt-6-luna$/u,
  typesafe: /^jev-[a-zA-Z0-9][a-zA-Z0-9._-]*$/u,
  "openrouter-decisions":
    /^(?:typesafe\/jev-[a-zA-Z0-9][a-zA-Z0-9._-]*|openai\/gpt-6-luna-decisions)$/u,
  "openrouter-systemone": /^(?:~?typesafe\/)?jev-[a-zA-Z0-9][a-zA-Z0-9._-]*$/u
};

export function validateAdapterModel(
  value: unknown,
  adapter: Adapter,
  kind: FailureKind,
  location: string
): string {
  if (typeof value !== "string" || !modelPatterns[adapter].test(value))
    fail(kind, location, "模型标识不符合所选 adapter 的模型合同");
  return value;
}

/*
 * Synced TypeScript runtime; repository maintenance edits tools/agent-memory/src/errors.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/agent-memory/src/errors.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/agent-memory/src/errors.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/agent-memory
 * Rebuild: bun run sync:agent-memory-cli
 */
export class MemoryError extends Error {}

export function fail(message: string): never {
  throw new MemoryError(message);
}

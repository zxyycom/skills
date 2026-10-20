/*
 * Synced TypeScript runtime; repository maintenance edits tools/shared/src/node/bytes.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/shared/src/node/bytes.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/shared/src/node/bytes.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/investigation-report
 * Rebuild: bun run sync:investigation-report-check
 */
import { Buffer } from "node:buffer";

/** Compare views without allocating copies of their backing payloads. */
export function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  return Buffer.from(left.buffer, left.byteOffset, left.byteLength).equals(
    Buffer.from(right.buffer, right.byteOffset, right.byteLength)
  );
}

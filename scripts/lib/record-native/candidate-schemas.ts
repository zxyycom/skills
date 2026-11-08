import { extractNativeArchive } from "../../../tools/skill-updater/src/native/archive.ts";
import type { NativeRole } from "../../../tools/skill-package/src/native-release-manifest.ts";

export function schemaFile(role: NativeRole): string {
  return role === "decision-records"
    ? "decision-index.schema.json"
    : "investigation-index.schema.json";
}
/** Compare the delivered schema with the independently frozen authority. */
export function validateCandidateSchema(
  role: NativeRole,
  archive: Uint8Array,
  expected: Uint8Array
): void {
  const name = schemaFile(role);
  const actual = extractNativeArchive(archive).get(
    `${role}/references/${name}`
  );
  if (!actual || !actual.equals(Buffer.from(expected)))
    throw new Error(`candidate schema differs from frozen authority: ${role}`);
  const parsed: unknown = JSON.parse(
    new TextDecoder("utf-8", { fatal: true }).decode(expected)
  );
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    throw new Error(`candidate schema is invalid JSON object: ${role}`);
}

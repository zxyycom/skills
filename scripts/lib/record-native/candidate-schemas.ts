import { extractNativeArchive } from "../../../tools/skill-updater/src/native/archive.ts";
import {
  nativeSchemaFiles,
  type NativeRole
} from "../../../tools/skill-package/src/native-release-manifest.ts";

/** Compare every delivered schema with its independently frozen authority. */
export function validateCandidateSchema(
  role: NativeRole,
  archive: Uint8Array,
  expected: readonly Uint8Array[]
): void {
  const contents = extractNativeArchive(archive);
  if (expected.length !== nativeSchemaFiles[role].length)
    throw new Error(`candidate schema count mismatch: ${role}`);
  for (const [index, name] of nativeSchemaFiles[role].entries()) {
    const bytes = expected[index]!;
    const actual = contents.get(`${role}/references/${name}`);
    if (!actual || !actual.equals(Buffer.from(bytes)))
      throw new Error(
        `candidate schema differs from frozen authority: ${role}/${name}`
      );
    const parsed: unknown = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(bytes)
    );
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      throw new Error(
        `candidate schema is invalid JSON object: ${role}/${name}`
      );
  }
}

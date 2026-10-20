/*
 * Synced TypeScript runtime; repository maintenance edits tools/test-evidence/src/core-support.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/test-evidence/src/core-support.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/test-evidence/src/core-support.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/test-evidence-review
 * Rebuild: bun run sync:test-evidence-cli
 */
import { createHash } from "node:crypto";
import type { TestEvidenceDiagnostic } from "./core-schemas.ts";

export const diagnostic = (
  category: TestEvidenceDiagnostic["category"],
  code: string,
  message: string,
  extra: Omit<
    TestEvidenceDiagnostic,
    "blocking" | "category" | "code" | "message"
  > = {}
): TestEvidenceDiagnostic => ({
  blocking: true,
  category,
  code,
  message,
  ...extra
});
export const fingerprint = (value: string): string =>
  `sha256:${createHash("sha256").update(value, "utf8").digest("hex")}`;
export const sourcePath = (member: string): string => `cases/${member}`;

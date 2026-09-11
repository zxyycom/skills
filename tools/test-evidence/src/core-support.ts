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

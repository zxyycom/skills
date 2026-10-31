/*
 * Synced TypeScript runtime; repository maintenance edits tools/investigation-report/src/candidates/candidate-format.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/investigation-report/src/candidates/candidate-format.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/investigation-report/src/candidates/candidate-format.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/investigation-report
 * Rebuild: bun run sync:investigation-report-check
 */
import { serializeInvestigationReportFrontmatter } from "../records/markdown.ts";
import type { PreparedInvestigationCandidateCreateOptions } from "./create/candidate-creation-input.ts";
export function serializeInvestigationCandidate(
  input: Pick<
    PreparedInvestigationCandidateCreateOptions,
    "formedAt" | "id" | "question" | "relations" | "tags" | "title"
  >
): string {
  return [
    serializeInvestigationReportFrontmatter(input),
    "",
    "## 形成时背景",
    "",
    "## 调查目的",
    "",
    "## 调查范围与依据",
    "",
    "## 调查结果与边界",
    ""
  ].join("\n");
}

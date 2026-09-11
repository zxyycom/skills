import { serializeInvestigationReportFrontmatter } from "./markdown.ts";
import type { InvestigationCandidateCreateOptions } from "./types.ts";
export function serializeInvestigationCandidate(
  input: Pick<
    InvestigationCandidateCreateOptions,
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

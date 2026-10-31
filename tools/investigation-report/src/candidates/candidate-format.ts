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

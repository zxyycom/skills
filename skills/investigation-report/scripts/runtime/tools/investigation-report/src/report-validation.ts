/*
 * Synced TypeScript runtime; repository maintenance edits tools/investigation-report/src/report-validation.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/investigation-report/src/report-validation.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/investigation-report/src/report-validation.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/investigation-report
 * Rebuild: bun run sync:investigation-report-check
 */
import { compareInvestigationRelations } from "./markdown.ts";
import { investigationNameFromId } from "./report-path.ts";
import { validateInvestigationReportContent } from "./report-validation-content.ts";
import type {
  InvestigationIndexState,
  InvestigationRelation,
  InvestigationRelationType,
  ParsedInvestigationReport
} from "./types.ts";
import { investigationRelationTypes } from "./types.ts";

export type InvestigationReportStateBuildResult =
  | Readonly<{ errors: string[]; state: null; status: "invalid" }>
  | Readonly<{ errors: []; state: InvestigationIndexState; status: "valid" }>;

export function buildInvestigationReportState(
  id: string,
  report: ParsedInvestigationReport,
  sourcePath: string
): InvestigationReportStateBuildResult {
  const errors = [...report.errors];
  if (report.report === null) return invalidResult(errors);
  errors.push(
    ...validateInvestigationReportContent(id, report.report, sourcePath)
  );
  if (errors.length > 0) return invalidResult(errors);
  return {
    errors: [],
    state: {
      formedAt: report.report.formedAt,
      name: investigationNameFromId(id),
      question: report.report.question,
      relations: [...report.report.relations],
      resourceIds: [...report.report.resourceIds],
      sourcePath,
      tags: [...report.report.tags],
      title: report.report.title
    },
    status: "valid"
  };
}

export function isInvestigationRelationType(
  value: string
): value is InvestigationRelationType {
  return (investigationRelationTypes as readonly string[]).includes(value);
}

export function areCanonicalRelations(
  relations: readonly InvestigationRelation[]
): boolean {
  return relations.every((relation, index) => {
    const previous = relations[index - 1];
    return (
      previous === undefined ||
      compareInvestigationRelations(previous, relation) < 0
    );
  });
}

function invalidResult(
  errors: readonly string[]
): InvestigationReportStateBuildResult {
  return {
    errors: [...new Set(errors)].sort(compareText),
    state: null,
    status: "invalid"
  };
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

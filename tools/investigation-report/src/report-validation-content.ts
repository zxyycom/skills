import { investigationTimestampMilliseconds } from "./timestamp.ts";
import {
  isInvestigationId,
  isInvestigationSourcePath,
  isInvestigationTag,
  parseDatedInvestigationId,
  utcInvestigationDate
} from "./report-path.ts";
import {
  areCanonicalRelations,
  isInvestigationRelationType
} from "./report-validation.ts";
import { isInvestigationRelationSummary } from "./relation-summary.ts";
import type { ParsedInvestigationReportDocument } from "./types.ts";

export function validateInvestigationReportContent(
  id: string,
  document: ParsedInvestigationReportDocument,
  sourcePath: string
): string[] {
  return [
    ...identityErrors(id, document.id, sourcePath),
    ...timestampErrors(id, document.formedAt),
    ...tagErrors(id, document.tags),
    ...relationErrors(id, document.relations)
  ];
}

function identityErrors(
  id: string,
  declaredId: string,
  sourcePath: string
): string[] {
  const errors: string[] = [];
  if (!isInvestigationId(id))
    errors.push(`${id || "<empty>"} must use a valid Investigation ID`);
  if (!isInvestigationSourcePath(sourcePath))
    errors.push(
      `${sourcePath || "<empty>"} must use a valid Investigation sourcePath`
    );
  if (declaredId !== id)
    errors.push(
      `${id} frontmatter id does not match the expected Investigation ID`
    );
  return errors;
}

function timestampErrors(id: string, formedAt: string): string[] {
  const errors: string[] = [];
  if (investigationTimestampMilliseconds(formedAt) === null)
    errors.push(
      `${id} formedAt must use an RFC 3339 timestamp with timezone and second precision`
    );
  const dated = parseDatedInvestigationId(id);
  if (dated !== null && dated.date !== utcInvestigationDate(formedAt))
    errors.push(`${id} standard ID date must match formedAt UTC date`);
  return errors;
}

function tagErrors(id: string, tags: readonly string[]): string[] {
  const errors: string[] = [];
  if (tags.length === 0 || tags.some((tag) => !isInvestigationTag(tag)))
    errors.push(`${id} tags must contain valid kebab-case tokens`);
  if (!isStrictlySorted(tags))
    errors.push(`${id} tags must be unique and sorted lexically`);
  return errors;
}

function relationErrors(
  id: string,
  relations: ParsedInvestigationReportDocument["relations"]
): string[] {
  const errors: string[] = [];
  if (!areCanonicalRelations(relations))
    errors.push(
      `${id} relations must be unique and sorted by type then target`
    );
  for (const relation of relations) {
    if (
      !isInvestigationRelationType(relation.type) ||
      !isInvestigationId(relation.target) ||
      (relation.summary !== undefined &&
        !isInvestigationRelationSummary(relation.summary))
    ) {
      errors.push(
        `${id} relations must use known types, valid Investigation ID targets, and optional normalized summaries`
      );
    }
  }
  return errors;
}

function isStrictlySorted(values: readonly string[]): boolean {
  return values.every(
    (value, index) => index === 0 || values[index - 1]! < value
  );
}

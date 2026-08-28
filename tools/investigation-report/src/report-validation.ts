import { investigationTimestampMilliseconds } from "./timestamp.ts";
import { isInvestigationId, isInvestigationTag } from "./report-path.ts";
import {
  compareInvestigationRelations,
  parseInvestigationReport
} from "./markdown.ts";
import {
  investigationRelationTypes,
  type InvestigationIndexState,
  type InvestigationRelation,
  type InvestigationRelationType,
  type ParsedInvestigationReport
} from "./types.ts";

export type InvestigationReportStateBuildResult =
  | Readonly<{ errors: string[]; state: null; status: "invalid" }>
  | Readonly<{ errors: []; state: InvestigationIndexState; status: "valid" }>;

export function buildInvestigationReportState(
  id: string,
  report: ParsedInvestigationReport
): InvestigationReportStateBuildResult {
  const errors = [...report.errors];
  if (!isInvestigationId(id)) {
    errors.push(`${id || "<empty>"} must use a valid Investigation ID`);
  }
  if (report.report === null) {
    return { errors: uniqueSorted(errors), state: null, status: "invalid" };
  }
  const document = report.report;
  if (investigationTimestampMilliseconds(document.formedAt) === null) {
    errors.push(
      `${id} formedAt must use an RFC 3339 timestamp with timezone and second precision`
    );
  }
  if (
    document.tags.length === 0 ||
    document.tags.some((tag) => !isInvestigationTag(tag))
  ) {
    errors.push(`${id} tags must contain valid kebab-case tokens`);
  }
  if (!isStrictlySorted(document.tags)) {
    errors.push(`${id} tags must be unique and sorted lexically`);
  }
  if (!areCanonicalRelations(document.relations)) {
    errors.push(
      `${id} relations must be unique and sorted by type then target`
    );
  }
  for (const relation of document.relations) {
    if (
      !isInvestigationRelationType(relation.type) ||
      !isInvestigationId(relation.target)
    ) {
      errors.push(
        `${id} relations must use known types and valid Investigation ID targets`
      );
    }
  }
  const sortedErrors = uniqueSorted(errors);
  if (sortedErrors.length > 0) {
    return { errors: sortedErrors, state: null, status: "invalid" };
  }
  return {
    errors: [],
    state: {
      formedAt: document.formedAt,
      question: document.question,
      relations: [...document.relations],
      resourceIds: [...document.resourceIds],
      tags: [...document.tags],
      title: document.title
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

export function parseAndBuildInvestigationReportState(
  id: string,
  text: string
): InvestigationReportStateBuildResult {
  return buildInvestigationReportState(id, parseInvestigationReport(text, id));
}

function isStrictlySorted(values: readonly string[]): boolean {
  return values.every(
    (value, index) => index === 0 || values[index - 1]! < value
  );
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareText);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

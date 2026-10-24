/*
 * Synced TypeScript runtime; repository maintenance edits tools/investigation-report/src/candidate-creation-input.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/investigation-report/src/candidate-creation-input.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/investigation-report/src/candidate-creation-input.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/investigation-report
 * Rebuild: bun run sync:investigation-report-check
 */
import { err, ok, type Result } from "neverthrow";
import { candidatePathForInvestigationId } from "./candidate-path.ts";
import { parseInvestigationCandidateCreateOptions } from "./options.ts";
import {
  datedInvestigationIdForName,
  investigationNameFromId,
  isInvestigationId,
  isInvestigationTag,
  parseDatedInvestigationId,
  resolveInvestigationsDirectory,
  type ResolvedInvestigationsDirectory
} from "./report-path.ts";
import { isInvestigationRelationType } from "./report-validation.ts";
import {
  currentInvestigationTimestamp,
  investigationTimestampMilliseconds
} from "./timestamp.ts";
import {
  bindInvestigationRelationSummaries,
  type InvestigationRelationSummaryInput
} from "./relation-summary.ts";
import { investigationRelationTypes } from "./types.ts";
import type {
  InvestigationCandidateCreateOptions,
  InvestigationRelation
} from "./types.ts";
import { compareText, uniqueSorted } from "./candidate-support.ts";

export type PreparedInvestigationCandidateCreateOptions = Readonly<
  Omit<InvestigationCandidateCreateOptions, "formedAt"> & { formedAt: string }
>;
export type PreparedCandidateCreate = Readonly<{
  candidate: PreparedInvestigationCandidateCreateOptions;
  resolved: ResolvedInvestigationsDirectory;
}>;
export function prepareCandidateCreate(
  input: unknown,
  currentTimestamp: () => string = currentInvestigationTimestamp
): Result<PreparedCandidateCreate, string[]> {
  const parsed = parseInvestigationCandidateCreateOptions(input);
  if (parsed.isErr()) return err(parsed.error);
  const candidate: PreparedInvestigationCandidateCreateOptions = {
    ...parsed.value,
    formedAt: parsed.value.formedAt ?? currentTimestamp()
  };
  const normalized = normalizeNewCandidateIdentity(candidate);
  const resolved = resolveInvestigationsDirectory(
    parsed.value.workspaceRoot,
    parsed.value.investigationsDir
  );
  if (normalized.errors.length > 0 || resolved.isErr())
    return err(
      uniqueSorted([
        ...normalized.errors,
        ...(resolved.isErr() ? resolved.error : [])
      ])
    );
  return ok({
    candidate: canonicalCandidateCreateOptions(normalized.candidate),
    resolved: resolved.value
  });
}
export function resolveCandidateRelationSelectors(
  candidate: PreparedInvestigationCandidateCreateOptions,
  availableIds: readonly string[],
  summaryInputs: readonly InvestigationRelationSummaryInput[]
):
  | {
      candidate: PreparedInvestigationCandidateCreateOptions;
      status: "ok";
    }
  | { errors: string[]; status: "error" } {
  const relations: InvestigationRelation[] = [];
  for (const relation of candidate.relations) {
    const target = resolveCandidateRelationSelector(
      availableIds,
      relation.target,
      "relation"
    );
    if ("error" in target) return { errors: [target.error], status: "error" };
    relations.push({ ...relation, target: target.id });
  }
  const summaries: InvestigationRelationSummaryInput[] = [];
  for (const summary of summaryInputs) {
    const target = resolveCandidateRelationSelector(
      availableIds,
      summary.target,
      "relation-summary"
    );
    if ("error" in target) return { errors: [target.error], status: "error" };
    summaries.push({ ...summary, target: target.id });
  }
  const bound = bindInvestigationRelationSummaries(relations, summaries);
  if ("error" in bound) return { errors: [bound.error], status: "error" };
  const resolved = { ...candidate, relations: bound.relations };
  const errors = validateCandidateCreateOptions(resolved);
  return errors.length === 0
    ? { candidate: resolved, status: "ok" }
    : { errors, status: "error" };
}
function resolveCandidateRelationSelector(
  availableIds: readonly string[],
  selector: string,
  label: "relation" | "relation-summary"
): { id: string } | { error: string } {
  const dated = parseDatedInvestigationId(selector);
  if (dated !== null) return { id: dated.id };
  const matches = availableIds
    .filter((id) => investigationNameFromId(id) === selector)
    .sort(compareText);
  return matches.length === 1
    ? { id: matches[0]! }
    : {
        error:
          matches.length === 0
            ? `candidate ${label} target does not exist: ${selector}`
            : `candidate ${label} target is ambiguous: ${selector}; choose one standard ID: ${matches.join(", ")}`
      };
}
function normalizeNewCandidateIdentity(
  candidate: PreparedInvestigationCandidateCreateOptions
): {
  candidate: PreparedInvestigationCandidateCreateOptions;
  errors: string[];
} {
  const dated = parseDatedInvestigationId(candidate.id);
  const generated = datedInvestigationIdForName(
    candidate.id,
    candidate.formedAt
  );
  if (dated !== null)
    return datedInvestigationIdForName(dated.name, candidate.formedAt) ===
      candidate.id
      ? { candidate, errors: validateCandidateCreateOptions(candidate) }
      : {
          candidate,
          errors: [
            "standard Investigation ID date must match formedAt UTC date"
          ]
        };
  if (generated === null)
    return { candidate, errors: validateCandidateCreateOptions(candidate) };
  const normalized = {
    ...candidate,
    id: generated,
    relations: candidate.relations.map((relation) =>
      relation.target === candidate.id
        ? { ...relation, target: generated }
        : relation
    )
  };
  return {
    candidate: normalized,
    errors: validateCandidateCreateOptions(normalized)
  };
}
export async function allocateCandidatePath(
  investigationsDirectory: string,
  id: string
): Promise<string> {
  return candidatePathForInvestigationId(investigationsDirectory, id);
}
export function validateCandidateCreateOptions(
  candidate: PreparedInvestigationCandidateCreateOptions
): string[] {
  return uniqueSorted([
    ...candidateIdentityErrors(candidate),
    ...candidateTagErrors(candidate.tags),
    ...candidateRelationErrors(candidate.id, candidate.relations)
  ]);
}

function candidateIdentityErrors(
  candidate: PreparedInvestigationCandidateCreateOptions
): string[] {
  const errors: string[] = [];
  if (!isInvestigationId(candidate.id)) {
    errors.push(`${candidate.id || "<empty>"} must use an Investigation ID`);
  }
  for (const [name, value] of [
    ["title", candidate.title],
    ["question", candidate.question]
  ] as const) {
    if (!isNonEmptySingleLineText(value)) {
      errors.push(`${name} must be a non-empty single-line string`);
    }
  }
  if (investigationTimestampMilliseconds(candidate.formedAt) === null) {
    errors.push(
      "formedAt must use an RFC 3339 timestamp with timezone and second precision"
    );
  }
  return errors;
}

function candidateTagErrors(tags: readonly string[]): string[] {
  const errors: string[] = [];
  if (tags.length === 0) {
    errors.push("tags must contain at least one tag");
  }
  if (tags.some((tag) => !isInvestigationTag(tag))) {
    errors.push("tags must contain valid kebab-case tokens");
  }
  if (new Set(tags).size !== tags.length) {
    errors.push("tags must not repeat a tag");
  }
  return errors;
}

function candidateRelationErrors(
  id: string,
  relations: readonly InvestigationRelation[]
): string[] {
  const errors: string[] = [];
  if (
    relations.some(
      (relation) =>
        !isInvestigationRelationType(relation.type) ||
        !isInvestigationId(relation.target)
    )
  ) {
    errors.push(
      "relations must use known types and valid Investigation ID targets"
    );
  }
  if (relations.some((relation) => relation.target === id)) {
    errors.push("relations must not target the candidate itself");
  }
  if (
    new Set(relations.map((relation) => relation.target)).size !==
    relations.length
  ) {
    errors.push("relations must not repeat a target");
  }
  return errors;
}
function isNonEmptySingleLineText(value: string): boolean {
  return (
    value.trim().length > 0 &&
    !/[\r\n]/u.test(value) &&
    !hasC0ControlCharacter(value)
  );
}
function hasC0ControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1)
    if (value.charCodeAt(index) <= 0x1f) return true;
  return false;
}
function canonicalCandidateCreateOptions(
  candidate: PreparedInvestigationCandidateCreateOptions
): PreparedInvestigationCandidateCreateOptions {
  return {
    ...candidate,
    relations: canonicalRelations(candidate.relations),
    tags: [...candidate.tags].sort(compareText)
  };
}
function canonicalRelations(
  relations: readonly InvestigationRelation[]
): InvestigationRelation[] {
  return [...relations].sort((left, right) => {
    const order =
      investigationRelationTypes.indexOf(left.type) -
      investigationRelationTypes.indexOf(right.type);
    return order === 0 ? compareText(left.target, right.target) : order;
  });
}

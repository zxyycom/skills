import { isDecisionId } from "./decision-path.ts";
import { normalizeRelationSummary } from "./relation-summary.ts";
import {
  decisionRelationTypes,
  type DecisionId,
  type DecisionRelation,
  type DecisionRelationType
} from "./types.ts";

const relationKeys = ["type", "target", "summary"] as const;
const relationTypeSet: ReadonlySet<unknown> = new Set(decisionRelationTypes);

type ParsedRelationCandidate = {
  relation: DecisionRelation;
  valid: boolean;
};

export function parseRelations(
  value: unknown,
  relativePath: string,
  errors: string[]
): DecisionRelation[] | null {
  if (!Array.isArray(value)) {
    errors.push(relativePath + " frontmatter relations must be an array");
    return null;
  }
  const relations: DecisionRelation[] = [];
  const seenTargets = new Set<DecisionId>();
  let valid = true;
  for (const [index, candidate] of value.entries()) {
    const parsed = parseRelationCandidate(
      candidate,
      index,
      relativePath,
      errors
    );
    if (parsed === null) {
      valid = false;
      continue;
    }
    if (seenTargets.has(parsed.relation.target)) {
      errors.push(
        relativePath + " repeats relationship target " + parsed.relation.target
      );
      valid = false;
      continue;
    }
    seenTargets.add(parsed.relation.target);
    relations.push(parsed.relation);
    valid &&= parsed.valid;
  }
  return valid ? relations : null;
}

function parseRelationCandidate(
  candidate: unknown,
  index: number,
  relativePath: string,
  errors: string[]
): ParsedRelationCandidate | null {
  if (!isRecord(candidate)) {
    errors.push(
      relativePath + ` frontmatter relations[${index}] must be an object`
    );
    return null;
  }
  const validOrder = validateRelationFieldOrder(
    candidate,
    index,
    relativePath,
    errors
  );
  const identity = parseRelationIdentity(
    candidate,
    index,
    relativePath,
    errors
  );
  const summary = parseRelationSummary(
    candidate.summary,
    index,
    relativePath,
    errors
  );
  return identity === null || summary === null
    ? null
    : { relation: { ...identity, ...summary }, valid: validOrder };
}

function parseRelationIdentity(
  candidate: Record<string, unknown>,
  index: number,
  relativePath: string,
  errors: string[]
): Pick<DecisionRelation, "target" | "type"> | null {
  if (!isDecisionRelationType(candidate.type)) {
    errors.push(relationTypeError(relativePath, index));
    return null;
  }
  if (!isDecisionId(candidate.target)) {
    errors.push(
      relativePath +
        ` frontmatter relations[${index}].target must be a Decision ID`
    );
    return null;
  }
  return { type: candidate.type, target: candidate.target };
}

function relationTypeError(relativePath: string, index: number): string {
  return (
    relativePath +
    ` frontmatter relations[${index}].type must be ` +
    decisionRelationTypes.join(", ")
  );
}

function validateRelationFieldOrder(
  candidate: Record<string, unknown>,
  index: number,
  relativePath: string,
  errors: string[]
): boolean {
  const keys = Object.keys(candidate);
  const expectedKeys =
    "summary" in candidate ? relationKeys : relationKeys.slice(0, 2);
  if (sameFieldOrder(keys, expectedKeys)) return true;
  errors.push(
    relativePath +
      ` frontmatter relations[${index}] fields must use order: ` +
      expectedKeys.join(", ")
  );
  return false;
}

function isDecisionRelationType(value: unknown): value is DecisionRelationType {
  return relationTypeSet.has(value);
}

function parseRelationSummary(
  value: unknown,
  index: number,
  relativePath: string,
  errors: string[]
): { summary?: string } | null {
  if (value === undefined) return {};
  if (typeof value !== "string") {
    errors.push(
      relativePath + ` frontmatter relations[${index}].summary must be a string`
    );
    return null;
  }
  const normalized = normalizeRelationSummary(value);
  if ("issue" in normalized) {
    errors.push(
      relativePath +
        ` frontmatter relations[${index}].summary ` +
        normalized.issue
    );
    return null;
  }
  return normalized;
}

function sameFieldOrder(
  actual: readonly string[],
  expected: readonly string[]
): boolean {
  return (
    actual.length === expected.length &&
    actual.every((value, index) => value === expected[index])
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

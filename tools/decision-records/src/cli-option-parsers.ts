import { InvalidArgumentError } from "commander";
import { decisionRelationTypes } from "./types.ts";
import { stateIndexQueryMaximumLimit } from "../../index-runtime/src/index.ts";
import type {
  DecisionAlignment,
  DecisionId,
  DecisionListAlignment,
  DecisionRelation,
  DecisionRelationOverride,
  DecisionRelationSummary,
  DecisionSuccessor,
  DecisionTag
} from "./types.ts";
import { isDecisionTag, normalizeDecisionIdInput } from "./decision-path.ts";
import { projectionTextIssue } from "./projection.ts";
import { normalizeRelationSummary } from "./relation-summary.ts";
import { isDecisionTimestamp } from "./decision-timestamp.ts";
import type { ParsedOptions } from "./cli-command-options.ts";

export function parseTraceDepth(value: string): number | "all" {
  if (value === "all") return "all";
  if (!/^(0|[1-9]\d*)$/.test(value)) {
    throw new InvalidArgumentError("must be a non-negative integer");
  }
  const depth = Number(value);
  if (!Number.isSafeInteger(depth)) {
    throw new InvalidArgumentError("must be a safe non-negative integer");
  }
  return depth;
}

export function parseTraceMaxRecords(value: string): number {
  if (!/^[1-9]\d*$/.test(value)) {
    throw new InvalidArgumentError("must be a positive integer");
  }
  const maxRecords = Number(value);
  if (!Number.isSafeInteger(maxRecords)) {
    throw new InvalidArgumentError("must be a positive safe integer");
  }
  return maxRecords;
}

export function parseListLimit(value: string): number {
  const limit = parseSafeNonNegativeInteger(value);
  if (limit < 1 || limit > stateIndexQueryMaximumLimit) {
    throw new InvalidArgumentError(
      `must be from 1 to ${stateIndexQueryMaximumLimit}`
    );
  }
  return limit;
}

export function parseListOffset(value: string): number {
  return parseSafeNonNegativeInteger(value);
}

function parseSafeNonNegativeInteger(value: string): number {
  if (!/^(0|[1-9]\d*)$/.test(value)) {
    throw new InvalidArgumentError("must be a non-negative integer");
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new InvalidArgumentError("must be a safe non-negative integer");
  }
  return parsed;
}

export function parseDecisionListTimestamp(value: string): string {
  if (!isDecisionTimestamp(value)) {
    throw new InvalidArgumentError(
      "must be an RFC 3339 timestamp with timezone and second precision"
    );
  }
  return value;
}

export function parseSingleDecisionId(
  value: string,
  previous?: DecisionId
): DecisionId {
  const decisionId = normalizeDecisionIdInput(value);
  if (decisionId === null) {
    throw new InvalidArgumentError(
      "Decision selector is invalid; must be extensionless kebab-case text"
    );
  }
  if (previous !== undefined) {
    throw new InvalidArgumentError("must not be repeated");
  }
  return decisionId;
}

export function parseDecisionIdList(
  value: string,
  previous: DecisionId[] = []
): DecisionId[] {
  const decisionId = normalizeDecisionIdInput(value);
  if (decisionId === null) {
    throw new InvalidArgumentError(
      "Decision selector is invalid; must be extensionless kebab-case text"
    );
  }
  if (previous.includes(decisionId)) {
    throw new InvalidArgumentError("must not repeat a Decision selector");
  }
  return [...previous, decisionId];
}

export function parseDecisionRelation(
  value: string,
  previous: DecisionRelation[] = []
): DecisionRelation[] {
  const separatorIndex = value.indexOf("=");
  if (separatorIndex <= 0 || separatorIndex === value.length - 1) {
    throw new InvalidArgumentError("must use <type>=<decision-selector>");
  }
  const relationTypeValue = value.slice(0, separatorIndex);
  const relationType = decisionRelationTypes.find(
    (candidate) => candidate === relationTypeValue
  );
  if (relationType === undefined) {
    throw new InvalidArgumentError(
      "type must be " + decisionRelationTypes.join(", ")
    );
  }
  const target = normalizeDecisionIdInput(value.slice(separatorIndex + 1));
  if (target === null) {
    throw new InvalidArgumentError(
      "target must be an extensionless Decision selector"
    );
  }
  if (previous.some((relation) => relation.target === target)) {
    throw new InvalidArgumentError(
      "must not repeat a direct predecessor target"
    );
  }
  return [...previous, { type: relationType, target }];
}

export function parseDecisionRelationSummary(
  value: string,
  previous: DecisionRelationSummary[] = []
): DecisionRelationSummary[] {
  const separatorIndex = value.indexOf("=");
  if (separatorIndex <= 0) {
    throw new InvalidArgumentError("must use <decision-selector>=<summary>");
  }
  const target = normalizeDecisionIdInput(value.slice(0, separatorIndex));
  if (target === null) {
    throw new InvalidArgumentError(
      "target must be an extensionless Decision selector"
    );
  }
  if (previous.some((relation) => relation.target === target)) {
    throw new InvalidArgumentError("must not repeat a relation-summary target");
  }
  const normalized = normalizeRelationSummary(value.slice(separatorIndex + 1));
  if ("issue" in normalized) {
    throw new InvalidArgumentError(normalized.issue);
  }
  return [...previous, { target, ...normalized }];
}

export function parseDecisionSuccessor(
  value: string,
  previous: DecisionSuccessor[] = []
): DecisionSuccessor[] {
  const separatorIndex = value.indexOf("=");
  if (separatorIndex <= 0 || separatorIndex === value.length - 1) {
    throw new InvalidArgumentError("must use <alignment>=<decision-selector>");
  }
  const alignmentValue = value.slice(0, separatorIndex);
  if (alignmentValue !== "aligned" && alignmentValue !== "unaligned") {
    throw new InvalidArgumentError("alignment must be aligned or unaligned");
  }
  const decisionId = normalizeDecisionIdInput(value.slice(separatorIndex + 1));
  if (decisionId === null) {
    throw new InvalidArgumentError(
      "decision ID must be extensionless kebab-case text"
    );
  }
  if (previous.some((successor) => successor.decisionId === decisionId)) {
    throw new InvalidArgumentError(
      "must not repeat a successor Decision selector"
    );
  }
  return [...previous, { alignment: alignmentValue, decisionId }];
}

export function parseDecisionTag(
  value: string,
  previous: DecisionTag[] = []
): DecisionTag[] {
  if (!isDecisionTag(value)) {
    throw new InvalidArgumentError("must be a kebab-case tag");
  }
  if (previous.includes(value)) {
    throw new InvalidArgumentError("must not repeat a tag");
  }
  return [...previous, value];
}

export function parseProjectionText(value: string): string {
  const normalized = value.trim();
  const issue = projectionTextIssue(normalized);
  if (issue !== null) {
    throw new InvalidArgumentError(issue);
  }
  return normalized;
}

export function decisionRelationOverride(
  options: Pick<
    ParsedOptions,
    "clearRelations" | "relation" | "relationSummary"
  >
): DecisionRelationOverride {
  if (options.clearRelations === true) {
    if (options.relationSummary !== undefined) {
      throw new InvalidArgumentError(
        "--relation-summary cannot be used with --clear-relations"
      );
    }
    return { kind: "replace", relations: [] };
  }
  if (options.relation === undefined) {
    if (options.relationSummary !== undefined) {
      throw new InvalidArgumentError(
        "--relation-summary requires at least one --relation"
      );
    }
    return { kind: "source" };
  }
  return {
    kind: "replace",
    relations: options.relation,
    ...(options.relationSummary === undefined
      ? {}
      : { relationSummaries: options.relationSummary })
  };
}

export function requiredDecisionAlignment(
  value: DecisionListAlignment | undefined
): DecisionAlignment {
  if (value === "aligned" || value === "unaligned") {
    return value;
  }
  throw new InvalidArgumentError("must be aligned or unaligned");
}

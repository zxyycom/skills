/*
 * Synced TypeScript runtime; repository maintenance edits tools/investigation-report/src/relations/transactions/relation-transaction-support.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/investigation-report/src/relations/transactions/relation-transaction-support.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/investigation-report/src/relations/transactions/relation-transaction-support.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/investigation-report
 * Rebuild: bun run sync:investigation-report-check
 */
import path from "node:path";
import { readRecordText } from "../../../../record-operations/src/source.ts";
import {
  genericInvestigationDiagnostic,
  sanitizeInvestigationDiagnosticText,
  type InvestigationDiagnostic,
  type InvestigationMutationDiagnostic
} from "../../diagnostics.ts";
import { investigationIndexFileName } from "../../index/investigation-state-index.ts";
import { normalizeInvestigationIdInput } from "../../collection/report-path.ts";
import { compareInvestigationRelations } from "../../records/markdown.ts";
import { createInvestigationSelectorResolver } from "../../collection/investigation-selector.ts";
import {
  bindInvestigationRelationSummaries,
  type InvestigationRelationSummaryInput
} from "../relation-summary.ts";
import type {
  InvestigationIndexState,
  InvestigationRelationReplacement,
  InvestigationRelationSetResult
} from "../../types.ts";

export type RelationPhase<T> =
  | { status: "ready"; value: T }
  | { result: InvestigationRelationSetResult; status: "result" };

export function relationPhaseResult<T>(
  result: InvestigationRelationSetResult
): RelationPhase<T> {
  return { result, status: "result" };
}

export function validateReplacements(
  replacements: readonly InvestigationRelationReplacement[]
): Readonly<{
  errors: string[];
  replacements: InvestigationRelationReplacement[];
  sourceIds: string[];
}> {
  const errors: string[] = [];
  const seen = new Set<string>();
  if (replacements.length === 0) {
    errors.push("set-relations requires at least one complete source group");
  }
  const normalized: InvestigationRelationReplacement[] = [];
  for (const replacement of replacements) {
    const normalizedReplacement = normalizeRelationReplacement(
      replacement,
      seen,
      errors
    );
    if (normalizedReplacement !== null) normalized.push(normalizedReplacement);
  }
  const sorted = normalized.sort((left, right) =>
    compareText(left.source, right.source)
  );
  return {
    errors: uniqueSorted(errors),
    replacements: sorted,
    sourceIds: sorted.map((replacement) => replacement.source)
  };
}

function normalizeRelationReplacement(
  replacement: InvestigationRelationReplacement,
  seen: Set<string>,
  errors: string[]
): InvestigationRelationReplacement | null {
  const source = normalizeInvestigationIdInput(replacement.source);
  if (source === null) {
    errors.push(
      `${replacement.source || "<empty>"} source must use an Investigation selector`
    );
    return null;
  }
  if (seen.has(source)) {
    errors.push(`${source} source appears more than once`);
    return null;
  }
  seen.add(source);
  return {
    relations: normalizedRelationTargets(source, replacement.relations, errors),
    source
  };
}

function normalizedRelationTargets(
  source: string,
  relations: InvestigationRelationReplacement["relations"],
  errors: string[]
): InvestigationRelationReplacement["relations"] {
  const targets = new Set<string>();
  const normalized: Array<
    InvestigationRelationReplacement["relations"][number]
  > = [];
  for (const relation of relations) {
    const target = normalizeInvestigationIdInput(relation.target);
    if (target === null) {
      errors.push(
        `${source} relation target ${relation.target || "<empty>"} must use an Investigation selector`
      );
      continue;
    }
    if (targets.has(target))
      errors.push(`${source} relations must not repeat target ${target}`);
    targets.add(target);
    normalized.push({ ...relation, target });
  }
  return normalized.sort(compareInvestigationRelations);
}

export function resolveRelationSelectors(
  replacements: readonly InvestigationRelationReplacement[],
  states: ReadonlyMap<string, InvestigationIndexState>,
  relationSummaryGroups: readonly (readonly InvestigationRelationSummaryInput[])[]
):
  | { replacements: InvestigationRelationReplacement[]; status: "ok" }
  | { errors: string[]; status: "error" } {
  const entries = [...states.entries()].map(([id, state]) => ({
    id,
    name: state.name
  }));
  const resolve = createInvestigationSelectorResolver(entries);
  const errors: string[] = [];
  const resolved: InvestigationRelationReplacement[] = [];
  for (const [replacementIndex, replacement] of replacements.entries()) {
    const source = resolve(replacement.source);
    if (source.status === "error") {
      errors.push(...source.errors);
      continue;
    }
    const relations = [];
    for (const relation of replacement.relations) {
      const target = resolve(relation.target);
      if (target.status === "error") {
        errors.push(...target.errors);
      } else {
        relations.push({ ...relation, target: target.id });
      }
    }
    const summaries: InvestigationRelationSummaryInput[] = [];
    for (const summary of relationSummaryGroups[replacementIndex] ?? []) {
      const target = resolve(summary.target);
      if (target.status === "error") {
        errors.push(...target.errors);
      } else {
        summaries.push({ ...summary, target: target.id });
      }
    }
    if (
      relations.length === replacement.relations.length &&
      summaries.length ===
        (relationSummaryGroups[replacementIndex]?.length ?? 0)
    ) {
      const bound = bindInvestigationRelationSummaries(relations, summaries);
      if ("error" in bound) {
        errors.push(bound.error);
      } else {
        resolved.push({ source: source.id, relations: bound.relations });
      }
    }
  }
  if (errors.length > 0)
    return { errors: uniqueSorted(errors), status: "error" };
  const validated = validateReplacements(resolved);
  return validated.errors.length === 0
    ? { replacements: validated.replacements, status: "ok" }
    : { errors: validated.errors, status: "error" };
}

export { writeInvestigationTextAtomically as writeTextAtomically } from "../../transactions/transaction-files.ts";

export async function readRegularText(filePath: string): Promise<string> {
  return await readRecordText(path.dirname(filePath), path.basename(filePath));
}

export function relationResult(
  changed: boolean,
  sourceIds: readonly string[],
  indexPath: string,
  errors: readonly string[],
  options: Readonly<{
    diagnostics?: readonly InvestigationDiagnostic[];
    mutation?: InvestigationMutationDiagnostic;
    preflight?: boolean;
    relationReview?: import("../../types.ts").InvestigationRelationReview;
  }> = {}
): InvestigationRelationSetResult {
  const sortedErrors = uniqueSorted(errors);
  return {
    changed,
    diagnostics:
      options.diagnostics === undefined
        ? sortedErrors.length === 0
          ? []
          : [
              genericInvestigationDiagnostic({
                code: "investigation-report.relation-update-failed",
                reason: sortedErrors.join("; "),
                recovery:
                  "correct the reported relation or collection problem, then retry the update",
                target: sourceIds.join(", ") || indexPath
              })
            ]
        : [...options.diagnostics],
    errors: sortedErrors,
    indexPath,
    ...(options.mutation === undefined ? {} : { mutation: options.mutation }),
    preflight: options.preflight === true,
    ...(options.relationReview === undefined
      ? {}
      : { relationReview: options.relationReview }),
    sourceIds: [...sourceIds].sort(compareText)
  };
}

export function relationMutation(
  outcome: InvestigationMutationDiagnostic["outcome"]
): InvestigationMutationDiagnostic {
  return { outcome, scope: "investigation report relation collection" };
}

export function isRelationResult(
  value: unknown
): value is InvestigationRelationSetResult {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray(Reflect.get(value, "errors")) &&
    Array.isArray(Reflect.get(value, "diagnostics")) &&
    typeof Reflect.get(value, "changed") === "boolean" &&
    Array.isArray(Reflect.get(value, "sourceIds"))
  );
}
export function defaultIndexPath(input: unknown): string {
  const root = rawStringField(input, "workspaceRoot") ?? ".";
  const dir =
    rawStringField(input, "investigationsDir") ?? "docs/investigations";
  return path.resolve(root, dir, investigationIndexFileName);
}
export function indexPathForOptions(options: {
  investigationsDir?: string;
  workspaceRoot: string;
}): string {
  return path.resolve(
    options.workspaceRoot,
    options.investigationsDir ?? "docs/investigations",
    investigationIndexFileName
  );
}
export function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareText);
}
export function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
export function errorText(error: unknown): string {
  return sanitizeInvestigationDiagnosticText(error);
}
export function rawStringField(
  input: unknown,
  field: string
): string | undefined {
  if (typeof input !== "object" || input === null || Array.isArray(input))
    return undefined;
  const value = Reflect.get(input, field);
  return typeof value === "string" ? value : undefined;
}

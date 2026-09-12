import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {
  genericInvestigationDiagnostic,
  sanitizeInvestigationDiagnosticText,
  type InvestigationDiagnostic,
  type InvestigationMutationDiagnostic
} from "./diagnostics.ts";
import { investigationIndexFileName } from "./investigation-state-index.ts";
import { normalizeInvestigationIdInput } from "./report-path.ts";
import { compareInvestigationRelations } from "./markdown.ts";
import { resolveInvestigationSelector } from "./investigation-selector.ts";
import {
  bindInvestigationRelationSummaries,
  type InvestigationRelationSummaryInput
} from "./relation-summary.ts";
import type {
  InvestigationIndexState,
  InvestigationRelationReplacement,
  InvestigationRelationSetResult
} from "./types.ts";
import type { InvestigationAtomicWriter } from "./relation-transaction.ts";

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
  const errors: string[] = [];
  const resolved: InvestigationRelationReplacement[] = [];
  for (const [replacementIndex, replacement] of replacements.entries()) {
    const source = resolveInvestigationSelector(entries, replacement.source);
    if (source.status === "error") {
      errors.push(...source.errors);
      continue;
    }
    const relations = [];
    for (const relation of replacement.relations) {
      const target = resolveInvestigationSelector(entries, relation.target);
      if (target.status === "error") {
        errors.push(...target.errors);
      } else {
        relations.push({ ...relation, target: target.id });
      }
    }
    const summaries: InvestigationRelationSummaryInput[] = [];
    for (const summary of relationSummaryGroups[replacementIndex] ?? []) {
      const target = resolveInvestigationSelector(entries, summary.target);
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

export async function writeTextAtomically(
  targetPath: string,
  text: string
): Promise<void> {
  await ensureRegularFile(targetPath);
  const temporaryPath = `${targetPath}.${process.pid}.${randomUUID()}.tmp`;
  const handle = await fs.open(temporaryPath, "wx", 0o600);
  try {
    await handle.writeFile(text, "utf8");
  } finally {
    await handle.close();
  }
  try {
    await fs.rename(temporaryPath, targetPath);
  } catch (error) {
    await fs.rm(temporaryPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

export async function restoreOriginalTexts(
  indexPath: string,
  originalIndexText: string,
  originalTextByPath: ReadonlyMap<string, string>,
  writtenPaths: readonly string[],
  write: InvestigationAtomicWriter
): Promise<string[]> {
  const errors: string[] = [];
  const paths = [...new Set(writtenPaths)]
    .filter((target) => target !== indexPath)
    .sort(compareText);
  for (const target of paths) {
    const original = originalTextByPath.get(target);
    if (original === undefined) continue;
    try {
      await write(target, original);
    } catch (error) {
      errors.push(`failed to restore report ${target}: ${errorText(error)}`);
    }
  }
  try {
    await write(indexPath, originalIndexText);
  } catch (error) {
    errors.push(
      `failed to restore investigation index ${indexPath}: ${errorText(error)}`
    );
  }
  return errors;
}

export async function readRegularText(filePath: string): Promise<string> {
  await ensureRegularFile(filePath);
  return await fs.readFile(filePath, "utf8");
}

export async function ensureRegularFile(filePath: string): Promise<void> {
  const entry = await fs.lstat(filePath);
  if (entry.isSymbolicLink() || !entry.isFile()) {
    throw new Error("must be a regular non-symbolic-link file");
  }
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
    relationReview?: import("./types.ts").InvestigationRelationReview;
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

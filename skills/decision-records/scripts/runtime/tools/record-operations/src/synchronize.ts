/*
 * Synced TypeScript runtime; repository maintenance edits tools/record-operations/src/synchronize.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/record-operations/src/synchronize.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/record-operations/src/synchronize.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
import {
  prepareStateIndexFromSnapshot,
  syncStateIndexPrepared
} from "../../index-runtime/src/prepared.ts";
import { isStateIndexText } from "../../index-runtime/src/index.ts";
import type {
  JsonObject,
  StateIndexContext,
  StateIndexDefinition,
  StateIndexDiagnostic,
  StateIndexSyncMode,
  StateIndexSyncResult,
  StateSnapshot
} from "../../index-runtime/src/types.ts";

export type RecordSelectorPolicy = Readonly<{
  label: "Decision" | "Investigation";
  codePrefix: "decision-records" | "investigation-report";
  normalize: (selector: string) => string;
  datedId: (selector: string) => string | null;
  nameFromId: (id: string) => string;
}>;
type ResolvedRecordSelectors = Readonly<{
  errors: StateIndexDiagnostic[];
  ids: string[];
}>;

/** 完整来源在领域边界验收；共同操作交接原生构建与独立 fresh/发布。 */
export async function synchronizeRecordIndex<
  State extends object,
  Metadata extends JsonObject
>(
  options: Readonly<{
    context: StateIndexContext;
    definition: StateIndexDefinition<State, Metadata>;
    indexPath: string;
    mode: StateIndexSyncMode;
    snapshot: StateSnapshot<State, Metadata>;
  }>
): Promise<StateIndexSyncResult> {
  const prepared = prepareStateIndexFromSnapshot(options);
  if (prepared.status === "error")
    return {
      changed: false,
      changedIds: [],
      diagnostics: prepared.diagnostics,
      indexPath: options.indexPath,
      mode: options.mode,
      namespace: options.definition.namespace,
      scope: "all",
      selectedIds: [],
      state: "source-invalid",
      status: "error"
    };
  return await syncStateIndexPrepared({
    context: options.context,
    definition: options.definition,
    indexPath: options.indexPath,
    mode: options.mode,
    prepared: prepared.value
  });
}

export function validateSelectors(
  selectors: readonly string[] | undefined,
  policy: RecordSelectorPolicy,
  indexPath: string
): StateIndexDiagnostic[] {
  const errors: StateIndexDiagnostic[] = [];
  const seen = new Set<string>();
  for (const selector of selectors ?? []) {
    if (typeof selector !== "string" || !isStateIndexText(selector))
      errors.push(
        selectorIssue(
          policy,
          "invalid",
          `Selected ${policy.label} selectors must be non-empty text without surrounding whitespace or control characters.`,
          typeof selector === "string" ? selector : indexPath
        )
      );
    else if (seen.has(selector))
      errors.push(
        selectorIssue(
          policy,
          "duplicate",
          `Selected ${policy.label} selector appears more than once: ${selector}`,
          selector
        )
      );
    else seen.add(selector);
  }
  return errors;
}

export function resolveSelectors(
  selectors: readonly string[],
  ids: ReadonlySet<string>,
  policy: RecordSelectorPolicy,
  indexPath: string,
  allowUnknownDated = false
): ResolvedRecordSelectors {
  const names = new Map<string, string[]>();
  for (const id of ids) {
    const name = policy.nameFromId(id);
    const matches = names.get(name) ?? [];
    matches.push(id);
    names.set(name, matches);
  }
  const selected: string[] = [];
  const errors: StateIndexDiagnostic[] = [];
  for (const raw of selectors) {
    const selector = policy.normalize(raw);
    const dated = policy.datedId(selector);
    const matches =
      allowUnknownDated && dated !== null
        ? [dated]
        : selectorMatches(selector, ids, names, policy);
    if (matches.length === 1) selected.push(matches[0]!);
    else errors.push(unresolvedSelector(policy, selector, matches));
  }

  if (new Set(selected).size !== selected.length)
    errors.push(
      selectorIssue(
        policy,
        "duplicate",
        `Selected ${policy.label} selectors resolve to the same ${policy.label} ID.`,
        indexPath
      )
    );
  return { errors, ids: selected.sort() };
}

function selectorMatches(
  selector: string,
  ids: ReadonlySet<string>,
  names: ReadonlyMap<string, string[]>,
  policy: RecordSelectorPolicy
): string[] {
  const dated = policy.datedId(selector);
  if (dated === null) return (names.get(selector) ?? []).sort();
  return ids.has(dated) ? [dated] : [];
}

function unresolvedSelector(
  policy: RecordSelectorPolicy,
  selector: string,
  matches: readonly string[]
): StateIndexDiagnostic {
  const missing = matches.length === 0;
  return selectorIssue(
    policy,
    missing ? "not-found" : "ambiguous",
    missing
      ? `${policy.label} selector does not resolve in the baseline or current collection: ${selector}`
      : `${policy.label} name is ambiguous: ${selector}; choose one standard ID: ${matches.join(", ")}`,
    selector
  );
}

function selectorIssue(
  policy: RecordSelectorPolicy,
  kind: string,
  message: string,
  path: string
): StateIndexDiagnostic {
  return {
    code: `${policy.codePrefix}.selector-${kind}`,
    message,
    path,
    stateId: null
  };
}

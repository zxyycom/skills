/*
 * Synced TypeScript runtime; repository maintenance edits tools/decision-records/src/query/decision-query-selectors.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/decision-records/src/query/decision-query-selectors.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/decision-records/src/query/decision-query-selectors.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
import {
  decisionDiagnostic,
  decisionFailure,
  type DecisionApplicationFailure
} from "../application-result.ts";
import {
  normalizeDecisionSelectorInput,
  parseDatedDecisionId
} from "../collection/decision-path.ts";
import { loadDecisionQueryContext } from "./decision-query-context.ts";
import type { IndexedDecisionRecord } from "./decision-query-contract.ts";
import { indexedRecord, selectorNotFound } from "./decision-query-records.ts";
import type { DecisionId } from "../types.ts";

export function resolveIndexedDecisionSelector(
  context: Extract<
    Awaited<ReturnType<typeof loadDecisionQueryContext>>,
    { status: "ok" }
  >,
  selector: string,
  label: string
):
  | { record: IndexedDecisionRecord; status: "ok" }
  | { failure: DecisionApplicationFailure; status: "error" } {
  const normalized = normalizeDecisionSelectorInput(selector);
  const dated = parseDatedDecisionId(normalized);
  return dated === null
    ? indexedSelectorByName(context, normalized, label)
    : indexedSelectorById(context, dated.id, label, normalized);
}
function indexedSelectorByName(
  context: Extract<
    Awaited<ReturnType<typeof loadDecisionQueryContext>>,
    { status: "ok" }
  >,
  normalized: string,
  label: string
):
  | { record: IndexedDecisionRecord; status: "ok" }
  | { failure: DecisionApplicationFailure; status: "error" } {
  const matched = context.entries.filter(
    (entry) => entry.state.name === normalized
  );
  if (matched.length === 0)
    return { failure: selectorNotFound(label, normalized), status: "error" };
  if (matched.length === 1)
    return { record: indexedRecord(matched[0]!), status: "ok" };
  return ambiguousIndexedSelector(
    label,
    normalized,
    matched.map((entry) => entry.id).sort()
  );
}
function ambiguousIndexedSelector(
  label: string,
  normalized: string,
  ids: readonly string[]
): { failure: DecisionApplicationFailure; status: "error" } {
  return {
    failure: decisionFailure(
      [
        decisionDiagnostic({
          code: "decision-records.decision-ambiguous",
          reason:
            `${label} name is ambiguous: ${normalized}; choose one standard ID: ` +
            ids.join(", "),
          recovery:
            "Retry with one listed calendar-valid YYMMDD-name Decision ID.",
          target: normalized
        })
      ],
      { presentation: "plain" }
    ),
    status: "error"
  };
}

function indexedSelectorById(
  context: Extract<
    Awaited<ReturnType<typeof loadDecisionQueryContext>>,
    { status: "ok" }
  >,
  decisionId: DecisionId,
  label: string,
  normalized: string
):
  | { record: IndexedDecisionRecord; status: "ok" }
  | { failure: DecisionApplicationFailure; status: "error" } {
  const state = Object.hasOwn(context.index.entries, decisionId)
    ? context.index.entries[decisionId]
    : undefined;
  return state === undefined
    ? { failure: selectorNotFound(label, normalized), status: "error" }
    : { record: indexedRecord({ id: decisionId, state }), status: "ok" };
}

import {
  decisionDiagnostic,
  decisionFailure,
  type DecisionApplicationFailure
} from "./application-result.ts";
import {
  decisionNameFromId,
  normalizeDecisionSelectorInput,
  parseDatedDecisionId
} from "./decision-path.ts";
import { loadDecisionQueryContext } from "./decision-query-context.ts";
import type {
  CandidateDecisionRecord,
  IndexedDecisionRecord
} from "./decision-query-contract.ts";
import {
  candidateRecords,
  indexedRecord,
  indexFailure,
  selectorNotFound
} from "./decision-query-records.ts";
import type { DecisionScan } from "./types.ts";

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
  const matched = context.reader.all({
    filters: [
      { key: "name", kind: "exact", operator: "all", values: [normalized] }
    ],
    sort: [{ direction: "asc", key: "id" }]
  });
  if (matched.status === "error")
    return {
      failure: indexFailure(matched, context.indexRelativePath),
      status: "error"
    };
  if (matched.value.length === 0)
    return { failure: selectorNotFound(label, normalized), status: "error" };
  if (matched.value.length === 1)
    return { record: indexedRecord(matched.value[0]!), status: "ok" };
  return ambiguousIndexedSelector(
    label,
    normalized,
    matched.value.map((entry) => entry.id)
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
  decisionId: string,
  label: string,
  normalized: string
):
  | { record: IndexedDecisionRecord; status: "ok" }
  | { failure: DecisionApplicationFailure; status: "error" } {
  const matched = context.reader.get(decisionId);
  if (matched.status === "error")
    return {
      failure: indexFailure(matched, context.indexRelativePath),
      status: "error"
    };
  return matched.value === null
    ? { failure: selectorNotFound(label, normalized), status: "error" }
    : { record: indexedRecord(matched.value), status: "ok" };
}

export function resolveCandidateDecisionSelector(
  scan: DecisionScan,
  selector: string
):
  | { record: CandidateDecisionRecord | null; status: "ok" }
  | { failure: DecisionApplicationFailure; status: "error" } {
  const normalized = normalizeDecisionSelectorInput(selector);
  const dated = parseDatedDecisionId(normalized);
  const matches =
    dated === null
      ? candidateRecords(scan).filter(
          (candidate) => decisionNameFromId(candidate.decisionId) === normalized
        )
      : candidateRecords(scan).filter(
          (candidate) => candidate.decisionId === dated.id
        );
  if (matches.length === 0) return { record: null, status: "ok" };
  if (matches.length === 1) return { record: matches[0]!, status: "ok" };
  return {
    failure: decisionFailure(
      [
        decisionDiagnostic({
          code: "decision-records.candidate-ambiguous",
          reason:
            `Decision candidate name is ambiguous: ${normalized}; choose one standard ID: ` +
            matches
              .map((candidate) => candidate.decisionId)
              .sort()
              .join(", "),
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

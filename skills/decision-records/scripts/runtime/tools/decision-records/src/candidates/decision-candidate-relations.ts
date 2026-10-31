/*
 * Synced TypeScript runtime; repository maintenance edits tools/decision-records/src/candidates/decision-candidate-relations.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/decision-records/src/candidates/decision-candidate-relations.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/decision-records/src/candidates/decision-candidate-relations.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
import { decisionDiagnostic } from "../application-result.ts";
import {
  bindRelationSummaries,
  normalizeRelationSummary
} from "../relations/relation-summary.ts";
import { createDecisionNameLookup } from "../records/decision-record-lookup.ts";
import { parseDatedDecisionId } from "../collection/decision-path.ts";
import type { CandidateIdentityContext } from "./decision-candidate-context.ts";
import type { NewDecisionCandidateRequest } from "./decision-candidate-service.ts";
import type {
  DecisionId,
  DecisionRelation,
  DecisionRelationSummary
} from "../types.ts";

export function resolveCandidateRelationSelectors(
  scan: CandidateIdentityContext,
  request: NewDecisionCandidateRequest
):
  | { request: NewDecisionCandidateRequest; status: "ok" }
  | { diagnostic: ReturnType<typeof decisionDiagnostic>; status: "error" } {
  let names: ReadonlyMap<string, readonly DecisionId[]> | undefined;
  const resolve = (selector: DecisionId) => {
    if (parseDatedDecisionId(selector) !== null)
      return resolveDecisionRelationSelector(selector, []);
    names ??= createDecisionNameLookup(
      scan.records.map((record) => record.decisionId as DecisionId)
    );
    return resolveDecisionRelationSelector(selector, names.get(selector) ?? []);
  };
  const relations: DecisionRelation[] = [];
  for (const relation of request.relations) {
    const normalized = normalizeCandidateRelationSummary(relation.summary);
    if ("error" in normalized)
      return { diagnostic: normalized.error, status: "error" };
    const target = resolve(relation.target);
    if (target.status === "error") return target;
    relations.push({
      type: relation.type,
      target: target.decisionId,
      ...normalized
    });
  }
  const relationSummaries: DecisionRelationSummary[] = [];
  for (const summary of request.relationSummaries ?? []) {
    const target = resolve(summary.target);
    if (target.status === "error") return target;
    relationSummaries.push({ ...summary, target: target.decisionId });
  }
  const bound = bindRelationSummaries(relations, relationSummaries);
  if ("error" in bound) {
    return {
      diagnostic: decisionDiagnostic({
        code: "decision-records.new-relation-summary-invalid",
        outcome: "no-change",
        reason: bound.error,
        recovery:
          "Provide each --relation-summary target once in this command's complete relation set, then retry.",
        scope: "Decision candidate scaffold",
        target: "--relation-summary"
      }),
      status: "error"
    };
  }
  return {
    request: { ...request, relations: bound.relations, relationSummaries: [] },
    status: "ok"
  };
}

function normalizeCandidateRelationSummary(
  summary: unknown
): { summary?: string } | { error: ReturnType<typeof decisionDiagnostic> } {
  if (summary === undefined) return {};
  const normalized = normalizeRelationSummary(summary);
  if (!("issue" in normalized)) return normalized;
  return {
    error: decisionDiagnostic({
      code: "decision-records.new-relation-summary-invalid",
      outcome: "no-change",
      reason: "Candidate relation summary " + normalized.issue,
      recovery:
        "Use a blank or trimmed single-line summary of at most 40 Unicode code points, then retry.",
      scope: "Decision candidate scaffold",
      target: "relation.summary"
    })
  };
}

function resolveDecisionRelationSelector(
  selector: DecisionId,
  matches: readonly DecisionId[]
):
  | { decisionId: DecisionId; status: "ok" }
  | { diagnostic: ReturnType<typeof decisionDiagnostic>; status: "error" } {
  const dated = parseDatedDecisionId(selector);
  if (dated !== null) return { decisionId: dated.id, status: "ok" };
  if (matches.length === 1) return { decisionId: matches[0]!, status: "ok" };
  return {
    diagnostic: decisionDiagnostic({
      code:
        matches.length === 0
          ? "decision-records.new-relation-target-missing"
          : "decision-records.new-relation-target-ambiguous",
      outcome: "no-change",
      reason:
        matches.length === 0
          ? "Candidate relation target does not exist: " + selector
          : "Candidate relation target is ambiguous: " +
            selector +
            "; choose one standard ID: " +
            matches.join(", "),
      recovery:
        matches.length === 0
          ? "Choose an existing direct predecessor Decision ID or unique name, then retry the command."
          : "Retry with one listed calendar-valid YYMMDD-name Decision ID.",
      scope: "Decision candidate scaffold",
      target: selector
    }),
    status: "error"
  };
}

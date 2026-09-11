import { setInvestigationRelationsFromCli } from "./relation-transaction.ts";
import type { InvestigationRelationSummaryInput } from "./relation-summary.ts";
import type { InvestigationRelationSetResult } from "./types.ts";
import type {
  InvestigationReportCliIo,
  ParsedCli,
  RawInvestigationRelationReplacement,
  RelationCliEvent
} from "./cli-contract.ts";
import { cliInvalid, printResultErrors, writeLine } from "./cli-io.ts";
import {
  assertAllowedOptions,
  assertNoPositionals,
  location
} from "./cli-parser.ts";
import { parseRelationSummaries } from "./cli-candidate-create.ts";

type RelationGroupState = {
  mode: "clear" | "relations" | null;
  relations: Array<{ target: string; type: string }>;
  relationSummaries: InvestigationRelationSummaryInput[];
  source: string;
};
export async function runSetRelations(
  input: ParsedCli,
  io: InvestigationReportCliIo
): Promise<number> {
  const problem =
    assertNoPositionals(input) ??
    assertAllowedOptions(input, [
      "root",
      "investigations-dir",
      "source",
      "relation",
      "relation-summary",
      "clear-relations"
    ]);
  if (problem !== null) return cliInvalid(problem, io);
  const parsed = parseRelationGroups(input.relationEvents);
  if (parsed.status === "error") return cliInvalid(parsed.error, io);
  const result = await setInvestigationRelationsFromCli(
    {
      ...location(input.values),
      replacements: parsed.replacements.map((replacement) => ({
        relations: replacement.relations,
        source: replacement.source
      }))
    },
    parsed.replacements.map((replacement) => replacement.relationSummaries)
  );
  printRelationResult(result, io);
  return result.errors.length === 0 ? 0 : 1;
}
function parseRelationGroups(
  events: readonly RelationCliEvent[] | undefined
):
  | { status: "ok"; replacements: RawInvestigationRelationReplacement[] }
  | { status: "error"; error: string } {
  if (events === undefined)
    return { error: "set-relations requires --source groups", status: "error" };
  const replacements: RawInvestigationRelationReplacement[] = [];
  let current: RelationGroupState | null = null;
  for (const event of events) {
    const applied = applyRelationGroupEvent(event, current, replacements);
    if ("error" in applied) return { error: applied.error, status: "error" };
    current = applied.current;
  }
  const error = finishRelationGroup(current, replacements);
  return error === null
    ? { replacements, status: "ok" }
    : { error, status: "error" };
}
function finishRelationGroup(
  current: RelationGroupState | null,
  replacements: RawInvestigationRelationReplacement[]
): string | null {
  if (current === null) return null;
  if (current.mode === null)
    return `source ${current.source} must use --relation or --clear-relations`;
  if (current.mode === "relations" && current.relations.length === 0)
    return `source ${current.source} --relation-summary requires at least one --relation`;
  replacements.push({
    relations: current.relations,
    relationSummaries: current.relationSummaries,
    source: current.source
  });
  return null;
}
function applyRelationGroupEvent(
  event: RelationCliEvent,
  current: RelationGroupState | null,
  replacements: RawInvestigationRelationReplacement[]
): { current: RelationGroupState | null } | { error: string } {
  if (event.kind === "source") {
    const error = finishRelationGroup(current, replacements);
    return error === null
      ? {
          current: {
            mode: null,
            relations: [],
            relationSummaries: [],
            source: event.value
          }
        }
      : { error };
  }
  if (current === null)
    return { error: `--${event.kind} must follow --source` };
  if (event.kind === "clear") {
    if (current.mode !== null) return { error: relationModeConflict(current) };
    current.mode = "clear";
    return { current };
  }
  if (current.mode === "clear") return { error: relationModeConflict(current) };
  if (event.kind === "relation-summary")
    return appendRelationSummary(event.value, current);
  return appendRelation(event.value, current);
}
function appendRelationSummary(
  value: string,
  current: RelationGroupState
): { current: RelationGroupState } | { error: string } {
  const parsed = parseRelationSummaries([value]);
  if (parsed.status === "error") return { error: parsed.error };
  current.mode = "relations";
  current.relationSummaries.push(parsed.values[0]!);
  return { current };
}
function appendRelation(
  value: string,
  current: RelationGroupState
): { current: RelationGroupState } | { error: string } {
  const separator = value.indexOf("=");
  if (separator <= 0 || separator === value.length - 1)
    return {
      error: `relation ${JSON.stringify(value)} must use <type=target-id>`
    };
  current.mode = "relations";
  current.relations.push({
    target: value.slice(separator + 1),
    type: value.slice(0, separator)
  });
  return { current };
}
function relationModeConflict(current: RelationGroupState): string {
  return `source ${current.source} must choose either --relation or --clear-relations`;
}
function printRelationResult(
  result: InvestigationRelationSetResult,
  io: InvestigationReportCliIo
): void {
  if (result.errors.length > 0) {
    printResultErrors({
      diagnostics: result.diagnostics,
      errors: result.errors,
      exitCode: 1,
      io,
      title: "Investigation relation update failed:"
    });
    return;
  }
  writeLine(
    io.stdout,
    `Investigation relations ${result.changed ? "updated" : "already current"} for: ${result.sourceIds.join(", ")}`
  );
}

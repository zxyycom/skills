import {
  executeInvestigationIndexQuery,
  searchInvestigationReports,
  showInvestigationReport,
  traceInvestigationReports
} from "./query.ts";
import { printInvestigationList } from "./list-output.ts";
import type {
  InvestigationSearchEntry,
  InvestigationSearchResult
} from "./types.ts";
import type { InvestigationIndexQueryFailure } from "./query.ts";
import type {
  CommonInvestigationQueryOptions,
  InvestigationReportCliIo,
  ParsedCli
} from "./cli-contract.ts";
import {
  cliInvalid,
  printResultErrors,
  printWarnings,
  writeLine
} from "./cli-io.ts";
import {
  assertAllowedOptions,
  assertNoPositionals,
  assertSingleOptions,
  has,
  location,
  numberValue,
  valueOf,
  valuesOf
} from "./cli-parser.ts";

function commonInvestigationQueryOptions(
  input: ParsedCli
): CommonInvestigationQueryOptions {
  const { values } = input;
  const optional = <T>(
    key: string,
    value: T | undefined
  ): Partial<Record<string, T>> =>
    value === undefined ? {} : { [key]: value };
  return {
    ...location(values),
    ...optional("tags", valuesOf(values, "tag")),
    ...optional("formedAtFrom", valueOf(values, "formed-from")),
    ...optional("formedAtTo", valueOf(values, "formed-to")),
    ...optional("relatedTo", valueOf(values, "related-to")),
    ...optional("direction", valueOf(values, "direction")),
    ...optional("relationType", valueOf(values, "relation-type")),
    ...optional("limit", numberValue(values, "limit"))
  } as CommonInvestigationQueryOptions;
}

export async function runList(
  input: ParsedCli,
  io: InvestigationReportCliIo
): Promise<number> {
  const problem = listProblem(input);
  if (problem !== null) return cliInvalid(problem, io);
  return await executeList(input, io);
}

function listProblem(input: ParsedCli): string | null {
  return (
    assertNoPositionals(input) ??
    assertAllowedOptions(input, [
      "root",
      "investigations-dir",
      "tag",
      "formed-from",
      "formed-to",
      "related-to",
      "direction",
      "relation-type",
      "limit",
      "offset",
      "detail"
    ]) ??
    assertSingleOptions(input, [
      "formed-from",
      "formed-to",
      "related-to",
      "direction",
      "relation-type",
      "limit",
      "offset",
      "detail"
    ])
  );
}

async function executeList(
  input: ParsedCli,
  io: InvestigationReportCliIo
): Promise<number> {
  const execution = await executeInvestigationIndexQuery(
    listQueryOptions(input)
  );
  if (execution.isErr()) return printQueryFailure(execution.error, io);
  printInvestigationList(
    execution.value,
    { detail: has(input.values, "detail") },
    io
  );
  return 0;
}

function listQueryOptions(
  input: ParsedCli
): ReturnType<typeof commonInvestigationQueryOptions> & { offset?: number } {
  const offset = numberValue(input.values, "offset");
  return {
    ...commonInvestigationQueryOptions(input),
    ...(offset === undefined ? {} : { offset })
  };
}

function printQueryFailure(
  failure: InvestigationIndexQueryFailure,
  io: InvestigationReportCliIo
): number {
  return printResultErrors({
    diagnostics: failure.result.diagnostics,
    errors: failure.result.errors,
    exitCode: failure.kind === "invalid-options" ? 2 : 1,
    io,
    title:
      failure.kind === "invalid-options"
        ? "Invalid investigation report query options:"
        : "Investigation index query failed:"
  });
}

export async function runSearch(
  input: ParsedCli,
  io: InvestigationReportCliIo
): Promise<number> {
  const problem = searchProblem(input);
  if (problem !== null) return cliInvalid(problem, io);
  return await executeSearch(input, io);
}

function searchProblem(input: ParsedCli): string | null {
  const allowed = assertAllowedOptions(input, [
    "root",
    "investigations-dir",
    "match",
    "in",
    "tag",
    "formed-from",
    "formed-to",
    "related-to",
    "direction",
    "relation-type",
    "limit"
  ]);
  if (allowed !== null) return allowed;
  const repeated = assertSingleOptions(input, [
    "related-to",
    "direction",
    "relation-type"
  ]);
  if (repeated !== null) return repeated;
  return input.positionals.length === 1
    ? null
    : "search requires exactly one text query";
}

async function executeSearch(
  input: ParsedCli,
  io: InvestigationReportCliIo
): Promise<number> {
  const result = await searchInvestigationReports(searchOptions(input));
  if (result.status === "error") return printSearchFailure(result, io);
  return printSearchSuccess(result, io);
}

function searchOptions(
  input: ParsedCli
): Parameters<typeof searchInvestigationReports>[0] {
  const match = valueOf(input.values, "match");
  const scope = valueOf(input.values, "in");
  return {
    ...commonInvestigationQueryOptions(input),
    ...(match === undefined ? {} : { match }),
    ...(scope === undefined ? {} : { in: scope }),
    query: input.positionals[0]!
  };
}

function printSearchFailure(
  result: InvestigationSearchResult,
  io: InvestigationReportCliIo
): number {
  return printResultErrors({
    diagnostics: result.diagnostics,
    errors: result.errors,
    exitCode: 1,
    io,
    title: "Investigation report search failed:",
    warnings: result.warnings
  });
}

function printSearchSuccess(
  result: InvestigationSearchResult,
  io: InvestigationReportCliIo
): number {
  printWarnings(result.warnings, io);
  if (result.entries.length === 0) {
    writeLine(io.stdout, "No investigation reports matched.");
    return 0;
  }
  for (const entry of result.entries) printSearchEntry(entry, io);
  printSearchTruncationWarning(result.truncation, io);
  return 0;
}

function printSearchTruncationWarning(
  truncation: Readonly<{
    files: boolean;
    matches: boolean;
    previewCharacters: boolean;
  }>,
  io: InvestigationReportCliIo
): void {
  if (!truncation.files && !truncation.matches && !truncation.previewCharacters)
    return;
  writeLine(
    io.stderr,
    "[investigation-report.warning] search previews were truncated by configured limits"
  );
}

function printSearchEntry(
  entry: InvestigationSearchEntry,
  io: InvestigationReportCliIo
): void {
  writeLine(io.stdout, `${entry.id} ${entry.formedAt}`);
  writeLine(io.stdout, `  title: ${entry.title}`);
  writeLine(io.stdout, `  question: ${entry.question}`);
  writeLine(io.stdout, `  tags: ${entry.tags.join(", ")}`);
  writeLine(io.stdout, `  sourcePath: ${entry.sourcePath}`);
  if ("previews" in entry) {
    for (const preview of entry.previews)
      writeLine(io.stdout, `  ${preview.line}: ${preview.preview}`);
    return;
  }
  writeLine(io.stdout, `  matchedFields: ${entry.matchedFields.join(", ")}`);
  writeLine(io.stdout, "  matchedRelations:");
  if (entry.matchedRelations.length === 0) writeLine(io.stdout, "    - none");
  for (const relation of entry.matchedRelations)
    writeLine(
      io.stdout,
      `    - ${relation.type} ${relation.target}: ${relation.summary}`
    );
}

export async function runShow(
  input: ParsedCli,
  io: InvestigationReportCliIo
): Promise<number> {
  const problem = assertAllowedOptions(input, ["root", "investigations-dir"]);
  const [id] = input.positionals;
  if (problem !== null || id === undefined || input.positionals.length !== 1)
    return cliInvalid(
      problem ?? "show requires exactly one Investigation ID",
      io
    );
  const result = await showInvestigationReport({
    ...location(input.values),
    id
  });
  if (result.status === "error")
    return printResultErrors({
      diagnostics: result.diagnostics,
      errors: result.errors,
      exitCode: 1,
      io,
      title: "Investigation report show failed:"
    });
  io.stdout(result.markdown);
  return 0;
}

export async function runTrace(
  input: ParsedCli,
  io: InvestigationReportCliIo
): Promise<number> {
  const problem = assertAllowedOptions(input, [
    "root",
    "investigations-dir",
    "direction",
    "depth"
  ]);
  const [id] = input.positionals;
  if (problem !== null || id === undefined || input.positionals.length !== 1)
    return cliInvalid(
      problem ?? "trace requires exactly one Investigation ID",
      io
    );
  const direction = valueOf(input.values, "direction");
  const maxDepth = numberValue(input.values, "depth");
  const result = await traceInvestigationReports({
    ...location(input.values),
    id,
    ...(direction === undefined ? {} : { direction }),
    ...(maxDepth === undefined ? {} : { maxDepth })
  });
  if (result.status === "error")
    return printResultErrors({
      diagnostics: result.diagnostics,
      errors: result.errors,
      exitCode: 1,
      io,
      title: "Investigation report trace failed:"
    });
  writeLine(io.stdout, `Reports: ${result.reportIds.join(", ")}`);
  for (const edge of result.edges)
    writeLine(
      io.stdout,
      `${edge.source} --${edge.type}${edge.summary === undefined ? "" : ` (${edge.summary})`}--> ${edge.target}`
    );
  return 0;
}

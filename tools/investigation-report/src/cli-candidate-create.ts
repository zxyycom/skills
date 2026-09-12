import { createInvestigationCandidateFromCli } from "./candidate.ts";
import { publishInvestigationCandidates } from "./publish.ts";
import { printInvestigationRelationReview } from "./relation-review-output.ts";
import {
  normalizeInvestigationRelationSummary,
  type InvestigationRelationSummaryInput
} from "./relation-summary.ts";
import type { InvestigationReportCliIo, ParsedCli } from "./cli-contract.ts";
import { printCandidateReadiness } from "./cli-candidate-readiness.ts";
import {
  cliInvalid,
  printResultErrors,
  printWarnings,
  writeLine
} from "./cli-io.ts";
import {
  assertAllowedOptions,
  has,
  location,
  valueOf,
  valuesOf
} from "./cli-parser.ts";

export async function runNew(
  input: ParsedCli,
  io: InvestigationReportCliIo
): Promise<number> {
  const prepared = prepareNewCandidateInput(input);
  if ("error" in prepared) return cliInvalid(prepared.error, io);
  const result = await createInvestigationCandidateFromCli(
    prepared.value.input,
    prepared.value.relationSummaries
  );
  if (result.status !== "ok")
    return printResultErrors({
      diagnostics: result.diagnostics,
      errors: result.errors,
      exitCode: result.status === "invalid-options" ? 2 : 1,
      io,
      title:
        result.status === "invalid-options"
          ? "Invalid investigation candidate options:"
          : "Investigation candidate creation failed:",
      warnings: result.warnings
    });
  writeLine(
    io.stdout,
    `Investigation candidate created: ${result.candidate.path}`
  );
  printWarnings(result.warnings, io);
  printCandidateReadiness(result.candidate, io);
  await printNewCandidatePublishPreflight(
    prepared.value.id,
    location(input.values),
    io
  );
  return 0;
}

type PreparedCandidateInput = Readonly<{
  id: string;
  input: CandidateCreationInput;
  relationSummaries: readonly InvestigationRelationSummaryInput[];
}>;
type CandidateCreationInput = Readonly<{
  formedAt?: string;
  id: string;
  investigationsDir?: string;
  question: string;
  relations: readonly CandidateRelationInput[];
  tags: readonly string[];
  title: string;
  workspaceRoot: string;
}>;
type CandidateCreationValues = Readonly<{
  formedAt?: string;
  id: string;
  question: string;
  tags: readonly string[];
  title: string;
}>;
type CandidatePreparation =
  | Readonly<{ error: string }>
  | Readonly<{ value: PreparedCandidateInput }>;
type CandidateRelationInput = Readonly<{ target: string; type: string }>;
type RelationSummaryParse =
  | Readonly<{
      status: "ok";
      values: readonly InvestigationRelationSummaryInput[];
    }>
  | Readonly<{ error: string; status: "error" }>;

function prepareNewCandidateInput(input: ParsedCli): CandidatePreparation {
  const problem = newCandidateProblem(input);
  return problem === null ? prepareCandidateDetails(input) : { error: problem };
}

function prepareCandidateDetails(input: ParsedCli): CandidatePreparation {
  const values = candidateCreationValues(input);
  return "error" in values ? values : prepareCandidateRelations(input, values);
}

function prepareCandidateRelations(
  input: ParsedCli,
  values: CandidateCreationValues
): CandidatePreparation {
  const relations = parseNewRelations(valuesOf(input.values, "relation") ?? []);
  return relations.status === "error"
    ? relations
    : prepareCandidateSummaries(input, values, relations.values);
}

function prepareCandidateSummaries(
  input: ParsedCli,
  values: CandidateCreationValues,
  relations: readonly CandidateRelationInput[]
): CandidatePreparation {
  const summaries = parseRelationSummaries(
    valuesOf(input.values, "relation-summary") ?? []
  );
  if (summaries.status === "error") return summaries;
  if (relationSummariesWithoutRelations(relations, summaries.values))
    return { error: "--relation-summary requires at least one --relation" };
  return {
    value: preparedCandidateInput(input, values, relations, summaries.values)
  };
}

function preparedCandidateInput(
  input: ParsedCli,
  values: CandidateCreationValues,
  relations: readonly CandidateRelationInput[],
  relationSummaries: readonly InvestigationRelationSummaryInput[]
): PreparedCandidateInput {
  return {
    id: values.id,
    input: {
      ...location(input.values),
      ...(values.formedAt === undefined ? {} : { formedAt: values.formedAt }),
      id: values.id,
      question: values.question,
      relations,
      tags: values.tags,
      title: values.title
    },
    relationSummaries
  };
}

function newCandidateProblem(input: ParsedCli): string | null {
  return (
    assertAllowedOptions(input, [
      "root",
      "investigations-dir",
      "title",
      "formed-at",
      "question",
      "tag",
      "relation",
      "relation-summary"
    ]) ??
    (input.positionals.length === 1
      ? null
      : "new requires exactly one Investigation name or ID")
  );
}

function candidateCreationValues(
  input: ParsedCli
): CandidateCreationValues | Readonly<{ error: string }> {
  const [id] = input.positionals;
  const title = valueOf(input.values, "title");
  const formedAt = valueOf(input.values, "formed-at");
  const question = valueOf(input.values, "question");
  const tags = valuesOf(input.values, "tag");
  if (
    id === undefined ||
    title === undefined ||
    question === undefined ||
    tags === undefined
  )
    return {
      error: "new requires --title, --question, and at least one --tag"
    };
  return { formedAt, id, question, tags, title };
}

function relationSummariesWithoutRelations(
  relations: readonly unknown[],
  summaries: readonly unknown[]
): boolean {
  return relations.length === 0 && summaries.length > 0;
}

async function printNewCandidatePublishPreflight(
  id: string,
  candidateLocation: { investigationsDir?: string; workspaceRoot: string },
  io: InvestigationReportCliIo
): Promise<void> {
  const preflight = await publishInvestigationCandidates({
    ...candidateLocation,
    ids: [id],
    preflight: true
  });
  if (preflight.errors.length === 0) {
    writeLine(io.stderr, "Candidate publish preflight: ready.");
    printWarnings(preflight.warnings, io);
    return;
  }
  writeLine(io.stderr, "Candidate publish preflight: needs attention.");
  for (const error of preflight.errors) writeLine(io.stderr, `- ${error}`);
  printWarnings(preflight.warnings, io);
  writeLine(
    io.stderr,
    "  next: keep the created candidate, edit it or inspect it with show-candidate, then rerun publish --preflight; do not rerun new"
  );
}

export async function runPublish(
  input: ParsedCli,
  io: InvestigationReportCliIo
): Promise<number> {
  const problem = publishProblem(input);
  if (problem !== null) return cliInvalid(problem, io);
  const published = await publishInvestigationCandidates({
    ...location(input.values),
    ids: input.positionals,
    preflight: has(input.values, "preflight")
  });
  return printPublishResult(published, io);
}

function publishProblem(input: ParsedCli): string | null {
  const allowed = assertAllowedOptions(input, [
    "root",
    "investigations-dir",
    "preflight"
  ]);
  if (allowed !== null) return allowed;
  if (input.positionals.length === 0)
    return "publish requires at least one Investigation selector";
  return new Set(input.positionals).size === input.positionals.length
    ? null
    : "publish IDs must not repeat";
}

function printPublishResult(
  published: Awaited<ReturnType<typeof publishInvestigationCandidates>>,
  io: InvestigationReportCliIo
): number {
  if (published.errors.length > 0)
    return printResultErrors({
      diagnostics: published.diagnostics,
      errors: published.errors,
      exitCode: 1,
      io,
      title: published.preflight
        ? "Investigation publish preflight failed:"
        : "Investigation publish failed:",
      warnings: published.warnings
    });
  printWarnings(published.warnings, io);
  writeLine(io.stdout, publishSuccessMessage(published));
  if (published.relationReview !== undefined)
    printInvestigationRelationReview(published.relationReview, io);
  return 0;
}

function publishSuccessMessage(
  published: Awaited<ReturnType<typeof publishInvestigationCandidates>>
): string {
  return published.preflight
    ? `Investigation publish preflight passed (${published.ids.join(", ")}); no candidate, formal report, resource, index, or pending state was changed.`
    : `Investigation candidates published: ${published.ids.join(", ")}.`;
}

export function parseRelationSummaries(
  values: readonly string[]
): RelationSummaryParse {
  const summaries: InvestigationRelationSummaryInput[] = [];
  for (const value of values) {
    const parsed = parseRelationSummary(value);
    if ("error" in parsed) return parsed;
    summaries.push(parsed.value);
  }
  return { status: "ok", values: summaries };
}

function parseRelationSummary(
  value: string
):
  | Readonly<{ value: InvestigationRelationSummaryInput }>
  | Readonly<{ error: string; status: "error" }> {
  const separator = value.indexOf("=");
  if (separator <= 0)
    return {
      error: `relation-summary ${JSON.stringify(value)} must use <target-selector=summary>`,
      status: "error"
    };
  try {
    const summary = normalizeInvestigationRelationSummary(
      value.slice(separator + 1)
    );
    return {
      value: {
        target: value.slice(0, separator),
        ...(summary === null ? {} : { summary })
      }
    };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "invalid relation summary",
      status: "error"
    };
  }
}

function parseNewRelations(
  values: readonly string[]
):
  | { status: "ok"; values: readonly CandidateRelationInput[] }
  | { error: string; status: "error" } {
  const relations: CandidateRelationInput[] = [];
  for (const value of values) {
    const separator = value.indexOf("=");
    if (separator <= 0 || separator === value.length - 1) {
      return {
        error: `relation ${JSON.stringify(value)} must use <type=target-id>`,
        status: "error"
      };
    }
    relations.push({
      target: value.slice(separator + 1),
      type: value.slice(0, separator)
    });
  }
  return { status: "ok", values: relations };
}

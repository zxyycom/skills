import { decisionDiagnostic, decisionFailure } from "./application-result.ts";
import { loadCandidateQueryContext } from "./decision-query-candidates.ts";
import {
  normalizeDecisionSelectorInput,
  decisionNameFromId,
  isDecisionId,
  parseDatedDecisionId
} from "./decision-path.ts";
import { loadDecisionQueryContext } from "./decision-query-context.ts";
import type {
  CandidateDecisionRecord,
  DecisionQueryRequest,
  DecisionQueryResult
} from "./decision-query-contract.ts";
import {
  indexedRecords,
  indexFailure,
  sourceWarningsForRecord
} from "./decision-query-records.ts";
import { readDecisionBody } from "./decision-query-source.ts";
import {
  resolveCandidateDecisionSelector,
  resolveIndexedDecisionSelector
} from "./decision-query-selectors.ts";
import { traceDecisionRelations } from "./relation-graph.ts";

export async function showDecisionRecord(
  request: Extract<DecisionQueryRequest, { command: "show" }>
): Promise<DecisionQueryResult> {
  const context = await loadDecisionQueryContext(request.location);
  if (context.status === "error") return context;
  const resolved = resolveIndexedDecisionSelector(
    context,
    request.decisionId,
    "Established decision"
  );
  if (resolved.status === "error") return resolved.failure;
  const body = await readDecisionBody(
    context.decisionsDirectory,
    resolved.record
  );
  return body.status === "error"
    ? body
    : {
        body: body.value,
        command: "show",
        record: resolved.record,
        status: "ok",
        warnings: []
      };
}

export async function showDecisionCandidate(
  request: Extract<DecisionQueryRequest, { command: "show-candidate" }>
): Promise<DecisionQueryResult> {
  const context = await loadCandidateQueryContext(request.location);
  if (context.status === "error") return context;
  const resolved = resolveCandidateDecisionSelector(
    context.scan,
    request.decisionId
  );
  if (resolved.status === "error") return resolved.failure;
  if (resolved.record !== null)
    return candidateBodyResult(context, resolved.record);
  return invalidOrMissingCandidate(
    request.decisionId,
    context.scan.records,
    context.warnings
  );
}

async function candidateBodyResult(
  context: Extract<
    Awaited<ReturnType<typeof loadCandidateQueryContext>>,
    { status: "ok" }
  >,
  record: CandidateDecisionRecord
): Promise<DecisionQueryResult> {
  const body = await readDecisionBody(context.scan.decisionsDirectory, record);
  return body.status === "error"
    ? body
    : {
        body: body.value,
        command: "show-candidate",
        record,
        status: "ok",
        warnings: context.warnings
      };
}

function invalidOrMissingCandidate(
  selector: string,
  records: readonly Extract<
    Awaited<ReturnType<typeof loadCandidateQueryContext>>,
    { status: "ok" }
  >["scan"]["records"][number][],
  warnings: readonly string[]
): DecisionQueryResult {
  const normalized = normalizeDecisionSelectorInput(selector);
  const dated = parseDatedDecisionId(normalized);
  const sourceRecord = records.find(
    (candidate) =>
      candidate.markdownExists &&
      (dated?.id === candidate.decisionId ||
        (dated === null &&
          isDecisionId(candidate.decisionId) &&
          decisionNameFromId(candidate.decisionId) === normalized))
  );
  if (sourceRecord !== undefined)
    return decisionFailure(
      [
        "Decision source is not a valid candidate scaffold: " +
          sourceRecord.decisionId,
        ...sourceWarningsForRecord(warnings, sourceRecord)
      ],
      { presentation: "plain" }
    );
  return decisionFailure(
    [
      decisionDiagnostic({
        code: "decision-records.candidate-not-found",
        reason: "Decision candidate does not exist: " + selector,
        recovery:
          "Use candidates to choose a valid candidate Decision ID or unique name, then retry the command.",
        target: selector
      })
    ],
    { presentation: "plain" }
  );
}

export async function traceDecisionRecord(
  request: Extract<DecisionQueryRequest, { command: "trace" }>
): Promise<DecisionQueryResult> {
  const context = await loadDecisionQueryContext(request.location);
  if (context.status === "error") return context;
  const resolved = resolveIndexedDecisionSelector(
    context,
    request.decisionId,
    "Established decision"
  );
  if (resolved.status === "error") return resolved.failure;
  const queried = context.reader.all({
    sort: [{ direction: "asc", key: "id" }]
  });
  if (queried.status === "error")
    return indexFailure(queried, context.indexRelativePath);
  const records = indexedRecords(queried.value);
  const trace = traceDecisionRelations(
    records.map((record) => ({
      decisionId: record.decisionId,
      projection: record.projection,
      sourcePath: record.sourcePath,
      status: record.status
    })),
    resolved.record.decisionId,
    { direction: request.direction, maxDepth: request.maxDepth }
  );
  return {
    command: "trace",
    edges: trace.edges,
    records: records
      .filter((record) => trace.decisionIds.has(record.decisionId))
      .sort((left, right) => left.sourcePath.localeCompare(right.sourcePath)),
    status: "ok",
    warnings: []
  };
}

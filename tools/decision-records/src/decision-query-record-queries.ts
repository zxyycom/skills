import { decisionDiagnostic, decisionFailure } from "./application-result.ts";
import { loadCandidateQueryContext } from "./decision-query-candidates.ts";
import {
  normalizeDecisionSelectorInput,
  decisionNameFromId,
  isDecisionId,
  parseDatedDecisionId
} from "./decision-path.ts";
import type { DecisionId, DecisionTraceDirection } from "./types.ts";
import { loadDecisionQueryContext } from "./decision-query-context.ts";
import type {
  CandidateDecisionRecord,
  DecisionTraceEntry,
  IndexedDecisionRecord,
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
  const options = normalizeTraceOptions(request);
  if (options.status === "error") return options.failure;
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
  return traceDecisionResult(
    indexedRecords(queried.value),
    resolved.record.decisionId,
    options
  );
}

function traceDecisionResult(
  records: readonly IndexedDecisionRecord[],
  anchorId: DecisionId,
  options: Extract<ReturnType<typeof normalizeTraceOptions>, { status: "ok" }>
): Extract<DecisionQueryResult, { command: "trace"; status: "ok" }> {
  const { direction, maxDepth, maxRecords } = options;
  const trace = traceDecisionRelations(
    records.map((record) => ({
      decisionId: record.decisionId,
      projection: record.projection,
      sourcePath: record.sourcePath,
      status: record.status
    })),
    anchorId,
    { direction, maxDepth, maxRecords }
  );
  const recordById = new Map(
    records.map((record) => [record.decisionId, record])
  );
  return {
    anchorId,
    command: "trace",
    contextIds: trace.contextIds,
    coverage: trace.coverage,
    direction,
    entries: traceEntries(recordById, [...trace.traceIds, ...trace.contextIds]),
    frontier: trace.frontier,
    ...(trace.blockedEvent === undefined
      ? {}
      : { blockedEvent: trace.blockedEvent }),
    limits: {
      depth: maxDepth === null ? "all" : maxDepth,
      maxRecords
    },
    status: "ok",
    traceIds: trace.traceIds,
    warnings: []
  };
}

function normalizeTraceOptions(
  request: Extract<DecisionQueryRequest, { command: "trace" }>
):
  | {
      direction: DecisionTraceDirection;
      maxDepth: number | null;
      maxRecords: number;
      status: "ok";
    }
  | { failure: DecisionQueryResult; status: "error" } {
  const issues: string[] = [];
  const direction = request.direction ?? "both";
  const maxDepth = request.maxDepth === undefined ? 5 : request.maxDepth;
  const maxRecords = request.maxRecords ?? 50;
  if (
    direction !== "both" &&
    direction !== "predecessors" &&
    direction !== "successors"
  ) {
    issues.push("direction must be predecessors, successors, or both");
  }
  if (maxDepth !== null && (!Number.isSafeInteger(maxDepth) || maxDepth < 0)) {
    issues.push("maxDepth must be a non-negative safe integer or null");
  }
  if (!Number.isSafeInteger(maxRecords) || maxRecords < 1) {
    issues.push("maxRecords must be a positive safe integer");
  }
  if (issues.length > 0) {
    return {
      failure: decisionFailure(
        issues.map((reason) =>
          decisionDiagnostic({
            code: "decision-records.trace-options-invalid",
            reason,
            recovery: "Correct the Decision trace options, then retry.",
            target: "Decision trace options"
          })
        ),
        { exitCode: 2 }
      ),
      status: "error"
    };
  }
  return {
    direction,
    maxDepth,
    maxRecords,
    status: "ok"
  };
}

function traceEntries(
  recordById: ReadonlyMap<string, IndexedDecisionRecord>,
  decisionIds: readonly string[]
): Record<string, DecisionTraceEntry> {
  return Object.fromEntries(
    [...new Set(decisionIds)].sort().map((decisionId) => {
      const record = recordById.get(decisionId);
      if (record === undefined) {
        throw new TypeError(
          "Trace selected an unknown Decision: " + decisionId
        );
      }
      return [
        decisionId,
        {
          title: record.projection.title,
          status: record.status,
          alignment: record.alignment,
          createdAt: record.createdAt,
          purpose: record.projection.purpose,
          background: record.projection.background,
          decision: record.projection.decision,
          tags: [...record.tags],
          relations: record.projection.relations.map((relation) => ({
            ...relation
          }))
        }
      ];
    })
  );
}

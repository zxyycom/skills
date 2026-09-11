import {
  executeDecisionQuery,
  type DecisionQueryRequest
} from "./decision-query-service.ts";
import {
  printDecisionFailure,
  printDecisionListSuccess,
  printDecisionQuerySuccess
} from "./cli-output.ts";
import type { CliArgs, CliArgsFor } from "./cli-args.ts";
import type { DecisionRecordsCliIo } from "./cli-io.ts";
import { decisionLocation } from "./cli-location.ts";

export type QueryCliArgs = Extract<
  CliArgs,
  {
    command:
      | "candidates"
      | "check"
      | "list"
      | "search"
      | "show"
      | "show-candidate"
      | "sync-index"
      | "trace";
  }
>;

export function isQueryCliArgs(args: CliArgs): args is QueryCliArgs {
  return new Set([
    "candidates",
    "check",
    "list",
    "search",
    "show",
    "show-candidate",
    "sync-index",
    "trace"
  ]).has(args.command);
}

async function runQuery(
  request: Exclude<DecisionQueryRequest, { command: "list" }>,
  io: DecisionRecordsCliIo,
  traceJson = false
): Promise<number> {
  const result = await executeDecisionQuery(request);
  if (result.status === "error") {
    printDecisionFailure(result, io);
    return result.exitCode;
  }
  if (result.command === "list") {
    throw new TypeError("Non-list Decision query returned a list result");
  }
  printDecisionQuerySuccess(result, io, traceJson);
  return 0;
}

async function runCheck(
  args: CliArgsFor<"check">,
  io: DecisionRecordsCliIo
): Promise<number> {
  return await runQuery(
    {
      command: "check",
      location: decisionLocation(args)
    },
    io
  );
}

async function runCandidates(
  args: CliArgsFor<"candidates">,
  io: DecisionRecordsCliIo
): Promise<number> {
  return await runQuery(
    {
      command: "candidates",
      location: decisionLocation(args)
    },
    io
  );
}

async function runList(
  args: CliArgsFor<"list">,
  io: DecisionRecordsCliIo
): Promise<number> {
  const result = await executeDecisionQuery({
    alignment: args.alignment,
    command: "list",
    ...(args.createdAtFrom === undefined
      ? {}
      : { createdAtFrom: args.createdAtFrom }),
    ...(args.createdAtTo === undefined
      ? {}
      : { createdAtTo: args.createdAtTo }),
    ...(args.direction === undefined ? {} : { direction: args.direction }),
    limit: args.limit,
    location: decisionLocation(args),
    offset: args.offset,
    ...(args.relatedTo === undefined ? {} : { relatedTo: args.relatedTo }),
    ...(args.relationType === undefined
      ? {}
      : { relationType: args.relationType }),
    status: args.status,
    tags: args.tags
  });
  if (result.status === "error") {
    printDecisionFailure(result, io);
    return result.exitCode;
  }
  if (result.command !== "list") {
    throw new TypeError("Decision list query returned a non-list result");
  }
  printDecisionListSuccess(
    result,
    { detail: args.detail, fullTime: args.fullTime },
    io
  );
  return 0;
}

async function runSearch(
  args: CliArgsFor<"search">,
  io: DecisionRecordsCliIo
): Promise<number> {
  return await runQuery(
    {
      alignment: args.alignment,
      command: "search",
      ...(args.direction === undefined ? {} : { direction: args.direction }),
      in: args.in,
      location: decisionLocation(args),
      match: args.match,
      ...(args.relatedTo === undefined ? {} : { relatedTo: args.relatedTo }),
      ...(args.relationType === undefined
        ? {}
        : { relationType: args.relationType }),
      status: args.status,
      tags: args.tags,
      text: args.text
    },
    io
  );
}

async function runShow(
  args: CliArgsFor<"show">,
  io: DecisionRecordsCliIo
): Promise<number> {
  return await runQuery(
    {
      command: "show",
      location: decisionLocation(args),
      decisionId: args.decisionId
    },
    io
  );
}

async function runShowCandidate(
  args: CliArgsFor<"show-candidate">,
  io: DecisionRecordsCliIo
): Promise<number> {
  return await runQuery(
    {
      command: "show-candidate",
      location: decisionLocation(args),
      decisionId: args.decisionId
    },
    io
  );
}

async function runTrace(
  args: CliArgsFor<"trace">,
  io: DecisionRecordsCliIo
): Promise<number> {
  return await runQuery(
    {
      command: "trace",
      location: decisionLocation(args),
      decisionId: args.decisionId,
      ...(args.traceDirection === undefined
        ? {}
        : { direction: args.traceDirection }),
      ...(args.traceDepth === undefined ? {} : { maxDepth: args.traceDepth }),
      ...(args.traceMaxRecords === undefined
        ? {}
        : { maxRecords: args.traceMaxRecords })
    },
    io,
    args.traceJson
  );
}

async function runSyncIndex(
  args: CliArgsFor<"sync-index">,
  io: DecisionRecordsCliIo
): Promise<number> {
  return await runQuery(
    {
      command: "sync-index",
      location: decisionLocation(args),
      ...(args.selectors === undefined ? {} : { selectors: args.selectors }),
      write: args.write
    },
    io
  );
}

const queryCommandHandlers = {
  candidates: runCandidates,
  check: runCheck,
  list: runList,
  search: runSearch,
  show: runShow,
  "show-candidate": runShowCandidate,
  "sync-index": runSyncIndex,
  trace: runTrace
} as const;

export async function runQueryCommand(
  args: QueryCliArgs,
  io: DecisionRecordsCliIo
): Promise<number> {
  const handler = queryCommandHandlers[args.command] as (
    value: typeof args,
    output: DecisionRecordsCliIo
  ) => Promise<number>;
  return await handler(args, io);
}

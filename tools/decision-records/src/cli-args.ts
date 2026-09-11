import type {
  DecisionAlignment,
  DecisionId,
  DecisionListAlignment,
  DecisionListStatus,
  DecisionRelation,
  DecisionRelationOverride,
  DecisionRelationSummary,
  DecisionRelationType,
  DecisionSuccessor,
  DecisionTag,
  DecisionTraceDirection
} from "./types.ts";

export type Command =
  | "activate"
  | "archive"
  | "candidates"
  | "check"
  | "discard"
  | "evolve"
  | "list"
  | "mark-aligned"
  | "new"
  | "rename"
  | "search"
  | "show"
  | "show-candidate"
  | "stage"
  | "sync-index"
  | "trace";

type LocatedCommand<
  TCommand extends Command,
  TOptions extends object = Record<never, never>
> = TOptions & {
  command: TCommand;
  decisionsDir: string;
  workspaceRoot: string;
};

export type CliArgs =
  | LocatedCommand<
      "activate",
      {
        alignment: DecisionAlignment;
        decisionId: DecisionId;
        keepUnrecordedHistory: boolean;
        preflight: boolean;
        relationOverride: DecisionRelationOverride;
      }
    >
  | LocatedCommand<
      "archive",
      {
        decisionIds: DecisionId[];
        keepUnrecordedHistory: boolean;
      }
    >
  | LocatedCommand<"candidates">
  | LocatedCommand<"check">
  | LocatedCommand<
      "discard",
      { decisionId: DecisionId; deleteRecordedDecision: boolean }
    >
  | LocatedCommand<
      "evolve",
      {
        discardId: DecisionId | null;
        deleteRecordedDecision: boolean;
        keepUnrecordedHistory: boolean;
        preflight: boolean;
        relationOverride: DecisionRelationOverride;
        successors: DecisionSuccessor[];
      }
    >
  | LocatedCommand<
      "list",
      {
        alignment: DecisionListAlignment;
        createdAtFrom?: string;
        createdAtTo?: string;
        detail: boolean;
        direction?: DecisionTraceDirection;
        fullTime: boolean;
        limit: number;
        offset: number;
        relatedTo?: string;
        relationType?: DecisionRelationType;
        status: DecisionListStatus;
        tags: DecisionTag[];
      }
    >
  | LocatedCommand<"mark-aligned", { decisionId: DecisionId }>
  | LocatedCommand<
      "new",
      {
        background: string;
        decision: string;
        decisionId: DecisionId;
        preflightAlignment: DecisionAlignment | null;
        purpose: string;
        relations: DecisionRelation[];
        relationSummaries: DecisionRelationSummary[];
        tags: DecisionTag[];
        title: string;
      }
    >
  | LocatedCommand<
      "rename",
      {
        preflight: boolean;
        renameRecordedDecision: boolean;
        source: string;
        target: string;
      }
    >
  | LocatedCommand<
      "search",
      {
        alignment: DecisionListAlignment;
        direction?: DecisionTraceDirection;
        in: "content" | "metadata";
        match: "all" | "any" | "phrase";
        relatedTo?: string;
        relationType?: DecisionRelationType;
        status: DecisionListStatus;
        tags: DecisionTag[];
        text: string;
      }
    >
  | LocatedCommand<"show", { decisionId: DecisionId }>
  | LocatedCommand<"show-candidate", { decisionId: DecisionId }>
  | LocatedCommand<"stage", { decisionIds: DecisionId[] }>
  | LocatedCommand<
      "sync-index",
      { selectors?: readonly string[]; write: boolean }
    >
  | LocatedCommand<
      "trace",
      {
        decisionId: DecisionId;
        traceDepth?: number | null;
        traceDirection?: DecisionTraceDirection;
        traceMaxRecords?: number;
      }
    >;

export type CliArgsFor<TCommand extends Command> = Extract<
  CliArgs,
  { command: TCommand }
>;

export { createCliProgram } from "./cli-program.ts";
export type { CreateCliProgramOptions } from "./cli-command-arguments.ts";

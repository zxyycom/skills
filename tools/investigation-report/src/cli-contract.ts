import type { InvestigationRelationSummaryInput } from "./relation-summary.ts";

export type InvestigationReportCliIo = Readonly<{
  stderr: (text: string) => void;
  stdout: (text: string) => void;
}>;

export type InvestigationReportCliOptions = Readonly<{
  io?: InvestigationReportCliIo;
}>;

export type InvestigationCommand =
  | "new"
  | "candidates"
  | "check"
  | "discard"
  | "discard-candidate"
  | "list"
  | "search"
  | "show"
  | "show-candidate"
  | "publish"
  | "rename"
  | "stage-index"
  | "sync-index"
  | "trace"
  | "set-relations";

export type RelationCliEvent =
  | Readonly<{ kind: "source"; value: string }>
  | Readonly<{ kind: "relation"; value: string }>
  | Readonly<{ kind: "relation-summary"; value: string }>
  | Readonly<{ kind: "clear" }>;

export type ParsedCli = Readonly<{
  command: InvestigationCommand;
  positionals: string[];
  relationEvents?: readonly RelationCliEvent[];
  values: Map<string, string[]>;
}>;

export type CliParseResult =
  | { command?: InvestigationCommand; status: "help" }
  | { status: "invalid"; error: string }
  | { status: "command"; value: ParsedCli };

export type CommonInvestigationQueryOptions = Readonly<{
  direction?: string;
  formedAtFrom?: string;
  formedAtTo?: string;
  investigationsDir?: string;
  limit?: number;
  relatedTo?: string;
  relationType?: string;
  tags?: readonly string[];
  workspaceRoot: string;
}>;

export type RawInvestigationRelationReplacement = Readonly<{
  relations: readonly Readonly<{ target: string; type: string }>[];
  relationSummaries: readonly InvestigationRelationSummaryInput[];
  source: string;
}>;

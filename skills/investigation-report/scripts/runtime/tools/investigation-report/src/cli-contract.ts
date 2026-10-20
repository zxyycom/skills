/*
 * Synced TypeScript runtime; repository maintenance edits tools/investigation-report/src/cli-contract.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/investigation-report/src/cli-contract.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/investigation-report/src/cli-contract.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/investigation-report
 * Rebuild: bun run sync:investigation-report-check
 */
import type { InvestigationRelationSummaryInput } from "./relation-summary.ts";

export type InvestigationReportCliIo = Readonly<{
  stderr: (text: string) => void;
  stdout: (text: string) => void;
}>;

export type InvestigationReportCliOptions = Readonly<{
  cwd?: string;
  io?: InvestigationReportCliIo;
}>;

export type InvestigationCommand =
  | "new"
  | "candidates"
  | "check"
  | "discard"
  | "list"
  | "search"
  | "show"
  | "show-candidate"
  | "publish"
  | "rename"
  | "stage"
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

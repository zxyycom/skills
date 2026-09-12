import { stateIndexQueryMaximumLimit } from "../../index-runtime/src/index.ts";
import { investigationListDefaultLimit } from "./query.ts";
import type {
  InvestigationCommand,
  InvestigationReportCliIo
} from "./cli-contract.ts";
import { writeLine } from "./cli-io.ts";

const commandHelp: Record<InvestigationCommand, readonly string[]> = {
  new: [
    "Usage: investigation-report new <name-or-id> --title <title> --question <question> --tag <tag>... [--formed-at <rfc3339>] [--relation <type=target-selector>...] [--relation-summary <target-selector=summary>...] [options]",
    "",
    "Atomically create a non-formal authoring candidate. Creation succeeds independently of body, resource, or publish readiness."
  ],
  rename: [
    "Usage: investigation-report rename <source-selector> <target-name-or-id> [--preflight] [options]",
    "",
    "Rename one candidate or formal report identity, all managed relations and resource references, its owner directory, and the complete formal index."
  ],
  candidates: [
    "Usage: investigation-report candidates [options]",
    "",
    "List authoring candidates without reading or changing the formal derived index."
  ],
  check: [
    "Usage: investigation-report [check] [--id <investigation-id> ...] [options]",
    "",
    "Validate reports, the complete relation graph, resource ownership, and the current index.",
    "Scoped --id checks validate only selected reports and their declared resources."
  ],
  discard: [
    "Usage: investigation-report discard <investigation-id> [--delete-owned-resources] [--delete-recorded-report] [options]",
    "",
    "Delete one established report after a full graph and resource preflight.",
    "Refuses remaining relation references and shared owner resources. Reports or owned resources in Git HEAD require --delete-recorded-report."
  ],
  "discard-candidate": [
    "Usage: investigation-report discard-candidate <investigation-id> [--delete-owned-resources] [--delete-recorded-candidate] [options]",
    "",
    "Delete one authoring candidate and only its explicitly confirmed owner resources; formal reports and the formal index remain unchanged."
  ],
  list: [
    "Usage: investigation-report list [--tag <tag> ...] [options]",
    "",
    "List reports from the current derived index."
  ],
  search: [
    "Usage: investigation-report search <text> [--in content|metadata] [--match all|any|phrase] [options]",
    "",
    "Search formal report content by default, or only the published index metadata."
  ],
  show: [
    "Usage: investigation-report show <investigation-id> [options]",
    "",
    "Print one report Markdown document from the current derived index."
  ],
  "show-candidate": [
    "Usage: investigation-report show-candidate <investigation-id> [options]",
    "",
    "Print one authoring candidate and its mechanical readiness; this does not publish it."
  ],
  publish: [
    "Usage: investigation-report publish <investigation-id...> [--preflight] [options]",
    "",
    "Validate and establish only explicitly selected candidates. --preflight is read-only and does not create a receipt."
  ],
  "stage-index": [
    "Usage: investigation-report stage-index <investigation-id...> [options]",
    "",
    "Write only selected report entries to the pending index; report Markdown and resources remain outside this operation."
  ],
  "sync-index": [
    "Usage: investigation-report sync-index [--select <name-or-id> ...] [--write] [options]",
    "",
    "Validate the full formal collection and rebuild its derived index in the working tree; this is the explicit recovery and acceptance path for hand-written formal reports and ignores legal candidates."
  ],
  trace: [
    "Usage: investigation-report trace <investigation-id> [options]",
    "",
    "Trace predecessor and successor report relationships from the current derived index."
  ],
  "set-relations": [
    "Usage: investigation-report set-relations --source <selector> (--relation <type=target-selector>... [--relation-summary <target-selector=summary>...] | --clear-relations) [--source ...] [--preflight] [options]",
    "",
    "Atomically replace every selected source relation set and rebuild the workspace index; --preflight validates without writing or staging files."
  ]
};

const sharedOptions = [
  "  --root <workspace-root>       Workspace root (default: current directory)",
  "  --investigations-dir <path>  Investigation root relative to workspace",
  "  -h, --help                    Show this help"
];
const specificOptions: Partial<
  Record<InvestigationCommand, readonly string[]>
> = {
  new: [
    "  --title <title>               Candidate title",
    "  --formed-at <rfc3339>         Known or historical formation time (default: current UTC time)",
    "  --question <question>         Candidate investigation question",
    "  --tag <tag>                   Repeatable candidate tag",
    "  --relation <type=target-selector> Repeatable complete direct predecessor relation",
    "  --relation-summary <target-selector=summary> Optional summary for one target in that complete relation set"
  ],
  check: ["  --id <investigation-id>       Scoped check ID; repeatable"],
  "sync-index": [
    "  --select <name-or-id>          Allow only this report's source change; repeatable",
    "  --write                        Publish the complete validated index projection"
  ],
  discard: [
    "  --delete-owned-resources      Confirm deletion of the report's owner-prefix resources",
    "  --delete-recorded-report      Confirm deletion of report or owned resources already in Git HEAD"
  ],
  "discard-candidate": [
    "  --delete-owned-resources      Confirm deletion of the candidate owner-prefix resources",
    "  --delete-recorded-candidate   Confirm deletion of candidate or owned resources already in Git HEAD"
  ],
  publish: [
    "  --preflight                   Validate the selected final collection without writing candidates, reports, resources, index, or pending"
  ],
  rename: [
    "  --preflight                   Validate the complete rename plan without writing reports, candidates, resources, or index",
    "  --rename-recorded-report      Confirm a formal report identity that has entered Git HEAD",
    "  --rename-recorded-candidate   Confirm a candidate identity that has entered Git HEAD"
  ],
  list: [
    "  --tag <tag>                   Repeatable AND tag filter",
    "  --formed-from <timestamp>     Inclusive formedAt lower bound",
    "  --formed-to <timestamp>       Inclusive formedAt upper bound",
    "  --related-to <selector>       Direct relation target selector",
    "  --direction <direction>       predecessors, successors, or both (default: both)",
    "  --relation-type <type>        Direct relation type",
    `  --limit <count>               Page size (default: ${investigationListDefaultLimit}, maximum: ${stateIndexQueryMaximumLimit})`,
    "  --offset <count>              Page offset (default: 0)",
    "  --detail                     Show full facets and existing multi-line records"
  ],
  search: [
    "  --in <scope>                  content (default) or published index metadata",
    "  --match <mode>                all, any, or phrase (default: all)",
    "  --tag <tag>                   Repeatable AND tag filter",
    "  --formed-from <timestamp>     Inclusive formedAt lower bound",
    "  --formed-to <timestamp>       Inclusive formedAt upper bound",
    "  --related-to <selector>       Direct relation target selector",
    "  --direction <direction>       predecessors, successors, or both (default: both)",
    "  --relation-type <type>        Direct relation type",
    "  --limit <count>               Maximum matched reports (default: 50, maximum: 1000)"
  ],
  trace: [
    "  --direction <direction>       predecessors, successors, or both (default: both)",
    "  --depth <count|all>           Maximum relation depth (default: 5; all disables the limit)",
    "  --max-records <count>         Positive record budget (default: 50)",
    "  --json                        Output the stable JSON trace envelope"
  ],
  "set-relations": [
    "  --source <investigation-id>   Start one complete replacement source group",
    "  --relation <type=target-id>   Add one relation to the active source group",
    "  --relation-summary <target-selector=summary> Add one optional summary to the active source group",
    "  --clear-relations             Explicitly clear the active source group",
    "  --preflight                   Validate the replacement without writing reports, index, pending, resources, or staging"
  ]
};

export function printHelp(
  command: InvestigationCommand | undefined,
  io: InvestigationReportCliIo
): void {
  const lines =
    command === undefined
      ? generalHelpLines()
      : [
          ...commandHelp[command],
          "",
          "Options:",
          ...sharedOptions,
          ...(specificOptions[command] ?? []),
          "",
          exitStatusLine
        ];
  writeLine(io.stdout, lines.join("\n"));
}
const exitStatusLine =
  "Exit status: 0 success; 1 check, operation, or deletion-confirmation failure; 2 invalid CLI arguments.";
function generalHelpLines(): string[] {
  return [
    "Usage: investigation-report <command> [options]",
    "       investigation-report [check] [options]",
    "       investigation-report help <command>",
    "",
    "Check, query, and maintain flat Investigation Report records and their derived index.",
    "",
    "Commands: new, candidates, show-candidate, publish, rename, discard-candidate, check, sync-index, list, search, show, trace, set-relations, stage-index, discard",
    "Run investigation-report help <command> for command options.",
    "",
    exitStatusLine
  ];
}

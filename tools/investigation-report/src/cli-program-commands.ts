import { Command as CommanderCommand, Option } from "commander";
import type { InvestigationCommand, RelationCliEvent } from "./cli-contract.ts";

type CommandOptionSpec = Readonly<{
  description: string;
  flags: string;
}>;

type CommandSpec = Readonly<{
  description: string;
  name: InvestigationCommand;
  options?: readonly CommandOptionSpec[];
  /** Positional placeholders; counts stay validated by the command handlers. */
  positionals?: readonly string[];
}>;

const commandSpecs: readonly CommandSpec[] = [
  {
    description:
      "Atomically create a non-formal authoring candidate. Creation succeeds independently of body, resource, or publish readiness.",
    name: "new",
    options: [
      { description: "Candidate title", flags: "--title <title>" },
      {
        description:
          "Known or historical formation time (default: current UTC time)",
        flags: "--formed-at <rfc3339>"
      },
      {
        description: "Candidate investigation question",
        flags: "--question <question>"
      },
      { description: "Repeatable candidate tag", flags: "--tag <tag>" },
      {
        description: "Repeatable complete direct predecessor relation",
        flags: "--relation <type=target-selector>"
      },
      {
        description:
          "Optional summary for one target in that complete relation set",
        flags: "--relation-summary <target-selector=summary>"
      }
    ],
    positionals: ["[name-or-id]"]
  },
  {
    description:
      "List authoring candidates without reading or changing the formal derived index.",
    name: "candidates"
  },
  {
    description:
      "Print one authoring candidate and its mechanical readiness; this does not publish it.",
    name: "show-candidate",
    positionals: ["[investigation-id]"]
  },
  {
    description:
      "Validate and establish only explicitly selected candidates. --preflight is read-only and does not create a receipt.",
    name: "publish",
    options: [
      {
        description:
          "Validate the selected final collection without writing candidates, reports, resources, index, or pending",
        flags: "--preflight"
      }
    ],
    positionals: ["[investigation-id...]"]
  },
  {
    description:
      "Rename one candidate or formal report identity, all managed relations and resource references, its owner directory, and the complete formal index.",
    name: "rename",
    options: [
      {
        description:
          "Validate the complete rename plan without writing reports, candidates, resources, or index",
        flags: "--preflight"
      },
      {
        description:
          "Confirm a formal report identity that has entered Git HEAD",
        flags: "--rename-recorded-report"
      },
      {
        description: "Confirm a candidate identity that has entered Git HEAD",
        flags: "--rename-recorded-candidate"
      }
    ],
    positionals: ["[source-selector]", "[target-name-or-id]"]
  },
  {
    description:
      "Validate reports, the complete relation graph, resource ownership, and the current index. Scoped --id checks validate only selected reports and their declared resources.",
    name: "check",
    options: [
      {
        description: "Scoped check ID; repeatable",
        flags: "--id <investigation-id>"
      }
    ]
  },
  {
    description:
      "Validate the full formal collection and rebuild and publish its complete derived index in the working tree; this is the explicit recovery and acceptance path for hand-written formal reports and ignores legal candidates.",
    name: "sync-index",
    options: [
      {
        description: "Accept only this report's source change; repeatable",
        flags: "--select <name-or-id>"
      },
      {
        description:
          "Validate the complete projection and report the outcome without writing the index",
        flags: "--preflight"
      }
    ]
  },
  {
    description: "List reports from the current derived index.",
    name: "list",
    options: [
      { description: "Repeatable AND tag filter", flags: "--tag <tag>" },
      {
        description: "Inclusive formedAt lower bound",
        flags: "--formed-from <timestamp>"
      },
      {
        description: "Inclusive formedAt upper bound",
        flags: "--formed-to <timestamp>"
      },
      {
        description: "Direct relation target selector",
        flags: "--related-to <selector>"
      },
      {
        description: "predecessors, successors, or both (default: both)",
        flags: "--direction <direction>"
      },
      {
        description: "Direct relation type",
        flags: "--relation-type <type>"
      },
      {
        description: "Page size (default: 10, maximum: 1000)",
        flags: "--limit <count>"
      },
      {
        description: "Page offset (default: 0)",
        flags: "--offset <count>"
      },
      {
        description: "Show full facets and existing multi-line records",
        flags: "--detail"
      }
    ]
  },
  {
    description:
      "Search formal report content by default, or only the published index metadata.",
    name: "search",
    options: [
      {
        description: "content (default) or published index metadata",
        flags: "--in <scope>"
      },
      {
        description: "all, any, or phrase (default: all)",
        flags: "--match <mode>"
      },
      { description: "Repeatable AND tag filter", flags: "--tag <tag>" },
      {
        description: "Inclusive formedAt lower bound",
        flags: "--formed-from <timestamp>"
      },
      {
        description: "Inclusive formedAt upper bound",
        flags: "--formed-to <timestamp>"
      },
      {
        description: "Direct relation target selector",
        flags: "--related-to <selector>"
      },
      {
        description: "predecessors, successors, or both (default: both)",
        flags: "--direction <direction>"
      },
      {
        description: "Direct relation type",
        flags: "--relation-type <type>"
      },
      {
        description: "Maximum matched reports (default: 50, maximum: 1000)",
        flags: "--limit <count>"
      }
    ],
    positionals: ["[text]"]
  },
  {
    description:
      "Print one report Markdown document from the current derived index.",
    name: "show",
    positionals: ["[investigation-id]"]
  },
  {
    description:
      "Trace predecessor and successor report relationships from the current derived index.",
    name: "trace",
    options: [
      {
        description: "predecessors, successors, or both (default: both)",
        flags: "--direction <direction>"
      },
      {
        description:
          "Maximum relation depth (default: 5; all disables the limit)",
        flags: "--depth <count|all>"
      },
      {
        description: "Positive record budget (default: 50)",
        flags: "--max-records <count>"
      },
      { description: "Output the stable JSON trace envelope", flags: "--json" }
    ],
    positionals: ["[investigation-id]"]
  },
  {
    description:
      "Atomically replace every selected source relation set and rebuild the workspace index; --preflight validates without writing or staging files.",
    name: "set-relations",
    options: [
      {
        description: "Start one complete replacement source group",
        flags: "--source <investigation-id>"
      },
      {
        description: "Add one relation to the active source group",
        flags: "--relation <type=target-id>"
      },
      {
        description: "Add one optional summary to the active source group",
        flags: "--relation-summary <target-selector=summary>"
      },
      {
        description: "Explicitly clear the active source group",
        flags: "--clear-relations"
      },
      {
        description:
          "Validate the replacement without writing reports, index, pending, resources, or staging",
        flags: "--preflight"
      }
    ]
  },
  {
    description:
      "Write only selected report entries to the pending index; report Markdown and resources remain outside this operation.",
    name: "stage-index",
    positionals: ["[investigation-id...]"]
  },
  {
    description:
      "Delete one authoring candidate or established report after a full graph and resource preflight. Refuses remaining relation references and shared owner resources; records or owned resources in Git HEAD require --delete-recorded.",
    name: "discard",
    options: [
      {
        description: "Confirm deletion of the target's owner-prefix resources",
        flags: "--delete-owned-resources"
      },
      {
        description:
          "Confirm deletion of candidate, report, or owned resources already in Git HEAD",
        flags: "--delete-recorded"
      }
    ],
    positionals: ["[investigation-id]"]
  }
];

/**
 * Collects every option occurrence so repeatable options keep their value
 * lists and single-use options stay detectable by the command handlers.
 */
function collectingOption(spec: CommandOptionSpec): Option {
  return new Option(spec.flags, spec.description).argParser(
    (value: string | true | null, previous: readonly (string | true)[]) => [
      ...(previous ?? []),
      value ?? true
    ]
  );
}

const relationEventsByCommand = new WeakMap<
  CommanderCommand,
  RelationCliEvent[]
>();

/**
 * Retains the relation-option event order Commander otherwise discards when
 * it accumulates repeated options. The collector is local to one command.
 */
function collectRelationEvents(command: CommanderCommand): void {
  const events: RelationCliEvent[] = [];
  relationEventsByCommand.set(command, events);
  command.on("option:source", (value: string | undefined) => {
    events.push({ kind: "source", value: value ?? "" });
  });
  command.on("option:relation", (value: string | undefined) => {
    events.push({ kind: "relation", value: value ?? "" });
  });
  command.on("option:relation-summary", (value: string | undefined) => {
    events.push({ kind: "relation-summary", value: value ?? "" });
  });
  command.on("option:clear-relations", () => {
    events.push({ kind: "clear" });
  });
}

export type InvestigationProgramExecute = (
  command: InvestigationCommand,
  commanderCommand: CommanderCommand
) => Promise<void>;

export function registerInvestigationCommands(
  program: CommanderCommand,
  execute: InvestigationProgramExecute
): void {
  for (const spec of commandSpecs) registerCommand(program, spec, execute);
}

function registerCommand(
  program: CommanderCommand,
  spec: CommandSpec,
  execute: InvestigationProgramExecute
): void {
  const positionals = spec.positionals === undefined ? [] : spec.positionals;
  const options = spec.options === undefined ? [] : spec.options;
  const command = program
    .command(spec.name)
    .description(spec.description)
    .exitOverride();
  for (const positional of positionals) command.argument(positional);
  for (const option of options) command.addOption(collectingOption(option));
  command.action(() => execute(spec.name, command));
  if (spec.name === "set-relations") collectRelationEvents(command);
}

export function collectedRelationEvents(
  command: CommanderCommand
): readonly RelationCliEvent[] | undefined {
  const events = relationEventsByCommand.get(command);
  return events === undefined ? undefined : [...events];
}

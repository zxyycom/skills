import { Command as CommanderCommand, InvalidArgumentError } from "commander";
import {
  parseDecisionRelation,
  parseDecisionRelationSummary,
  parseSingleDecisionId
} from "./cli-option-parsers.ts";
import type {
  DecisionId,
  DecisionRelation,
  DecisionRelationOverride,
  DecisionRelationOverrideGroup,
  DecisionRelationSummary
} from "./types.ts";

type EvolveRelationEvent =
  | { kind: "clear" }
  | { kind: "group"; source: DecisionId }
  | { kind: "relation"; relation: DecisionRelation }
  | { kind: "summary"; summary: DecisionRelationSummary };

type RelationGroupInput = {
  clear: boolean;
  relations: DecisionRelation[];
  source: DecisionId;
  summaries: DecisionRelationSummary[];
};

const eventsByCommand = new WeakMap<object, EvolveRelationEvent[]>();

export type EvolveRelationOverrides = {
  relationOverride: DecisionRelationOverride;
  relationOverrideGroups: DecisionRelationOverrideGroup[];
};

/**
 * Retains the relation-option event order Commander otherwise discards when it
 * accumulates repeated options. The collector is local to one evolve command.
 */
export function collectEvolveRelationEvents(
  command: CommanderCommand
): () => readonly EvolveRelationEvent[] {
  const events: EvolveRelationEvent[] = [];
  eventsByCommand.set(command, events);
  command.on("option:relations-for", (value) => {
    events.push({ kind: "group", source: parseSingleDecisionId(value ?? "") });
  });
  command.on("option:relation", (value) => {
    const relation = parseDecisionRelation(value ?? "")[0];
    if (relation === undefined) throw new InvalidArgumentError("is required");
    events.push({ kind: "relation", relation });
  });
  command.on("option:relation-summary", (value) => {
    const summary = parseDecisionRelationSummary(value ?? "")[0];
    if (summary === undefined) throw new InvalidArgumentError("is required");
    events.push({ kind: "summary", summary });
  });
  command.on("option:clear-relations", () => events.push({ kind: "clear" }));
  return () => events;
}

export function collectedEvolveRelationEvents(
  command: CommanderCommand
): readonly EvolveRelationEvent[] {
  return eventsByCommand.get(command) ?? [];
}

export function evolveRelationOverrides(
  events: readonly EvolveRelationEvent[]
): EvolveRelationOverrides {
  const groupEvents = events.filter((event) => event.kind === "group");
  if (groupEvents.length === 0) {
    return {
      relationOverride: relationOverrideForEvents(events, "command"),
      relationOverrideGroups: []
    };
  }

  const groups: RelationGroupInput[] = [];
  let current: RelationGroupInput | null = null;
  for (const event of events) {
    if (event.kind === "group") {
      if (current !== null) groups.push(current);
      current = {
        clear: false,
        relations: [],
        source: event.source,
        summaries: []
      };
      continue;
    }
    if (current === null) {
      throw new InvalidArgumentError(
        "--relation, --relation-summary, and --clear-relations must follow --relations-for"
      );
    }
    if (event.kind === "clear") current.clear = true;
    if (event.kind === "relation") current.relations.push(event.relation);
    if (event.kind === "summary") current.summaries.push(event.summary);
  }
  if (current !== null) groups.push(current);

  const sources = new Set<DecisionId>();
  return {
    relationOverride: { kind: "source" },
    relationOverrideGroups: groups.map((group) => {
      if (sources.has(group.source)) {
        throw new InvalidArgumentError(
          "--relations-for must not repeat a successor Decision selector"
        );
      }
      sources.add(group.source);
      return {
        relationOverride: relationOverrideForValues(group, "group"),
        source: group.source
      };
    })
  };
}

export function evolveRelationOverridesForCommand(
  command: CommanderCommand
): EvolveRelationOverrides {
  try {
    return evolveRelationOverrides(collectedEvolveRelationEvents(command));
  } catch (error) {
    if (error instanceof InvalidArgumentError) {
      command.error(error.message, {
        code: "decision-records.relation-options-invalid",
        exitCode: 2
      });
    }
    throw error;
  }
}

function relationOverrideForEvents(
  events: readonly EvolveRelationEvent[],
  scope: "command" | "group"
): DecisionRelationOverride {
  return relationOverrideForValues(
    {
      clear: events.some((event) => event.kind === "clear"),
      relations: events.flatMap((event) =>
        event.kind === "relation" ? [event.relation] : []
      ),
      summaries: events.flatMap((event) =>
        event.kind === "summary" ? [event.summary] : []
      )
    },
    scope
  );
}

function relationOverrideForValues(
  values: Pick<RelationGroupInput, "clear" | "relations" | "summaries">,
  scope: "command" | "group"
): DecisionRelationOverride {
  if (values.clear) return clearedRelationOverride(values);
  if (values.relations.length === 0)
    return sourceRelationOverride(values.summaries, scope);
  return replacementRelationOverride(values);
}

function clearedRelationOverride(
  values: Pick<RelationGroupInput, "relations" | "summaries">
): DecisionRelationOverride {
  if (values.relations.length > 0 || values.summaries.length > 0) {
    throw new InvalidArgumentError(
      "--clear-relations cannot be used with --relation or --relation-summary"
    );
  }
  return { kind: "replace", relations: [] };
}

function sourceRelationOverride(
  summaries: readonly DecisionRelationSummary[],
  scope: "command" | "group"
): DecisionRelationOverride {
  if (summaries.length > 0) {
    throw new InvalidArgumentError(
      "--relation-summary requires at least one --relation"
    );
  }
  if (scope === "group") {
    throw new InvalidArgumentError(
      "--relations-for requires at least one --relation or --clear-relations"
    );
  }
  return { kind: "source" };
}

function replacementRelationOverride(
  values: Pick<RelationGroupInput, "relations" | "summaries">
): DecisionRelationOverride {
  const targets = new Set<DecisionId>();
  for (const relation of values.relations) {
    if (targets.has(relation.target)) {
      throw new InvalidArgumentError(
        "must not repeat a direct predecessor target within one relation group"
      );
    }
    targets.add(relation.target);
  }
  const summaryTargets = new Set<DecisionId>();
  for (const summary of values.summaries) {
    if (summaryTargets.has(summary.target)) {
      throw new InvalidArgumentError(
        "must not repeat a relation-summary target within one relation group"
      );
    }
    summaryTargets.add(summary.target);
  }
  return {
    kind: "replace",
    relations: values.relations,
    ...(values.summaries.length === 0
      ? {}
      : { relationSummaries: values.summaries })
  };
}

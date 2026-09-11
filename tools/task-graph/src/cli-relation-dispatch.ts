import {
  failArgument,
  parseCommandOptions,
  requirePositionals
} from "./cli-arguments.ts";
import type { DispatchResult, ParsedCommandOptions } from "./cli-contract.ts";
import { requiredRevision, taskMutationResult } from "./cli-task-dispatch.ts";
import { TaskGraphService } from "./service.ts";

export async function dispatchRelationCommand(
  service: TaskGraphService,
  tokens: readonly string[]
): Promise<DispatchResult> {
  const subcommand = tokens[1];
  const parsed = parseCommandOptions(tokens.slice(2), {
    "expected-revision": { kind: "string" }
  });
  const expectedRevision = requiredRevision(parsed);
  if (subcommand === "parent") {
    return await dispatchParentRelation(service, parsed, expectedRevision);
  }
  if (subcommand === "dependency-add" || subcommand === "dependency-remove") {
    return await dispatchDependencyRelation(
      service,
      parsed,
      expectedRevision,
      subcommand
    );
  }
  if (subcommand === "exclusion-add" || subcommand === "exclusion-remove") {
    return await dispatchExclusionRelation(
      service,
      parsed,
      expectedRevision,
      subcommand
    );
  }
  failArgument("Unknown relation command", { command: subcommand ?? null });
}

async function dispatchParentRelation(
  service: TaskGraphService,
  parsed: ParsedCommandOptions,
  expectedRevision: number
): Promise<DispatchResult> {
  const [taskId = "", parent = ""] = requirePositionals(
    parsed,
    2,
    "task-graph relation parent <task-id> <parent-id|null> --expected-revision <n>"
  );
  const applied = await service.apply({
    expectedRevision,
    operations: [
      {
        kind: "set-parent",
        taskId,
        parentId: parent === "null" ? null : parent
      }
    ]
  });
  return taskMutationResult(applied.revision, taskId);
}

async function dispatchDependencyRelation(
  service: TaskGraphService,
  parsed: ParsedCommandOptions,
  expectedRevision: number,
  subcommand: "dependency-add" | "dependency-remove"
): Promise<DispatchResult> {
  const [taskId = "", dependencyId = ""] = requirePositionals(
    parsed,
    2,
    `task-graph relation ${subcommand} <task-id> <dependency-id> --expected-revision <n>`
  );
  const applied = await service.apply({
    expectedRevision,
    operations: [
      {
        kind: "set-dependency",
        taskId,
        dependencyId,
        present: subcommand === "dependency-add"
      }
    ]
  });
  return taskMutationResult(applied.revision, taskId);
}

async function dispatchExclusionRelation(
  service: TaskGraphService,
  parsed: ParsedCommandOptions,
  expectedRevision: number,
  subcommand: "exclusion-add" | "exclusion-remove"
): Promise<DispatchResult> {
  const [taskId = "", excludedTaskId = ""] = requirePositionals(
    parsed,
    2,
    `task-graph relation ${subcommand} <task-id> <excluded-id> --expected-revision <n>`
  );
  const applied = await service.apply({
    expectedRevision,
    operations: [
      {
        kind: "set-exclusion",
        taskId,
        excludedTaskId,
        present: subcommand === "exclusion-add"
      }
    ]
  });
  return {
    revision: applied.revision,
    data: { taskId, excludedTaskId }
  };
}

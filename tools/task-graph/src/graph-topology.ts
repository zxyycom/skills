import { TaskGraphError } from "./errors.ts";
import type {
  TaskConstraintSource,
  TaskIndex,
  TaskProjection
} from "./types.ts";

export const compareText = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

export function childrenByTask(index: TaskIndex): Map<string, string[]> {
  const children = new Map<string, string[]>(
    Object.keys(index.tasks).map((taskId) => [taskId, []])
  );
  for (const [taskId, task] of Object.entries(index.tasks)) {
    const parentId = task.state.relations.parentId;
    if (parentId !== null) {
      children.get(parentId)?.push(taskId);
    }
  }
  for (const values of children.values()) {
    values.sort(compareText);
  }
  return children;
}

function parentTaskId(index: TaskIndex, taskId: string): string | null {
  return index.tasks[taskId]?.state.relations.parentId ?? null;
}

export function ancestorIds(index: TaskIndex, taskId: string): string[] {
  const result: string[] = [];
  const visited = new Set<string>([taskId]);
  let current = parentTaskId(index, taskId);
  while (current !== null) {
    if (visited.has(current)) return result;
    result.push(current);
    visited.add(current);
    current = parentTaskId(index, current);
  }
  return result;
}

export function lineage(index: TaskIndex, taskId: string): string[] {
  return [taskId, ...ancestorIds(index, taskId)];
}

export function descendantIds(index: TaskIndex, taskId: string): string[] {
  const children = childrenByTask(index);
  const descendants: string[] = [];
  const visited = new Set<string>([taskId]);
  const queue = [...(children.get(taskId) ?? [])];
  while (queue.length > 0) {
    const next = queue.shift();
    if (next === undefined) {
      continue;
    }
    if (visited.has(next)) {
      continue;
    }
    visited.add(next);
    descendants.push(next);
    queue.push(...(children.get(next) ?? []));
  }
  return descendants;
}

export function effectiveControl(
  index: TaskIndex,
  taskId: string
): TaskProjection["effectiveControl"] {
  const path: string[] = [];
  for (const candidateId of lineage(index, taskId)) {
    path.push(candidateId);
    const control = index.tasks[candidateId]?.state.control;
    if (control !== undefined && control.mode !== "inherit") {
      return {
        mode: control.mode,
        reason: control.reason,
        sourceTaskId: candidateId,
        inheritancePath: [...path]
      };
    }
  }
  throw new TaskGraphError(
    "TOPOLOGY_INVALID",
    `Task ${taskId} has no non-inherit control source`
  );
}

export function effectiveDependencySources(
  index: TaskIndex,
  taskId: string
): TaskConstraintSource[] {
  const sources: TaskConstraintSource[] = [];
  const path: string[] = [];
  for (const sourceTaskId of lineage(index, taskId)) {
    path.push(sourceTaskId);
    for (const targetTaskId of Object.keys(
      index.tasks[sourceTaskId]?.state.relations.dependsOn ?? {}
    )) {
      sources.push({
        targetTaskId,
        sourceTaskId,
        inheritancePath: [...path],
        declaredTargetTaskId: targetTaskId,
        targetInheritancePath: [targetTaskId]
      });
    }
  }
  return sources.sort(
    (left, right) =>
      compareText(left.targetTaskId, right.targetTaskId) ||
      compareText(left.sourceTaskId, right.sourceTaskId)
  );
}

function exclusionSourcesForTarget(
  index: TaskIndex,
  taskId: string,
  targetTaskId: string,
  currentLineage: readonly string[],
  pathBySource: ReadonlyMap<string, string[]>
): TaskConstraintSource[] {
  const targetLineage = lineage(index, targetTaskId);
  const sources: TaskConstraintSource[] = [];
  for (const sourceTaskId of currentLineage) {
    const targets = Object.keys(
      index.tasks[sourceTaskId]?.state.relations.excludes ?? {}
    );
    for (const declaredTargetTaskId of targets) {
      const targetOffset = targetLineage.indexOf(declaredTargetTaskId);
      if (targetOffset < 0) continue;
      sources.push({
        targetTaskId,
        sourceTaskId,
        inheritancePath: [...(pathBySource.get(sourceTaskId) ?? [taskId])],
        declaredTargetTaskId,
        targetInheritancePath: targetLineage.slice(0, targetOffset + 1)
      });
    }
  }
  return sources;
}

function uniqueSortedExclusions(
  sources: readonly TaskConstraintSource[]
): TaskConstraintSource[] {
  const unique = new Map<string, TaskConstraintSource>();
  for (const source of sources)
    unique.set(
      [
        source.targetTaskId,
        source.sourceTaskId,
        source.inheritancePath.join("/"),
        source.declaredTargetTaskId,
        source.targetInheritancePath.join("/")
      ].join("\0"),
      source
    );
  return [...unique.values()].sort(
    (left, right) =>
      compareText(left.targetTaskId, right.targetTaskId) ||
      compareText(left.sourceTaskId, right.sourceTaskId) ||
      compareText(left.declaredTargetTaskId, right.declaredTargetTaskId) ||
      compareText(
        left.targetInheritancePath.join("/"),
        right.targetInheritancePath.join("/")
      )
  );
}

export function effectiveExclusionSources(
  index: TaskIndex,
  taskId: string
): TaskConstraintSource[] {
  const sources: TaskConstraintSource[] = [];
  const currentLineage = lineage(index, taskId);
  const pathBySource = new Map(
    currentLineage.map((sourceId, index) => [
      sourceId,
      currentLineage.slice(0, index + 1)
    ])
  );
  for (const targetTaskId of Object.keys(index.tasks))
    if (targetTaskId !== taskId)
      sources.push(
        ...exclusionSourcesForTarget(
          index,
          taskId,
          targetTaskId,
          currentLineage,
          pathBySource
        )
      );
  return uniqueSortedExclusions(sources);
}

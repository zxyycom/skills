import { TaskGraphError } from "./errors.ts";
import type {
  ScopeProjection,
  TaskBlocker,
  TaskConstraintSource,
  TaskEffectiveState,
  TaskEntry,
  TaskIndex,
  TaskProjection,
  TaskScope
} from "./types.ts";

const compareText = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

function taskOwnerById(index: TaskIndex): Map<string, string> {
  const owners = new Map<string, string>();
  for (const [scopeId, scope] of Object.entries(index.scopes)) {
    for (const taskId of Object.keys(scope.tasks)) {
      owners.set(taskId, scopeId);
    }
  }
  return owners;
}

export function childrenByTask(scope: TaskScope): Map<string, string[]> {
  const children = new Map<string, string[]>(
    Object.keys(scope.tasks).map((taskId) => [taskId, []])
  );
  for (const [taskId, task] of Object.entries(scope.tasks)) {
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

export function ancestorIds(scope: TaskScope, taskId: string): string[] {
  const result: string[] = [];
  const visited = new Set<string>([taskId]);
  let current = scope.tasks[taskId]?.state.relations.parentId ?? null;
  while (current !== null && !visited.has(current)) {
    result.push(current);
    visited.add(current);
    current = scope.tasks[current]?.state.relations.parentId ?? null;
  }
  return result;
}

function lineage(scope: TaskScope, taskId: string): string[] {
  return [taskId, ...ancestorIds(scope, taskId)];
}

export function descendantIds(scope: TaskScope, taskId: string): string[] {
  const children = childrenByTask(scope);
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
  scope: TaskScope,
  taskId: string
): TaskProjection["effectiveControl"] {
  const path: string[] = [];
  for (const candidateId of lineage(scope, taskId)) {
    path.push(candidateId);
    const control = scope.tasks[candidateId]?.state.control;
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
  scope: TaskScope,
  taskId: string
): TaskConstraintSource[] {
  const sources: TaskConstraintSource[] = [];
  const path: string[] = [];
  for (const sourceTaskId of lineage(scope, taskId)) {
    path.push(sourceTaskId);
    for (const targetTaskId of Object.keys(
      scope.tasks[sourceTaskId]?.state.relations.dependsOn ?? {}
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
  return sources.sort((left, right) =>
    compareText(left.targetTaskId, right.targetTaskId)
      || compareText(left.sourceTaskId, right.sourceTaskId)
  );
}

export function effectiveExclusionSources(
  scope: TaskScope,
  taskId: string
): TaskConstraintSource[] {
  const sources: TaskConstraintSource[] = [];
  const currentLineage = lineage(scope, taskId);
  const pathBySource = new Map(
    currentLineage.map((sourceId, index) => [
      sourceId,
      currentLineage.slice(0, index + 1)
    ])
  );
  for (const targetTaskId of Object.keys(scope.tasks)) {
    if (targetTaskId === taskId) {
      continue;
    }
    const targetLineage = lineage(scope, targetTaskId);
    for (const sourceTaskId of currentLineage) {
      const explicitTargets = Object.keys(
        scope.tasks[sourceTaskId]?.state.relations.excludes ?? {}
      );
      for (const declaredTargetTaskId of explicitTargets) {
        const targetOffset = targetLineage.indexOf(declaredTargetTaskId);
        if (targetOffset < 0) {
          continue;
        }
        sources.push({
          targetTaskId,
          sourceTaskId,
          inheritancePath: [...(pathBySource.get(sourceTaskId) ?? [taskId])],
          declaredTargetTaskId,
          targetInheritancePath: targetLineage.slice(0, targetOffset + 1)
        });
      }
    }
  }
  const unique = new Map<string, TaskConstraintSource>();
  for (const source of sources) {
    unique.set(
      [
        source.targetTaskId,
        source.sourceTaskId,
        source.inheritancePath.join("/"),
        source.declaredTargetTaskId,
        source.targetInheritancePath.join("/")
      ].join("\0"),
      // Keep distinct declarations even when they produce the same effective pair.
      source
    );
  }
  return [...unique.values()].sort((left, right) =>
    compareText(left.targetTaskId, right.targetTaskId)
      || compareText(left.sourceTaskId, right.sourceTaskId)
      || compareText(left.declaredTargetTaskId, right.declaredTargetTaskId)
      || compareText(
        left.targetInheritancePath.join("/"),
        right.targetInheritancePath.join("/")
      )
  );
}

function directEffectiveState(
  scope: TaskScope,
  taskId: string,
  now: Date
): TaskEffectiveState {
  const task = scope.tasks[taskId];
  if (task === undefined) {
    return "waiting";
  }
  switch (task.state.execution.phase) {
    case "succeeded":
    case "failed":
    case "cancelled":
      return task.state.execution.phase;
    case "running":
      return new Date(task.state.execution.lease.expiresAt) <= now
        ? "recovery-needed"
        : "running";
    case "idle":
      break;
  }
  const control = effectiveControl(scope, taskId);
  if (control.mode === "candidate" || control.mode === "waiting" || control.mode === "paused") {
    return control.mode;
  }
  const dependencyBlocked = effectiveDependencySources(scope, taskId).some(
    (source) => scope.tasks[source.targetTaskId]?.state.execution.phase !== "succeeded"
  );
  const taskChildren = childrenByTask(scope).get(taskId) ?? [];
  const exclusionBlocked = taskChildren.length === 0
    && effectiveExclusionSources(scope, taskId).some(
      (source) => scope.tasks[source.targetTaskId]?.state.execution.phase === "running"
    );
  const ancestorBlocked = ancestorIds(scope, taskId).some((ancestorId) => {
    const phase = scope.tasks[ancestorId]?.state.execution.phase;
    return phase === "succeeded" || phase === "cancelled";
  });
  const childBlocked = taskChildren.length > 0 && (
    !taskChildren.every((childId) => {
      const phase = scope.tasks[childId]?.state.execution.phase;
      return phase === "succeeded" || phase === "cancelled";
    })
    || !taskChildren.some(
      (childId) => scope.tasks[childId]?.state.execution.phase === "succeeded"
    )
    || descendantIds(scope, taskId).some(
      (descendantId) => scope.tasks[descendantId]?.state.execution.phase === "running"
    )
  );
  return dependencyBlocked || exclusionBlocked || ancestorBlocked || childBlocked
    ? "waiting"
    : "ready";
}

function blocker(
  kind: TaskBlocker["kind"],
  taskId: string,
  relatedTaskId: string,
  sourceTaskId: string,
  inheritancePath: string[],
  state: TaskEffectiveState
): TaskBlocker {
  const base = {
    taskId,
    relatedTaskId,
    sourceTaskId,
    inheritancePath
  };
  switch (kind) {
    case "control-candidate":
      if (state === "candidate") return { ...base, kind, state };
      break;
    case "control-waiting":
      if (state === "waiting") return { ...base, kind, state };
      break;
    case "control-paused":
      if (state === "paused") return { ...base, kind, state };
      break;
    case "dependency-failed":
      if (state === "failed") return { ...base, kind, state };
      break;
    case "dependency-cancelled":
      if (state === "cancelled") return { ...base, kind, state };
      break;
    case "dependency-incomplete":
      if (state !== "succeeded" && state !== "failed" && state !== "cancelled") {
        return { ...base, kind, state };
      }
      break;
    case "child-incomplete":
      if (state !== "succeeded" && state !== "cancelled") {
        return { ...base, kind, state };
      }
      break;
    case "exclusion-running":
    case "descendant-lease":
      if (state === "running" || state === "recovery-needed") {
        return { ...base, kind, state };
      }
      break;
    case "ancestor-terminal":
      if (state === "succeeded" || state === "cancelled") {
        return { ...base, kind, state };
      }
      break;
    case "all-children-cancelled":
      if (state === "cancelled") return { ...base, kind, state };
      break;
  }
  throw new TaskGraphError(
    "INDEX_INVALID",
    `Blocker ${kind} cannot carry state ${state}`
  );
}

function sortBlockers(blockers: TaskBlocker[]): TaskBlocker[] {
  const unique = new Map<string, TaskBlocker>();
  for (const item of blockers) {
    unique.set(
      [item.kind, item.relatedTaskId, item.sourceTaskId, item.inheritancePath.join("/")]
        .join("\0"),
      item
    );
  }
  return [...unique.values()].sort((left, right) =>
    compareText(left.kind, right.kind)
      || compareText(left.relatedTaskId, right.relatedTaskId)
      || compareText(left.sourceTaskId, right.sourceTaskId)
  );
}

function projectOneTask(
  scope: TaskScope,
  taskId: string,
  now: Date,
  children: Map<string, string[]>,
  dependents: Map<string, string[]>
): TaskProjection {
  const task = Object.hasOwn(scope.tasks, taskId) ? scope.tasks[taskId] : undefined;
  if (task === undefined) {
    throw new TaskGraphError("TASK_NOT_FOUND", `Task ${taskId} does not exist`);
  }
  const control = effectiveControl(scope, taskId);
  const dependencies = effectiveDependencySources(scope, taskId);
  const exclusions = effectiveExclusionSources(scope, taskId);
  const taskChildren = children.get(taskId) ?? [];
  const phase = task.state.execution.phase;
  const commonProjection = {
    taskId,
    effectiveControl: control,
    dependencies,
    exclusions,
    children: [...taskChildren],
    dependents: [...(dependents.get(taskId) ?? [])]
  };
  if (phase !== "idle") {
    return {
      ...commonProjection,
      effectiveState: directEffectiveState(scope, taskId, now),
      blockers: [],
      nextAction: null
    };
  }
  const blockers: TaskBlocker[] = [];

  if (control.mode === "candidate") {
    blockers.push(blocker(
      "control-candidate",
      taskId,
      control.sourceTaskId,
      control.sourceTaskId,
      control.inheritancePath,
      control.mode
    ));
  } else if (control.mode === "waiting") {
    blockers.push(blocker(
      "control-waiting",
      taskId,
      control.sourceTaskId,
      control.sourceTaskId,
      control.inheritancePath,
      control.mode
    ));
  } else if (control.mode === "paused") {
    blockers.push(blocker(
      "control-paused",
      taskId,
      control.sourceTaskId,
      control.sourceTaskId,
      control.inheritancePath,
      control.mode
    ));
  }

  if (control.mode !== "queued") {
    return {
      ...commonProjection,
      effectiveState: control.mode,
      blockers: sortBlockers(blockers),
      nextAction: null
    };
  }

  for (const dependency of dependencies) {
    const target = scope.tasks[dependency.targetTaskId];
    if (target === undefined || target.state.execution.phase === "succeeded") {
      continue;
    }
    const phase = target.state.execution.phase;
    blockers.push(blocker(
      phase === "failed"
        ? "dependency-failed"
        : phase === "cancelled"
          ? "dependency-cancelled"
          : "dependency-incomplete",
      taskId,
      dependency.targetTaskId,
      dependency.sourceTaskId,
      dependency.inheritancePath,
      directEffectiveState(scope, dependency.targetTaskId, now)
    ));
  }

  for (const exclusion of taskChildren.length === 0 ? exclusions : []) {
    const target = scope.tasks[exclusion.targetTaskId];
    if (target?.state.execution.phase !== "running") {
      continue;
    }
    blockers.push(blocker(
      "exclusion-running",
      taskId,
      exclusion.targetTaskId,
      exclusion.sourceTaskId,
      exclusion.inheritancePath,
      directEffectiveState(scope, exclusion.targetTaskId, now)
    ));
  }

  for (const ancestorId of ancestorIds(scope, taskId)) {
    const ancestor = scope.tasks[ancestorId];
    const phase = ancestor?.state.execution.phase;
    if (phase === "succeeded" || phase === "cancelled") {
      blockers.push(blocker(
        "ancestor-terminal",
        taskId,
        ancestorId,
        ancestorId,
        lineage(scope, taskId).slice(0, lineage(scope, taskId).indexOf(ancestorId) + 1),
        phase
      ));
    }
  }

  if (taskChildren.length > 0) {
    for (const childId of taskChildren) {
      const child = scope.tasks[childId];
      if (
        child !== undefined
        && child.state.execution.phase !== "succeeded"
        && child.state.execution.phase !== "cancelled"
      ) {
        blockers.push(blocker(
          "child-incomplete",
          taskId,
          childId,
          taskId,
          [taskId],
          directEffectiveState(scope, childId, now)
        ));
      }
    }
    if (taskChildren.every(
      (childId) => scope.tasks[childId]?.state.execution.phase === "cancelled"
    )) {
      blockers.push(blocker(
        "all-children-cancelled",
        taskId,
        taskId,
        taskId,
        [taskId],
        "cancelled"
      ));
    }
    for (const descendantId of descendantIds(scope, taskId)) {
      const descendant = scope.tasks[descendantId];
      if (descendant?.state.execution.phase === "running") {
        blockers.push(blocker(
          "descendant-lease",
          taskId,
          descendantId,
          taskId,
          [taskId],
          directEffectiveState(scope, descendantId, now)
        ));
      }
    }
  }

  const sortedBlockers = sortBlockers(blockers);
  let effectiveState: TaskEffectiveState;
  let nextAction: TaskProjection["nextAction"] = null;
  if (sortedBlockers.length > 0) {
    effectiveState = "waiting";
  } else {
    effectiveState = "ready";
    nextAction = taskChildren.length === 0 ? "claim" : "complete";
  }

  return {
    ...commonProjection,
    effectiveState,
    blockers: sortedBlockers,
    nextAction
  };
}

export function projectScope(
  index: TaskIndex,
  scopeId: string,
  now: Date
): ScopeProjection {
  const scope = Object.hasOwn(index.scopes, scopeId) ? index.scopes[scopeId] : undefined;
  if (scope === undefined) {
    throw new TaskGraphError("SCOPE_NOT_FOUND", `Scope ${scopeId} does not exist`);
  }
  const children = childrenByTask(scope);
  const dependents = new Map<string, string[]>(
    Object.keys(scope.tasks).map((taskId) => [taskId, []])
  );
  for (const taskId of Object.keys(scope.tasks)) {
    for (const dependency of effectiveDependencySources(scope, taskId)) {
      const targets = dependents.get(dependency.targetTaskId);
      if (targets !== undefined && !targets.includes(taskId)) {
        targets.push(taskId);
      }
    }
  }
  for (const targets of dependents.values()) {
    targets.sort(compareText);
  }

  const tasks: Record<string, TaskProjection> = {};
  for (const taskId of Object.keys(scope.tasks).sort(compareText)) {
    tasks[taskId] = projectOneTask(scope, taskId, now, children, dependents);
  }
  const actionableOrder = Object.keys(tasks).filter(
    (taskId) => tasks[taskId]?.effectiveState === "ready"
      && tasks[taskId]?.nextAction !== null
  );
  return {
    scopeId,
    revision: index.revision,
    tasks,
    actionable: Object.fromEntries(
      actionableOrder.map((taskId) => [taskId, tasks[taskId]])
    ),
    actionableOrder
  };
}

function detectCycle(edges: Map<string, Set<string>>): string[] | null {
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const stack: string[] = [];
  const visit = (node: string): string[] | null => {
    if (visiting.has(node)) {
      const offset = stack.indexOf(node);
      return [...stack.slice(offset), node];
    }
    if (visited.has(node)) {
      return null;
    }
    visiting.add(node);
    stack.push(node);
    for (const target of edges.get(node) ?? []) {
      const found = visit(target);
      if (found !== null) {
        return found;
      }
    }
    stack.pop();
    visiting.delete(node);
    visited.add(node);
    return null;
  };
  for (const node of edges.keys()) {
    const found = visit(node);
    if (found !== null) {
      return found;
    }
  }
  return null;
}

export function validateTaskIndexGraph(index: TaskIndex): string[] {
  const issues: string[] = [];
  const owners = taskOwnerById(index);
  const leaseOwners = new Map<string, string>();
  for (const [scopeId, scope] of Object.entries(index.scopes)) {
    const taskIds = Object.keys(scope.tasks);
    const taskIdSet = new Set(taskIds);
    const children = childrenByTask(scope);
    const parentEdges = new Map<string, Set<string>>(
      taskIds.map((taskId) => [taskId, new Set<string>()])
    );
    for (const [taskId, task] of Object.entries(scope.tasks)) {
      const parentId = task.state.relations.parentId;
      if (parentId !== null) {
        if (!taskIdSet.has(parentId)) {
          issues.push(
            owners.has(parentId)
              ? `${scopeId}/${taskId} parent ${parentId} crosses scope`
              : `${scopeId}/${taskId} parent ${parentId} is missing`
          );
        } else {
          parentEdges.get(taskId)?.add(parentId);
        }
      }
      for (const relationId of [
        ...Object.keys(task.state.relations.dependsOn),
        ...Object.keys(task.state.relations.excludes)
      ]) {
        if (!taskIdSet.has(relationId)) {
          issues.push(
            owners.has(relationId)
              ? `${scopeId}/${taskId} relation ${relationId} crosses scope`
              : `${scopeId}/${taskId} relation ${relationId} is missing`
          );
        }
      }
      if (task.state.relations.dependsOn[taskId] === true) {
        issues.push(`${scopeId}/${taskId} cannot depend on itself`);
      }
      if (task.state.relations.excludes[taskId] === true) {
        issues.push(`${scopeId}/${taskId} cannot exclude itself`);
      }
      for (const excludedId of Object.keys(task.state.relations.excludes)) {
        if (scope.tasks[excludedId]?.state.relations.excludes[taskId] !== true) {
          issues.push(`${scopeId}/${taskId} exclusion ${excludedId} is not symmetric`);
        }
      }
      const execution = task.state.execution;
      if (execution.phase === "running") {
        const leaseOwner = leaseOwners.get(execution.lease.id);
        if (leaseOwner === undefined) {
          leaseOwners.set(execution.lease.id, `${scopeId}/${taskId}`);
        } else {
          issues.push(
            `${scopeId}/${taskId} duplicates lease ${execution.lease.id} from ${leaseOwner}`
          );
        }
        const claimedAt = new Date(execution.lease.claimedAt).valueOf();
        const renewedAt = new Date(execution.lease.renewedAt).valueOf();
        const expiresAt = new Date(execution.lease.expiresAt).valueOf();
        if (claimedAt > renewedAt || renewedAt >= expiresAt) {
          issues.push(`${scopeId}/${taskId} lease timestamps are not monotonic`);
        }
      }
      const taskChildren = children.get(taskId) ?? [];
      if (
        taskChildren.length > 0
        && (execution.phase === "running" || execution.phase === "failed")
      ) {
        issues.push(`${scopeId}/${taskId} non-leaf task cannot be ${execution.phase}`);
      }
      if (execution.phase === "succeeded" && taskChildren.length > 0) {
        if (!taskChildren.some(
          (childId) => scope.tasks[childId]?.state.execution.phase === "succeeded"
        )) {
          issues.push(`${scopeId}/${taskId} succeeded parent needs a succeeded child`);
        }
        if (!taskChildren.every((childId) => {
          const phase = scope.tasks[childId]?.state.execution.phase;
          return phase === "succeeded" || phase === "cancelled";
        })) {
          issues.push(`${scopeId}/${taskId} succeeded parent has incomplete children`);
        }
      }
    }
    const parentCycle = detectCycle(parentEdges);
    if (parentCycle !== null) {
      issues.push(`${scopeId} parent cycle: ${parentCycle.join(" -> ")}`);
      continue;
    }

    for (const [taskId, task] of Object.entries(scope.tasks)) {
      if (task.state.execution.phase === "cancelled" && descendantIds(scope, taskId).some(
        (descendantId) => {
          const phase = scope.tasks[descendantId]?.state.execution.phase;
          return phase !== "succeeded" && phase !== "cancelled";
        }
      )) {
        issues.push(`${scopeId}/${taskId} cancelled parent has non-terminal descendants`);
      }
    }

    for (const taskId of taskIds) {
      const ancestors = new Set(ancestorIds(scope, taskId));
      for (const excludedId of Object.keys(
        scope.tasks[taskId]?.state.relations.excludes ?? {}
      )) {
        if (ancestors.has(excludedId) || ancestorIds(scope, excludedId).includes(taskId)) {
          issues.push(`${scopeId}/${taskId} cannot exclude ancestor or descendant ${excludedId}`);
        }
      }
    }

    const dependencyEdges = new Map<string, Set<string>>(
      taskIds.map((taskId) => [taskId, new Set<string>()])
    );
    for (const taskId of taskIds) {
      for (const dependency of effectiveDependencySources(scope, taskId)) {
        dependencyEdges.get(taskId)?.add(dependency.targetTaskId);
      }
      for (const childId of children.get(taskId) ?? []) {
        dependencyEdges.get(taskId)?.add(childId);
      }
      const effectiveDependencies = new Set(
        effectiveDependencySources(scope, taskId).map((source) => source.targetTaskId)
      );
      const effectiveExclusions = new Set(
        effectiveExclusionSources(scope, taskId).map((source) => source.targetTaskId)
      );
      for (const targetId of effectiveDependencies) {
        if (targetId === taskId) {
          issues.push(`${scopeId}/${taskId} inherits a self dependency`);
        }
        if (effectiveExclusions.has(targetId)) {
          issues.push(
            `${scopeId}/${taskId} cannot both depend on and exclude ${targetId}`
          );
        }
      }
    }
    const dependencyCycle = detectCycle(dependencyEdges);
    if (dependencyCycle !== null) {
      issues.push(`${scopeId} expanded dependency cycle: ${dependencyCycle.join(" -> ")}`);
    }

    for (const taskId of taskIds) {
      const task = scope.tasks[taskId];
      if (task === undefined) {
        continue;
      }
      const phase = task.state.execution.phase;
      const taskChildren = children.get(taskId) ?? [];
      const dependencies = new Set(
        effectiveDependencySources(scope, taskId).map((source) => source.targetTaskId)
      );
      if (phase === "running" || phase === "succeeded") {
        for (const dependencyId of dependencies) {
          if (scope.tasks[dependencyId]?.state.execution.phase !== "succeeded") {
            issues.push(
              `${scopeId}/${taskId} ${phase} evidence has incomplete dependency ${dependencyId}`
            );
          }
        }
      }
      if (phase === "running") {
        const hasControlSource = lineage(scope, taskId).some(
          (sourceId) => scope.tasks[sourceId]?.state.control.mode !== "inherit"
        );
        if (!hasControlSource) {
          issues.push(`${scopeId}/${taskId} running evidence has no effective control source`);
        } else if (effectiveControl(scope, taskId).mode !== "queued") {
          issues.push(`${scopeId}/${taskId} running evidence requires effective queued control`);
        }
        if (ancestorIds(scope, taskId).some((ancestorId) => {
          const ancestorPhase = scope.tasks[ancestorId]?.state.execution.phase;
          return ancestorPhase === "succeeded" || ancestorPhase === "cancelled";
        })) {
          issues.push(`${scopeId}/${taskId} running evidence is behind a terminal ancestor`);
        }
        for (const exclusion of effectiveExclusionSources(scope, taskId)) {
          if (scope.tasks[exclusion.targetTaskId]?.state.execution.phase === "running") {
            issues.push(
              `${scopeId}/${taskId} and ${exclusion.targetTaskId} cannot both be running`
            );
          }
        }
      }
      if (
        phase === "succeeded"
        && taskChildren.length === 0
        && task.state.execution.attempt < 1
      ) {
        issues.push(`${scopeId}/${taskId} succeeded leaf requires at least one claim attempt`);
      }
    }
  }
  return [...new Set(issues)].sort(compareText);
}

function topologySignature(scope: TaskScope, taskId: string): string {
  return JSON.stringify({
    ancestors: ancestorIds(scope, taskId),
    children: childrenByTask(scope).get(taskId) ?? [],
    dependencies: effectiveDependencySources(scope, taskId),
    exclusions: effectiveExclusionSources(scope, taskId)
  });
}

export function assertProtectedTopologyUnchanged(
  before: TaskScope,
  after: TaskScope
): void {
  for (const [taskId, task] of Object.entries(before.tasks)) {
    const phase = task.state.execution.phase;
    if (
      phase !== "running"
      && phase !== "succeeded"
      && phase !== "cancelled"
    ) {
      continue;
    }
    if (
      after.tasks[taskId] === undefined
      || topologySignature(before, taskId) !== topologySignature(after, taskId)
    ) {
      throw new TaskGraphError(
        "STATE_CONFLICT",
        `Topology evidence for ${phase} task ${taskId} cannot change`,
        { taskId, phase }
      );
    }
  }
}

export function assertRunningControlUnchanged(
  before: TaskScope,
  after: TaskScope
): void {
  for (const [taskId, task] of Object.entries(before.tasks)) {
    if (task.state.execution.phase !== "running") {
      continue;
    }
    if (
      after.tasks[taskId] === undefined
      || JSON.stringify(effectiveControl(before, taskId))
        !== JSON.stringify(effectiveControl(after, taskId))
    ) {
      throw new TaskGraphError(
        "STATE_CONFLICT",
        `Effective control for running task ${taskId} cannot change`,
        { taskId }
      );
    }
  }
}

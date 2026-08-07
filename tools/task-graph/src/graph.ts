import { TaskGraphError } from "./errors.ts";
import type {
  TaskGraphProjection,
  TaskBlocker,
  TaskConstraintSource,
  TaskEffectiveState,
  TaskEntry,
  TaskIndex,
  TaskProjection
} from "./types.ts";

const compareText = (left: string, right: string): number =>
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

export function ancestorIds(index: TaskIndex, taskId: string): string[] {
  const result: string[] = [];
  const visited = new Set<string>([taskId]);
  let current = index.tasks[taskId]?.state.relations.parentId ?? null;
  while (current !== null && !visited.has(current)) {
    result.push(current);
    visited.add(current);
    current = index.tasks[current]?.state.relations.parentId ?? null;
  }
  return result;
}

function lineage(index: TaskIndex, taskId: string): string[] {
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
  return sources.sort((left, right) =>
    compareText(left.targetTaskId, right.targetTaskId)
      || compareText(left.sourceTaskId, right.sourceTaskId)
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
  for (const targetTaskId of Object.keys(index.tasks)) {
    if (targetTaskId === taskId) {
      continue;
    }
    const targetLineage = lineage(index, targetTaskId);
    for (const sourceTaskId of currentLineage) {
      const explicitTargets = Object.keys(
        index.tasks[sourceTaskId]?.state.relations.excludes ?? {}
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
  index: TaskIndex,
  taskId: string,
  now: Date
): TaskEffectiveState {
  const task = index.tasks[taskId];
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
  const control = effectiveControl(index, taskId);
  if (control.mode === "candidate" || control.mode === "waiting" || control.mode === "paused") {
    return control.mode;
  }
  const dependencyBlocked = effectiveDependencySources(index, taskId).some(
    (source) => index.tasks[source.targetTaskId]?.state.execution.phase !== "succeeded"
  );
  const taskChildren = childrenByTask(index).get(taskId) ?? [];
  const exclusionBlocked = taskChildren.length === 0
    && effectiveExclusionSources(index, taskId).some(
      (source) => index.tasks[source.targetTaskId]?.state.execution.phase === "running"
    );
  const ancestorBlocked = ancestorIds(index, taskId).some((ancestorId) => {
    const phase = index.tasks[ancestorId]?.state.execution.phase;
    return phase === "succeeded" || phase === "cancelled";
  });
  const childBlocked = taskChildren.length > 0 && (
    !taskChildren.every((childId) => {
      const phase = index.tasks[childId]?.state.execution.phase;
      return phase === "succeeded" || phase === "cancelled";
    })
    || !taskChildren.some(
      (childId) => index.tasks[childId]?.state.execution.phase === "succeeded"
    )
    || descendantIds(index, taskId).some(
      (descendantId) => index.tasks[descendantId]?.state.execution.phase === "running"
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
  index: TaskIndex,
  taskId: string,
  now: Date,
  children: Map<string, string[]>,
  dependents: Map<string, string[]>
): TaskProjection {
  const task = Object.hasOwn(index.tasks, taskId) ? index.tasks[taskId] : undefined;
  if (task === undefined) {
    throw new TaskGraphError("TASK_NOT_FOUND", `Task ${taskId} does not exist`);
  }
  const control = effectiveControl(index, taskId);
  const dependencies = effectiveDependencySources(index, taskId);
  const exclusions = effectiveExclusionSources(index, taskId);
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
    const effectiveState = directEffectiveState(index, taskId, now);
    return {
      ...commonProjection,
      effectiveState,
      blockers: [],
      nextAction: effectiveState === "recovery-needed" ? "claim" : null
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
    const target = index.tasks[dependency.targetTaskId];
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
      directEffectiveState(index, dependency.targetTaskId, now)
    ));
  }

  for (const exclusion of taskChildren.length === 0 ? exclusions : []) {
    const target = index.tasks[exclusion.targetTaskId];
    if (target?.state.execution.phase !== "running") {
      continue;
    }
    blockers.push(blocker(
      "exclusion-running",
      taskId,
      exclusion.targetTaskId,
      exclusion.sourceTaskId,
      exclusion.inheritancePath,
      directEffectiveState(index, exclusion.targetTaskId, now)
    ));
  }

  for (const ancestorId of ancestorIds(index, taskId)) {
    const ancestor = index.tasks[ancestorId];
    const phase = ancestor?.state.execution.phase;
    if (phase === "succeeded" || phase === "cancelled") {
      blockers.push(blocker(
        "ancestor-terminal",
        taskId,
        ancestorId,
        ancestorId,
        lineage(index, taskId).slice(0, lineage(index, taskId).indexOf(ancestorId) + 1),
        phase
      ));
    }
  }

  if (taskChildren.length > 0) {
    for (const childId of taskChildren) {
      const child = index.tasks[childId];
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
          directEffectiveState(index, childId, now)
        ));
      }
    }
    if (taskChildren.every(
      (childId) => index.tasks[childId]?.state.execution.phase === "cancelled"
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
    for (const descendantId of descendantIds(index, taskId)) {
      const descendant = index.tasks[descendantId];
      if (descendant?.state.execution.phase === "running") {
        blockers.push(blocker(
          "descendant-lease",
          taskId,
          descendantId,
          taskId,
          [taskId],
          directEffectiveState(index, descendantId, now)
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

export function projectTaskGraph(
  index: TaskIndex,
  now: Date
): TaskGraphProjection {
  const children = childrenByTask(index);
  const dependents = new Map<string, string[]>(
    Object.keys(index.tasks).map((taskId) => [taskId, []])
  );
  for (const taskId of Object.keys(index.tasks)) {
    for (const dependency of effectiveDependencySources(index, taskId)) {
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
  for (const taskId of Object.keys(index.tasks).sort(compareText)) {
    tasks[taskId] = projectOneTask(index, taskId, now, children, dependents);
  }
  const actionableOrder = Object.keys(tasks).filter(
    (taskId) => tasks[taskId]?.nextAction !== null
  );
  return {
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
  const leaseOwners = new Map<string, string>();
  const taskIds = Object.keys(index.tasks);
  const taskIdSet = new Set(taskIds);
  const children = childrenByTask(index);
  const parentEdges = new Map<string, Set<string>>(
    taskIds.map((taskId) => [taskId, new Set<string>()])
  );
  for (const [taskId, task] of Object.entries(index.tasks)) {
    const parentId = task.state.relations.parentId;
    if (parentId !== null) {
      if (!taskIdSet.has(parentId)) {
        issues.push(`${taskId} parent ${parentId} is missing`);
      } else {
        parentEdges.get(taskId)?.add(parentId);
      }
    }
    for (const relationId of [
      ...Object.keys(task.state.relations.dependsOn),
      ...Object.keys(task.state.relations.excludes)
    ]) {
      if (!taskIdSet.has(relationId)) {
        issues.push(`${taskId} relation ${relationId} is missing`);
      }
    }
    if (task.state.relations.dependsOn[taskId] === true) {
      issues.push(`${taskId} cannot depend on itself`);
    }
    if (task.state.relations.excludes[taskId] === true) {
      issues.push(`${taskId} cannot exclude itself`);
    }
    for (const excludedId of Object.keys(task.state.relations.excludes)) {
      if (index.tasks[excludedId]?.state.relations.excludes[taskId] !== true) {
        issues.push(`${taskId} exclusion ${excludedId} is not symmetric`);
      }
    }
    const execution = task.state.execution;
    if (execution.phase === "running") {
      const leaseOwner = leaseOwners.get(execution.lease.id);
      if (leaseOwner === undefined) {
        leaseOwners.set(execution.lease.id, taskId);
      } else {
        issues.push(`${taskId} duplicates lease ${execution.lease.id} from ${leaseOwner}`);
      }
      const claimedAt = new Date(execution.lease.claimedAt).valueOf();
      const renewedAt = new Date(execution.lease.renewedAt).valueOf();
      const expiresAt = new Date(execution.lease.expiresAt).valueOf();
      if (claimedAt > renewedAt || renewedAt >= expiresAt) {
        issues.push(`${taskId} lease timestamps are not monotonic`);
      }
    }
    const taskChildren = children.get(taskId) ?? [];
    if (
      taskChildren.length > 0
      && (execution.phase === "running" || execution.phase === "failed")
    ) {
      issues.push(`${taskId} non-leaf task cannot be ${execution.phase}`);
    }
    if (execution.phase === "succeeded" && taskChildren.length > 0) {
      if (!taskChildren.some(
        (childId) => index.tasks[childId]?.state.execution.phase === "succeeded"
      )) {
        issues.push(`${taskId} succeeded parent needs a succeeded child`);
      }
      if (!taskChildren.every((childId) => {
        const phase = index.tasks[childId]?.state.execution.phase;
        return phase === "succeeded" || phase === "cancelled";
      })) {
        issues.push(`${taskId} succeeded parent has incomplete children`);
      }
    }
  }
  const parentCycle = detectCycle(parentEdges);
  if (parentCycle !== null) {
    issues.push(`parent cycle: ${parentCycle.join(" -> ")}`);
    return [...new Set(issues)].sort(compareText);
  }

  for (const [taskId, task] of Object.entries(index.tasks)) {
    if (task.state.execution.phase === "cancelled" && descendantIds(index, taskId).some(
      (descendantId) => {
        const phase = index.tasks[descendantId]?.state.execution.phase;
        return phase !== "succeeded" && phase !== "cancelled";
      }
    )) {
      issues.push(`${taskId} cancelled parent has non-terminal descendants`);
    }
  }

  for (const taskId of taskIds) {
    const ancestors = new Set(ancestorIds(index, taskId));
    for (const excludedId of Object.keys(
      index.tasks[taskId]?.state.relations.excludes ?? {}
    )) {
      if (ancestors.has(excludedId) || ancestorIds(index, excludedId).includes(taskId)) {
        issues.push(`${taskId} cannot exclude ancestor or descendant ${excludedId}`);
      }
    }
  }

  const dependencyEdges = new Map<string, Set<string>>(
    taskIds.map((taskId) => [taskId, new Set<string>()])
  );
  for (const taskId of taskIds) {
    for (const dependency of effectiveDependencySources(index, taskId)) {
      dependencyEdges.get(taskId)?.add(dependency.targetTaskId);
    }
    for (const childId of children.get(taskId) ?? []) {
      dependencyEdges.get(taskId)?.add(childId);
    }
    const effectiveDependencies = new Set(
      effectiveDependencySources(index, taskId).map((source) => source.targetTaskId)
    );
    const effectiveExclusions = new Set(
      effectiveExclusionSources(index, taskId).map((source) => source.targetTaskId)
    );
    for (const targetId of effectiveDependencies) {
      if (targetId === taskId) {
        issues.push(`${taskId} inherits a self dependency`);
      }
      if (effectiveExclusions.has(targetId)) {
        issues.push(`${taskId} cannot both depend on and exclude ${targetId}`);
      }
    }
  }
  const dependencyCycle = detectCycle(dependencyEdges);
  if (dependencyCycle !== null) {
    issues.push(`expanded dependency cycle: ${dependencyCycle.join(" -> ")}`);
  }

  for (const taskId of taskIds) {
    const task = index.tasks[taskId];
    if (task === undefined) continue;
    const phase = task.state.execution.phase;
    const taskChildren = children.get(taskId) ?? [];
    const dependencies = new Set(
      effectiveDependencySources(index, taskId).map((source) => source.targetTaskId)
    );
    if (phase === "running" || phase === "succeeded") {
      for (const dependencyId of dependencies) {
        if (index.tasks[dependencyId]?.state.execution.phase !== "succeeded") {
          issues.push(`${taskId} ${phase} evidence has incomplete dependency ${dependencyId}`);
        }
      }
    }
    if (phase === "running") {
      const hasControlSource = lineage(index, taskId).some(
        (sourceId) => index.tasks[sourceId]?.state.control.mode !== "inherit"
      );
      if (!hasControlSource) {
        issues.push(`${taskId} running evidence has no effective control source`);
      } else if (effectiveControl(index, taskId).mode !== "queued") {
        issues.push(`${taskId} running evidence requires effective queued control`);
      }
      if (ancestorIds(index, taskId).some((ancestorId) => {
        const ancestorPhase = index.tasks[ancestorId]?.state.execution.phase;
        return ancestorPhase === "succeeded" || ancestorPhase === "cancelled";
      })) {
        issues.push(`${taskId} running evidence is behind a terminal ancestor`);
      }
      for (const exclusion of effectiveExclusionSources(index, taskId)) {
        if (index.tasks[exclusion.targetTaskId]?.state.execution.phase === "running") {
          issues.push(`${taskId} and ${exclusion.targetTaskId} cannot both be running`);
        }
      }
    }
    if (
      phase === "succeeded"
      && taskChildren.length === 0
      && task.state.execution.attempt < 1
    ) {
      issues.push(`${taskId} succeeded leaf requires at least one claim attempt`);
    }
  }
  return [...new Set(issues)].sort(compareText);
}

function topologySignature(index: TaskIndex, taskId: string): string {
  return JSON.stringify({
    ancestors: ancestorIds(index, taskId),
    children: childrenByTask(index).get(taskId) ?? [],
    dependencies: effectiveDependencySources(index, taskId),
    exclusions: effectiveExclusionSources(index, taskId)
  });
}

export function assertProtectedTopologyUnchanged(
  before: TaskIndex,
  after: TaskIndex
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
  before: TaskIndex,
  after: TaskIndex
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

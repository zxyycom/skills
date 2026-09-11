import { TaskGraphError } from "./errors.ts";
import {
  ancestorIds,
  compareText,
  childrenByTask,
  descendantIds,
  effectiveControl,
  effectiveDependencySources,
  effectiveExclusionSources,
  lineage
} from "./graph-topology.ts";
import { hasTerminalAncestor } from "./graph-state.ts";
import { detectCycle } from "./graph-projection.ts";
import type { TaskIndex } from "./types.ts";

function directValidation(
  index: TaskIndex,
  taskIds: readonly string[],
  taskIdSet: ReadonlySet<string>,
  children: ReadonlyMap<string, readonly string[]>,
  issues: string[]
): Map<string, Set<string>> {
  const leaseOwners = new Map<string, string>();
  const parentEdges = new Map<string, Set<string>>(
    taskIds.map((taskId) => [taskId, new Set<string>()])
  );
  for (const [taskId, task] of Object.entries(index.tasks)) {
    const context: DirectValidationContext = {
      index,
      issues,
      leaseOwners,
      parentEdges,
      task,
      taskId,
      taskChildren: children.get(taskId) ?? [],
      taskIds: taskIdSet
    };
    validateDirectRelations(context);
    validateDirectExecution(context);
  }
  return parentEdges;
}

function validatedIssues(issues: string[]): string[] {
  return [...new Set(issues)].sort(compareText);
}

export function validateTaskIndexGraph(index: TaskIndex): string[] {
  const issues: string[] = [];
  const taskIds = Object.keys(index.tasks);
  const children = childrenByTask(index);
  const parentEdges = directValidation(
    index,
    taskIds,
    new Set(taskIds),
    children,
    issues
  );
  const parentCycle = detectCycle(parentEdges);
  if (parentCycle !== null) {
    issues.push(`parent cycle: ${parentCycle.join(" -> ")}`);
    return validatedIssues(issues);
  }
  validateCancelledDescendants(index, issues);
  validateHierarchicalExclusions(index, taskIds, issues);
  const dependencyCycle = detectCycle(
    validateEffectiveConstraints(index, taskIds, children, issues)
  );
  if (dependencyCycle !== null)
    issues.push(`expanded dependency cycle: ${dependencyCycle.join(" -> ")}`);
  validateExecutionEvidence(index, taskIds, children, issues);
  return validatedIssues(issues);
}

type TaskEntry = TaskIndex["tasks"][string];

type DirectValidationContext = Readonly<{
  index: TaskIndex;
  issues: string[];
  leaseOwners: Map<string, string>;
  parentEdges: Map<string, Set<string>>;
  task: TaskEntry;
  taskChildren: readonly string[];
  taskId: string;
  taskIds: ReadonlySet<string>;
}>;

function validateRelationTargets(context: DirectValidationContext): void {
  const { issues, parentEdges, task, taskId, taskIds } = context;
  const parentId = task.state.relations.parentId;
  if (parentId !== null) {
    if (taskIds.has(parentId)) parentEdges.get(taskId)?.add(parentId);
    else issues.push(`${taskId} parent ${parentId} is missing`);
  }
  for (const relationId of Object.keys(task.state.relations.dependsOn).concat(
    Object.keys(task.state.relations.excludes)
  ))
    if (!taskIds.has(relationId))
      issues.push(`${taskId} relation ${relationId} is missing`);
}

function validateRelationRules(
  index: TaskIndex,
  taskId: string,
  task: TaskEntry,
  issues: string[]
): void {
  if (task.state.relations.dependsOn[taskId] === true)
    issues.push(`${taskId} cannot depend on itself`);
  if (task.state.relations.excludes[taskId] === true)
    issues.push(`${taskId} cannot exclude itself`);
  for (const excludedId of Object.keys(task.state.relations.excludes))
    if (index.tasks[excludedId]?.state.relations.excludes[taskId] !== true)
      issues.push(`${taskId} exclusion ${excludedId} is not symmetric`);
}

export function validateDirectRelations(
  context: DirectValidationContext
): void {
  const { index, issues, task, taskId } = context;
  validateRelationTargets(context);
  validateRelationRules(index, taskId, task, issues);
}

export function validateDirectExecution(
  context: DirectValidationContext
): void {
  const { index, issues, leaseOwners, task, taskChildren, taskId } = context;
  const execution = task.state.execution;
  if (execution.phase === "running") {
    validateLease(taskId, execution.lease, leaseOwners, issues);
  }
  if (
    taskChildren.length > 0 &&
    (execution.phase === "running" || execution.phase === "failed")
  ) {
    issues.push(`${taskId} non-leaf task cannot be ${execution.phase}`);
  }
  if (execution.phase !== "succeeded" || taskChildren.length === 0) return;
  const childPhases = taskChildren.map(
    (childId) => index.tasks[childId]?.state.execution.phase
  );
  if (!childPhases.includes("succeeded")) {
    issues.push(`${taskId} succeeded parent needs a succeeded child`);
  }
  if (
    childPhases.some((phase) => phase !== "succeeded" && phase !== "cancelled")
  ) {
    issues.push(`${taskId} succeeded parent has incomplete children`);
  }
}

export function validateLease(
  taskId: string,
  lease: Extract<
    TaskEntry["state"]["execution"],
    { phase: "running" }
  >["lease"],
  leaseOwners: Map<string, string>,
  issues: string[]
): void {
  const leaseOwner = leaseOwners.get(lease.id);
  if (leaseOwner === undefined) leaseOwners.set(lease.id, taskId);
  else issues.push(`${taskId} duplicates lease ${lease.id} from ${leaseOwner}`);
  const claimedAt = new Date(lease.claimedAt).valueOf();
  const renewedAt = new Date(lease.renewedAt).valueOf();
  const expiresAt = new Date(lease.expiresAt).valueOf();
  if (claimedAt > renewedAt || renewedAt >= expiresAt) {
    issues.push(`${taskId} lease timestamps are not monotonic`);
  }
}

export function validateCancelledDescendants(
  index: TaskIndex,
  issues: string[]
): void {
  for (const [taskId, task] of Object.entries(index.tasks)) {
    if (task.state.execution.phase !== "cancelled") continue;
    const nonTerminal = descendantIds(index, taskId).some((descendantId) => {
      const phase = index.tasks[descendantId]?.state.execution.phase;
      return phase !== "succeeded" && phase !== "cancelled";
    });
    if (nonTerminal) {
      issues.push(`${taskId} cancelled parent has non-terminal descendants`);
    }
  }
}

export function validateHierarchicalExclusions(
  index: TaskIndex,
  taskIds: readonly string[],
  issues: string[]
): void {
  for (const taskId of taskIds) {
    const ancestors = new Set(ancestorIds(index, taskId));
    const exclusions = Object.keys(
      index.tasks[taskId]?.state.relations.excludes ?? {}
    );
    for (const excludedId of exclusions) {
      if (
        ancestors.has(excludedId) ||
        ancestorIds(index, excludedId).includes(taskId)
      ) {
        issues.push(
          `${taskId} cannot exclude ancestor or descendant ${excludedId}`
        );
      }
    }
  }
}

export function validateEffectiveConstraints(
  index: TaskIndex,
  taskIds: readonly string[],
  children: ReadonlyMap<string, readonly string[]>,
  issues: string[]
): Map<string, Set<string>> {
  const edges = new Map<string, Set<string>>(
    taskIds.map((taskId) => [taskId, new Set<string>()])
  );
  for (const taskId of taskIds) {
    const dependencies = effectiveDependencySources(index, taskId).map(
      (source) => source.targetTaskId
    );
    for (const targetId of dependencies.concat(children.get(taskId) ?? [])) {
      edges.get(taskId)?.add(targetId);
    }
    const exclusions = new Set(
      effectiveExclusionSources(index, taskId).map(
        (source) => source.targetTaskId
      )
    );
    for (const targetId of dependencies) {
      if (targetId === taskId)
        issues.push(`${taskId} inherits a self dependency`);
      if (exclusions.has(targetId)) {
        issues.push(`${taskId} cannot both depend on and exclude ${targetId}`);
      }
    }
  }
  return edges;
}

function requiresClaimAttempt(task: TaskEntry, childCount: number): boolean {
  return (
    task.state.execution.phase === "succeeded" &&
    childCount === 0 &&
    task.state.execution.attempt < 1
  );
}

function validateTaskExecutionEvidence(
  index: TaskIndex,
  taskId: string,
  task: TaskEntry,
  children: ReadonlyMap<string, readonly string[]>,
  issues: string[]
): void {
  validateDependencyEvidence(index, taskId, task, issues);
  if (task.state.execution.phase === "running")
    validateRunningEvidence(index, taskId, issues);
  const childCount = children.get(taskId)?.length ?? 0;
  if (requiresClaimAttempt(task, childCount))
    issues.push(`${taskId} succeeded leaf requires at least one claim attempt`);
}

export function validateExecutionEvidence(
  index: TaskIndex,
  taskIds: readonly string[],
  children: ReadonlyMap<string, readonly string[]>,
  issues: string[]
): void {
  for (const taskId of taskIds) {
    const task = index.tasks[taskId];
    if (task !== undefined)
      validateTaskExecutionEvidence(index, taskId, task, children, issues);
  }
}

export function validateDependencyEvidence(
  index: TaskIndex,
  taskId: string,
  task: TaskEntry,
  issues: string[]
): void {
  const phase = task.state.execution.phase;
  if (phase !== "running" && phase !== "succeeded") return;
  for (const source of effectiveDependencySources(index, taskId)) {
    if (
      index.tasks[source.targetTaskId]?.state.execution.phase !== "succeeded"
    ) {
      issues.push(
        `${taskId} ${phase} evidence has incomplete dependency ${source.targetTaskId}`
      );
    }
  }
}

export function validateRunningEvidence(
  index: TaskIndex,
  taskId: string,
  issues: string[]
): void {
  const hasControlSource = lineage(index, taskId).some(
    (sourceId) => index.tasks[sourceId]?.state.control.mode !== "inherit"
  );
  if (!hasControlSource) {
    issues.push(`${taskId} running evidence has no effective control source`);
  } else if (effectiveControl(index, taskId).mode !== "queued") {
    issues.push(`${taskId} running evidence requires effective queued control`);
  }
  if (hasTerminalAncestor(index, taskId)) {
    issues.push(`${taskId} running evidence is behind a terminal ancestor`);
  }
  for (const exclusion of effectiveExclusionSources(index, taskId)) {
    if (
      index.tasks[exclusion.targetTaskId]?.state.execution.phase === "running"
    ) {
      issues.push(
        `${taskId} and ${exclusion.targetTaskId} cannot both be running`
      );
    }
  }
}

export function topologySignature(index: TaskIndex, taskId: string): string {
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
    if (phase !== "running" && phase !== "succeeded" && phase !== "cancelled") {
      continue;
    }
    if (
      after.tasks[taskId] === undefined ||
      topologySignature(before, taskId) !== topologySignature(after, taskId)
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
      after.tasks[taskId] === undefined ||
      JSON.stringify(effectiveControl(before, taskId)) !==
        JSON.stringify(effectiveControl(after, taskId))
    ) {
      throw new TaskGraphError(
        "STATE_CONFLICT",
        `Effective control for running task ${taskId} cannot change`,
        { taskId }
      );
    }
  }
}

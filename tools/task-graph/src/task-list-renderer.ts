import type {
  TaskGraphFailure,
  TaskGraphResult,
  TaskListItem
} from "./types.ts";
import { layoutTaskList } from "./task-list-layout.ts";
import {
  compareText,
  serializeJsonValue,
  type DisplayNode,
  type MutexGroup,
  blockIndent,
  maximumInlineItems,
  minimumInlineColumns,
  type TaskListRenderContext
} from "./task-list-model.ts";

function nodeTokens(node: DisplayNode): string[] {
  const { item } = node;
  const blockedBy = node.blockedBy.map(
    (blocker) => `${blocker.kind}@${blocker.relatedTaskId}`
  );
  return [
    ...(item.parentId === null ? [] : [`parent:[${item.parentId}]`]),
    ...(node.needs.length === 0 ? [] : [`needs:[${node.needs.join(",")}]`]),
    ...(blockedBy.length === 0 ? [] : [`blocked-by:[${blockedBy.join(",")}]`]),
    ...(node.mutex.length === 0 ? [] : [`mutex:[${node.mutex.join(",")}]`]),
    ...(item.effectiveControl.reason === null
      ? []
      : [`reason:${serializeJsonValue(item.effectiveControl.reason)}`]),
    ...(item.nextAction === null ? [] : [`next:${item.nextAction}`])
  ];
}

function rendersNodeInline(node: DisplayNode, columns: number): boolean {
  return (
    columns >= minimumInlineColumns &&
    node.needs.length <= maximumInlineItems &&
    node.blockedBy.length <= maximumInlineItems &&
    node.mutex.length <= maximumInlineItems
  );
}

function renderInlineNode(
  node: DisplayNode,
  tokens: readonly string[]
): string {
  const { item } = node;
  const indent = blockIndent.repeat(node.parentPath.length);
  return [
    `${indent}L${node.layer}`,
    `[${item.taskId}]`,
    item.effectiveState,
    ...tokens,
    item.title
  ].join(" ");
}

function renderBlockNode(node: DisplayNode, tokens: readonly string[]): string {
  const { item } = node;
  const indent = blockIndent.repeat(node.parentPath.length);
  const detailIndent = `${indent}${blockIndent}`;
  return [
    `${indent}L${node.layer} [${item.taskId}] ${item.effectiveState}`,
    ...tokens.map((token) => `${detailIndent}${token}`),
    `${detailIndent}title:${item.title}`
  ].join("\n");
}

function renderNode(node: DisplayNode, columns: number): string {
  const tokens = nodeTokens(node);
  return rendersNodeInline(node, columns)
    ? renderInlineNode(node, tokens)
    : renderBlockNode(node, tokens);
}

function requireTrackLabel(
  trackLabels: ReadonlyMap<string, string>,
  taskId: string
): string {
  const trackLabel = trackLabels.get(taskId);
  if (trackLabel === undefined) {
    throw new Error(
      `Task list layout cannot locate a track for mutex endpoint ${taskId}; ` +
        "inspect track label construction"
    );
  }
  return trackLabel;
}

function renderMutexGroup(
  group: MutexGroup,
  trackLabels: ReadonlyMap<string, string>,
  columns: number
): string {
  const left = `${requireTrackLabel(trackLabels, group.leftTaskId)} [${group.leftTaskId}]`;
  const right = group.rightTaskIds.map(
    (taskId) => `${requireTrackLabel(trackLabels, taskId)} [${taskId}]`
  );
  if (columns >= minimumInlineColumns && right.length <= maximumInlineItems) {
    return `${left} mutex ${right.join(", ")}`;
  }
  return [
    `${left} mutex`,
    ...right.map((endpoint) => `${blockIndent}${endpoint}`)
  ].join("\n");
}

function renderSuccess(
  data: Record<string, TaskListItem>,
  columns: number
): string {
  const layout = layoutTaskList(data);
  const { summary } = layout;
  const sections = [
    [
      `TASK LIST tasks=${summary.tasks}`,
      `tracks=${summary.tracks}`,
      `actionable=${summary.actionable}`,
      `running=${summary.running}`,
      `recovery-needed=${summary.recoveryNeeded}`,
      `mutex-blocked=${summary.mutexBlocked}`
    ].join(" "),
    ...layout.tracks.map((track) =>
      [
        `TRACK ${track.label} tasks=${track.nodes.length}`,
        ...track.nodes.map((node) => renderNode(node, columns))
      ].join("\n")
    )
  ];
  if (layout.mutexGroups.length > 0) {
    sections.push(
      [
        "RUN MUTEX - cannot run at the same time",
        ...layout.mutexGroups.map((group) =>
          renderMutexGroup(group, layout.trackLabels, columns)
        )
      ].join("\n")
    );
  }
  return `${sections.join("\n\n")}\n`;
}

function renderFailure(result: TaskGraphFailure): string {
  const lines = [
    [
      `TASK LIST ERROR code=${result.error.code}`,
      `revision=${result.revision}`,
      `retryable=${result.error.retryable}`,
      `message=${serializeJsonValue(result.error.message)}`
    ].join(" ")
  ];
  for (const [key, value] of Object.entries(result.error.details).sort(
    ([left], [right]) => compareText(left, right)
  )) {
    lines.push(`  detail ${key}=${serializeJsonValue(value)}`);
  }
  return `${lines.join("\n")}\n`;
}

export function renderTaskListResult(
  result: TaskGraphResult<Record<string, TaskListItem>>,
  context: TaskListRenderContext
): string {
  return result.ok
    ? renderSuccess(result.data, context.columns)
    : renderFailure(result);
}

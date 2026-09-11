import type {
  ArtifactStructureContract,
  ArtifactValidationResult,
  ChangePlanDiagnostic,
  ChangePlanTaskHeading
} from "./types.ts";
import {
  checklistCandidates,
  diagnostic,
  emptyTaskProgress,
  taskLinePattern,
  taskSectionByHeading,
  type ChecklistCandidate,
  type MarkdownRoot,
  type RootHeading,
  type TaskValidationContext
} from "./markdown.ts";

function isTaskHeading(
  heading: string,
  taskSections: ReadonlySet<string>
): heading is ChangePlanTaskHeading {
  return (
    taskSections.has(heading) && Object.hasOwn(taskSectionByHeading, heading)
  );
}

function recordTaskCandidate(
  candidate: ChecklistCandidate,
  context: TaskValidationContext
): void {
  const section = context.h2.findLast(
    (heading) => heading.lineIndex < candidate.lineIndex
  )?.title;
  if (section === undefined || !isTaskHeading(section, context.taskSections)) {
    context.diagnostics.push(
      diagnostic(
        context.contract.file,
        "task-outside-required-section",
        "checklist tasks must be inside Readiness, Implementation, or Verification",
        candidate.lineIndex + 1
      )
    );
    return;
  }

  const match = taskLinePattern.exec(candidate.line);
  if (match === null) {
    context.diagnostics.push(
      diagnostic(
        context.contract.file,
        "invalid-task-syntax",
        "task must use '- [ ] <numeric-id> <description>' or '- [x] <numeric-id> <description>'",
        candidate.lineIndex + 1
      )
    );
    return;
  }

  const completedMarker = match[1];
  const taskId = match[2];
  if (completedMarker === undefined || taskId === undefined) {
    return;
  }
  recordTaskId(taskId, candidate.lineIndex + 1, context);
  recordTaskProgress(section, completedMarker, context);
}

function recordTaskId(
  taskId: string,
  line: number,
  context: TaskValidationContext
): void {
  const previousLine = context.seenTaskIds.get(taskId);
  if (previousLine === undefined) {
    context.seenTaskIds.set(taskId, line);
  } else {
    context.diagnostics.push(
      diagnostic(
        context.contract.file,
        "duplicate-task-id",
        `task id ${taskId} duplicates line ${previousLine}`,
        line
      )
    );
  }
}

function recordTaskProgress(
  section: ChangePlanTaskHeading,
  completedMarker: string,
  context: TaskValidationContext
): void {
  context.taskCounts.set(section, (context.taskCounts.get(section) ?? 0) + 1);
  const progress = context.taskProgress[taskSectionByHeading[section]];
  progress.taskCount += 1;
  context.taskCount += 1;
  if (completedMarker.toLowerCase() === "x") {
    progress.completedTaskCount += 1;
    context.completedTaskCount += 1;
  }
}

function reportMissingTasks(context: TaskValidationContext): void {
  for (const section of context.taskSections) {
    if ((context.taskCounts.get(section) ?? 0) === 0) {
      context.diagnostics.push(
        diagnostic(
          context.contract.file,
          "missing-task",
          `"## ${section}" must contain at least one valid checklist task`
        )
      );
    }
  }
}

export function validateTasks(
  root: MarkdownRoot,
  lines: readonly string[],
  h2: readonly RootHeading[],
  contract: ArtifactStructureContract,
  diagnostics: ChangePlanDiagnostic[]
): Pick<
  ArtifactValidationResult,
  "completedTaskCount" | "taskCount" | "taskProgress"
> {
  const taskSections = new Set(contract.taskSections ?? []);
  const context: TaskValidationContext = {
    completedTaskCount: 0,
    contract,
    diagnostics,
    h2,
    seenTaskIds: new Map(),
    taskCount: 0,
    taskCounts: new Map([...taskSections].map((title) => [title, 0])),
    taskProgress: emptyTaskProgress(),
    taskSections
  };

  for (const candidate of checklistCandidates(root, lines)) {
    recordTaskCandidate(candidate, context);
  }
  reportMissingTasks(context);

  return {
    completedTaskCount: context.completedTaskCount,
    taskCount: context.taskCount,
    taskProgress: context.taskProgress
  };
}

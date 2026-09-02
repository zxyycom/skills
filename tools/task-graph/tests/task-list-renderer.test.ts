import assert from "node:assert/strict";
import test from "node:test";
import { renderTaskListResult } from "../src/task-list-renderer.ts";
import type {
  TaskBlocker,
  TaskConstraintSource,
  TaskEffectiveState,
  TaskExecutionPhase,
  TaskGraphResult,
  TaskListItem
} from "../src/types.ts";

type ItemOptions = Readonly<{
  blockers?: TaskBlocker[];
  dependencyTargets?: string[];
  effectiveState?: TaskEffectiveState;
  exclusionTargets?: string[];
  nextAction?: TaskListItem["nextAction"];
  parentId?: string | null;
  phase?: TaskExecutionPhase;
  reason?: string | null;
  title?: string;
}>;

function constraint(
  sourceTaskId: string,
  targetTaskId: string
): TaskConstraintSource {
  return {
    targetTaskId,
    sourceTaskId,
    inheritancePath: [sourceTaskId],
    declaredTargetTaskId: targetTaskId,
    targetInheritancePath: [targetTaskId]
  };
}

function item(taskId: string, options: ItemOptions = {}): TaskListItem {
  const {
    blockers = [],
    dependencyTargets = [],
    effectiveState = "waiting",
    exclusionTargets = [],
    nextAction = null,
    parentId = null,
    phase = "idle",
    reason = null,
    title = taskId
  } = options;
  return {
    taskId,
    title,
    parentId,
    phase,
    effectiveState,
    effectiveControl: {
      mode: "queued",
      reason,
      sourceTaskId: taskId,
      inheritancePath: [taskId]
    },
    blockers,
    dependencies: dependencyTargets.map((targetTaskId) =>
      constraint(taskId, targetTaskId)
    ),
    exclusions: exclusionTargets.map((targetTaskId) =>
      constraint(taskId, targetTaskId)
    ),
    children: [],
    dependents: [],
    nextAction
  };
}

function blocker(value: TaskBlocker): TaskBlocker {
  return value;
}

function dictionary(
  items: readonly TaskListItem[]
): Record<string, TaskListItem> {
  return Object.fromEntries(items.map((entry) => [entry.taskId, entry]));
}

function successData(
  data: Record<string, TaskListItem>
): TaskGraphResult<Record<string, TaskListItem>> {
  return {
    ok: true,
    indexPath: "/workspace/docs/task-graph/task-graph-index.json",
    revision: 12,
    data
  };
}

function success(
  items: readonly TaskListItem[]
): TaskGraphResult<Record<string, TaskListItem>> {
  return successData(dictionary(items));
}

test("task-list renderer emits the exact empty success protocol", () => {
  assert.equal(
    renderTaskListResult(success([]), { columns: 80 }),
    "TASK LIST tasks=0 tracks=0 actionable=0 running=0 recovery-needed=0 mutex-blocked=0\n"
  );
});

test("task-list renderer serializes failures with sorted JSON details", () => {
  assert.equal(
    renderTaskListResult(
      {
        ok: false,
        indexPath: "/workspace/index.json",
        revision: null,
        error: {
          code: "INDEX_INVALID",
          retryable: false,
          message: 'bad\n"input"',
          details: {
            zeta: ["value", 1],
            alpha: null
          }
        }
      },
      { columns: 80 }
    ),
    [
      'TASK LIST ERROR code=INDEX_INVALID revision=null retryable=false message="bad\\n\\"input\\""',
      "  detail alpha=null",
      '  detail zeta=["value",1]',
      ""
    ].join("\n")
  );
});

test("task-list layout uses actual IDs with stable track layer and parent-path order", () => {
  const root = item("task-000016", { title: "Root" });
  const child = item("task-000020", {
    parentId: root.taskId,
    dependencyTargets: ["task-000040"],
    title: "Child"
  });
  const grandchild = item("task-000021", {
    parentId: child.taskId,
    dependencyTargets: ["task-000030"],
    title: "Grandchild"
  });
  const merger = item("task-000030", {
    dependencyTargets: ["task-000040", root.taskId, "task-000040"],
    effectiveState: "ready",
    nextAction: "claim",
    title: "Merger"
  });
  const dependency = item("task-000040", {
    effectiveState: "succeeded",
    phase: "succeeded",
    title: "Dependency root"
  });
  const isolated = item("task-000099", {
    effectiveState: "cancelled",
    phase: "cancelled",
    title: "Isolated terminal"
  });
  const expected = [
    "TASK LIST tasks=6 tracks=2 actionable=1 running=0 recovery-needed=0 mutex-blocked=0",
    "",
    "TRACK T01 tasks=5",
    "L0 [task-000016] waiting Root",
    "L0 [task-000040] succeeded Dependency root",
    "L1 [task-000030] ready needs:[task-000016,task-000040] next:claim Merger",
    "  L1 [task-000020] waiting parent:[task-000016] needs:[task-000040] Child",
    "    L2 [task-000021] waiting parent:[task-000020] needs:[task-000030] Grandchild",
    "",
    "TRACK T02 tasks=1",
    "L0 [task-000099] cancelled Isolated terminal",
    ""
  ].join("\n");

  assert.equal(
    renderTaskListResult(
      success([isolated, grandchild, dependency, child, merger, root]),
      { columns: 80 }
    ),
    expected
  );
  assert.equal(
    renderTaskListResult(
      success([root, child, grandchild, merger, dependency, isolated]),
      { columns: 80 }
    ),
    expected
  );
});

test("task-list renderer fails closed when invalid projection relations reach layout", () => {
  const cases = [
    {
      label: "missing parent",
      result: success([item("task-000001", { parentId: "task-999999" })]),
      error: /task-999999/u
    },
    {
      label: "missing dependency",
      result: success([
        item("task-000001", {
          dependencyTargets: ["task-999999"]
        })
      ]),
      error: /task-999999/u
    },
    {
      label: "missing exclusion",
      result: success([
        item("task-000001", {
          exclusionTargets: ["task-999999"]
        })
      ]),
      error: /task-999999/u
    },
    {
      label: "parent cycle",
      result: success([
        item("task-000001", { parentId: "task-000002" }),
        item("task-000002", { parentId: "task-000001" })
      ]),
      error: /parent cycle/u
    },
    {
      label: "dependency cycle",
      result: success([
        item("task-000001", { dependencyTargets: ["task-000002"] }),
        item("task-000002", { dependencyTargets: ["task-000001"] })
      ]),
      error: /dependency cycle/u
    },
    {
      label: "self exclusion",
      result: success([
        item("task-000001", {
          exclusionTargets: ["task-000001"]
        })
      ]),
      error: /self exclusion at task-000001/u
    }
  ];
  for (const { label, result, error } of cases) {
    assert.throws(
      () => renderTaskListResult(result, { columns: 80 }),
      error,
      label
    );
  }
});

test("task-list renderer displays every causal blocker kind in deterministic order", () => {
  const taskId = "task-000006";
  const base = { taskId, sourceTaskId: taskId, inheritancePath: [taskId] };
  const work = item(taskId, {
    blockers: [
      blocker({
        ...base,
        kind: "descendant-lease",
        relatedTaskId: "task-000005",
        state: "recovery-needed"
      }),
      blocker({
        ...base,
        kind: "dependency-failed",
        relatedTaskId: "task-000004",
        state: "failed"
      }),
      blocker({
        ...base,
        kind: "dependency-cancelled",
        relatedTaskId: "task-000003",
        state: "cancelled"
      }),
      blocker({
        ...base,
        kind: "ancestor-terminal",
        relatedTaskId: "task-000002",
        state: "succeeded"
      }),
      blocker({
        ...base,
        kind: "all-children-cancelled",
        relatedTaskId: "task-000001",
        state: "cancelled"
      })
    ],
    title: "Work"
  });
  const output = renderTaskListResult(
    success([
      item("task-000001"),
      item("task-000002"),
      item("task-000003"),
      item("task-000004"),
      item("task-000005"),
      work
    ]),
    { columns: 79 }
  );
  assert.match(
    output,
    /blocked-by:\[all-children-cancelled@task-000001,ancestor-terminal@task-000002,dependency-cancelled@task-000003,dependency-failed@task-000004,descendant-lease@task-000005\]/u
  );
});

test("task-list renderer omits blockers recoverable from full task data", () => {
  const taskId = "task-000001";
  const base = { taskId, sourceTaskId: taskId, inheritancePath: [taskId] };
  const output = renderTaskListResult(
    success([
      item(taskId, {
        blockers: [
          blocker({
            ...base,
            kind: "control-candidate",
            relatedTaskId: taskId,
            state: "candidate"
          }),
          blocker({
            ...base,
            kind: "control-waiting",
            relatedTaskId: taskId,
            state: "waiting"
          }),
          blocker({
            ...base,
            kind: "control-paused",
            relatedTaskId: taskId,
            state: "paused"
          }),
          blocker({
            ...base,
            kind: "dependency-incomplete",
            relatedTaskId: taskId,
            state: "waiting"
          }),
          blocker({
            ...base,
            kind: "child-incomplete",
            relatedTaskId: taskId,
            state: "waiting"
          })
        ],
        title: "Recoverable"
      })
    ]),
    { columns: 80 }
  );
  assert.match(output, /\nL0 \[task-000001\] waiting Recoverable\n$/u);
  assert.doesNotMatch(output, /blocked-by:|mutex:/u);
});

test("task-list renderer maps exclusion-running blockers to active mutex tokens", () => {
  const taskId = "task-000001";
  const base = { taskId, sourceTaskId: taskId, inheritancePath: [taskId] };
  const output = renderTaskListResult(
    success([
      item(taskId, {
        blockers: [
          blocker({
            ...base,
            kind: "exclusion-running",
            relatedTaskId: "task-000003",
            state: "running"
          }),
          blocker({
            ...base,
            kind: "exclusion-running",
            relatedTaskId: "task-000002",
            state: "recovery-needed"
          }),
          blocker({
            ...base,
            kind: "exclusion-running",
            relatedTaskId: "task-000002",
            state: "running"
          })
        ],
        title: "Blocked"
      }),
      item("task-000002"),
      item("task-000003")
    ]),
    { columns: 80 }
  );
  assert.match(output, /^TASK LIST .* mutex-blocked=1\n/u);
  assert.match(
    output,
    /\nL0 \[task-000001\] waiting mutex:\[task-000002,task-000003\] Blocked\n/u
  );
});

test("task-list renderer preserves fixed node field order", () => {
  const taskId = "task-000004";
  const base = { taskId, sourceTaskId: taskId, inheritancePath: [taskId] };
  const work = item(taskId, {
    parentId: "task-000001",
    dependencyTargets: ["task-000002"],
    exclusionTargets: ["task-000003"],
    nextAction: "claim",
    reason: "because",
    blockers: [
      blocker({
        ...base,
        kind: "dependency-failed",
        relatedTaskId: "task-000002",
        state: "failed"
      }),
      blocker({
        ...base,
        kind: "exclusion-running",
        relatedTaskId: "task-000003",
        state: "running"
      })
    ],
    title: "Work 中文🚀"
  });
  const output = renderTaskListResult(
    success([
      item("task-000001"),
      item("task-000002"),
      item("task-000003"),
      work
    ]),
    { columns: 80 }
  );
  assert.ok(
    output.includes(
      "parent:[task-000001] needs:[task-000002] " +
        "blocked-by:[dependency-failed@task-000002] mutex:[task-000003] " +
        'reason:"because" next:claim Work 中文🚀'
    )
  );
});

test("task-list renderer JSON-escapes control reasons", () => {
  const output = renderTaskListResult(
    success([
      item("task-000001", {
        reason: 'line\n"quoted"\\done',
        title: "Work"
      })
    ]),
    { columns: 80 }
  );
  assert.equal(
    output,
    [
      "TASK LIST tasks=1 tracks=1 actionable=0 running=0 recovery-needed=0 mutex-blocked=0",
      "",
      "TRACK T01 tasks=1",
      'L0 [task-000001] waiting reason:"line\\n\\"quoted\\"\\\\done" Work',
      ""
    ].join("\n")
  );
  assert.equal(output.split("\n").length, 5);
});

test("task-list renderer keeps actual mutex endpoints across same and different tracks", () => {
  const crossTrack = renderTaskListResult(
    success([
      item("task-000001", { exclusionTargets: ["task-000002"] }),
      item("task-000002", { exclusionTargets: ["task-000001"] })
    ]),
    { columns: 80 }
  );
  assert.equal(
    crossTrack,
    [
      "TASK LIST tasks=2 tracks=2 actionable=0 running=0 recovery-needed=0 mutex-blocked=0",
      "",
      "TRACK T01 tasks=1",
      "L0 [task-000001] waiting task-000001",
      "",
      "TRACK T02 tasks=1",
      "L0 [task-000002] waiting task-000002",
      "",
      "RUN MUTEX - cannot run at the same time",
      "T01 [task-000001] mutex T02 [task-000002]",
      ""
    ].join("\n")
  );

  const sameTrack = renderTaskListResult(
    success([
      item("task-000002", {
        exclusionTargets: ["task-000001"],
        parentId: "task-000003"
      }),
      item("task-000003"),
      item("task-000001", {
        dependencyTargets: ["task-000003"],
        exclusionTargets: ["task-000002"]
      })
    ]),
    { columns: 80 }
  );
  assert.match(sameTrack, /TRACK T01 tasks=3\n/u);
  assert.doesNotMatch(sameTrack, /TRACK T02/u);
  assert.match(
    sameTrack,
    /RUN MUTEX - cannot run at the same time\nT01 \[task-000001\] mutex T01 \[task-000002\]\n$/u
  );
});

test("task-list node form switches at 79 and 80 columns without measuring title width", () => {
  const single = item("task-000001", {
    effectiveState: "ready",
    nextAction: "claim",
    title: "这是很长的标题🚀 whose Unicode width is deliberately irrelevant"
  });
  assert.equal(
    renderTaskListResult(success([single]), { columns: 80 }),
    [
      "TASK LIST tasks=1 tracks=1 actionable=1 running=0 recovery-needed=0 mutex-blocked=0",
      "",
      "TRACK T01 tasks=1",
      "L0 [task-000001] ready next:claim 这是很长的标题🚀 whose Unicode width is deliberately irrelevant",
      ""
    ].join("\n")
  );
  assert.equal(
    renderTaskListResult(success([single]), { columns: 79 }),
    [
      "TASK LIST tasks=1 tracks=1 actionable=1 running=0 recovery-needed=0 mutex-blocked=0",
      "",
      "TRACK T01 tasks=1",
      "L0 [task-000001] ready",
      "  next:claim",
      "  title:这是很长的标题🚀 whose Unicode width is deliberately irrelevant",
      ""
    ].join("\n")
  );
});

test("task-list node form switches when any relation list exceeds three endpoints", () => {
  const targets = ["task-000002", "task-000003", "task-000004", "task-000005"];
  const taskId = "task-000001";
  const base = { taskId, sourceTaskId: taskId, inheritancePath: [taskId] };
  const cases = [
    {
      label: "needs",
      output: renderTaskListResult(
        success([
          item(taskId, {
            dependencyTargets: [...targets].reverse(),
            title: "Dense needs"
          }),
          ...targets.map((target) => item(target))
        ]),
        { columns: 80 }
      ),
      expected:
        /\nL1 \[task-000001\] waiting\n  needs:\[task-000002,task-000003,task-000004,task-000005\]\n  title:Dense needs\n/u,
      absent: /blocked-by:|mutex:/u
    },
    {
      label: "blocked-by",
      output: renderTaskListResult(
        success([
          item(taskId, {
            blockers: [
              blocker({
                ...base,
                kind: "ancestor-terminal",
                relatedTaskId: "task-000002",
                state: "cancelled"
              }),
              blocker({
                ...base,
                kind: "dependency-cancelled",
                relatedTaskId: "task-000003",
                state: "cancelled"
              }),
              blocker({
                ...base,
                kind: "dependency-failed",
                relatedTaskId: "task-000004",
                state: "failed"
              }),
              blocker({
                ...base,
                kind: "descendant-lease",
                relatedTaskId: "task-000005",
                state: "running"
              })
            ],
            title: "Dense blockers"
          }),
          ...targets.map((target) => item(target))
        ]),
        { columns: 80 }
      ),
      expected:
        /\nL0 \[task-000001\] waiting\n  blocked-by:\[ancestor-terminal@task-000002,dependency-cancelled@task-000003,dependency-failed@task-000004,descendant-lease@task-000005\]\n  title:Dense blockers\n/u,
      absent: /needs:|mutex:/u
    },
    {
      label: "mutex",
      output: renderTaskListResult(
        success([
          item(taskId, {
            blockers: targets.map((relatedTaskId, index) =>
              blocker({
                ...base,
                kind: "exclusion-running",
                relatedTaskId,
                state: index % 2 === 0 ? "running" : "recovery-needed"
              })
            ),
            title: "Dense mutex"
          }),
          ...targets.map((target, index) =>
            item(target, {
              effectiveState: index % 2 === 0 ? "running" : "recovery-needed"
            })
          )
        ]),
        { columns: 80 }
      ),
      expected:
        /\nL0 \[task-000001\] waiting\n  mutex:\[task-000002,task-000003,task-000004,task-000005\]\n  title:Dense mutex\n/u,
      absent: /needs:|blocked-by:/u
    }
  ];
  for (const { label, output, expected, absent } of cases) {
    assert.match(output, expected, label);
    assert.doesNotMatch(output, absent, label);
  }
  assert.match(
    cases[2]?.output ?? "",
    /^TASK LIST .* running=2 recovery-needed=2 mutex-blocked=1\n/u
  );
});

test("task-list run-mutex group form uses columns and endpoint count thresholds", () => {
  const render = (targetTaskIds: string[], columns: number): string =>
    renderTaskListResult(
      success([
        item("task-000001", { exclusionTargets: targetTaskIds }),
        ...targetTaskIds.map((taskId) => item(taskId))
      ]),
      { columns }
    );
  const twoEndpoints = ["task-000003", "task-000002"];
  assert.match(
    render(twoEndpoints, 80),
    /RUN MUTEX - cannot run at the same time\nT01 \[task-000001\] mutex T02 \[task-000002\], T03 \[task-000003\]\n$/u
  );
  assert.match(
    render(twoEndpoints, 79),
    /RUN MUTEX - cannot run at the same time\nT01 \[task-000001\] mutex\n  T02 \[task-000002\]\n  T03 \[task-000003\]\n$/u
  );
  assert.match(
    render(["task-000005", "task-000002", "task-000004", "task-000003"], 80),
    /RUN MUTEX - cannot run at the same time\nT01 \[task-000001\] mutex\n  T02 \[task-000002\]\n  T03 \[task-000003\]\n  T04 \[task-000004\]\n  T05 \[task-000005\]\n$/u
  );
});

test("task-list renderer normalizes inherited symmetric exclusions into unique pairs", () => {
  const ancestor = item("task-000001", { exclusionTargets: ["task-000003"] });
  const child = item("task-000002", {
    exclusionTargets: ["task-000003"],
    parentId: ancestor.taskId
  });
  child.exclusions.push({
    ...constraint(ancestor.taskId, "task-000003"),
    inheritancePath: [child.taskId, ancestor.taskId]
  });
  const right = item("task-000003", {
    exclusionTargets: [ancestor.taskId, child.taskId]
  });
  const output = renderTaskListResult(success([right, child, ancestor]), {
    columns: 80
  });
  const pair = "T01 [task-000002] mutex T02 [task-000003]";
  assert.equal(output.split(pair).length - 1, 1);
  assert.match(output, /RUN MUTEX - cannot run at the same time/u);
});

test("task-list track labels keep at least two digits without a two-digit limit", () => {
  const items = Array.from({ length: 100 }, (_, index) =>
    item(`task-${String(index + 1).padStart(6, "0")}`, {
      title: `Isolated ${index + 1}`
    })
  );
  const output = renderTaskListResult(success(items), { columns: 80 });
  assert.match(output, /^TASK LIST tasks=100 tracks=100 /u);
  assert.match(output, /\n\nTRACK T01 tasks=1\n/u);
  assert.match(output, /\n\nTRACK T100 tasks=1\nL0 \[task-000100\]/u);
  assert.equal(output.endsWith("\n"), true);
  assert.equal(output.endsWith("\n\n"), false);
});

import assert from "node:assert/strict";
import test from "node:test";
import { completeTask, projectTaskGraph } from "../src/index.ts";
import { graphIndex, initialNow, taskOperation } from "./helpers.ts";
import { claim, leaseUuidB } from "./lifecycle-test-support.ts";

test("effective-state priority and actionable distinguish leaf claim from parent complete", () => {
  let index = graphIndex([
    taskOperation("candidate"),
    taskOperation("waiting", {
      control: { mode: "waiting", reason: "waiting input" }
    }),
    taskOperation("paused", {
      control: { mode: "paused", reason: "paused by user" }
    }),
    taskOperation("ready-leaf", { control: { mode: "queued" } }),
    taskOperation("expired", { control: { mode: "queued" } }),
    taskOperation("parent", { control: { mode: "queued" } }),
    taskOperation("child", {
      parentId: "@parent",
      control: { mode: "queued" }
    })
  ]);
  const expiredClaim = claim(index, "task-000005");
  index = expiredClaim.index;
  const childClaim = claim(index, "task-000007", leaseUuidB);
  index = completeTask(
    childClaim.index,
    {
      taskId: "task-000007",
      leaseId: childClaim.data.leaseId,
      result: { summary: "child done", references: {} }
    },
    initialNow
  ).index;

  const projection = projectTaskGraph(
    index,
    new Date("2026-08-06T08:31:00.000Z")
  );
  assert.equal(projection.tasks["task-000001"]!.effectiveState, "candidate");
  assert.equal(projection.tasks["task-000002"]!.effectiveState, "waiting");
  assert.equal(projection.tasks["task-000003"]!.effectiveState, "paused");
  assert.equal(
    projection.tasks["task-000005"]!.effectiveState,
    "recovery-needed"
  );
  assert.equal(projection.tasks["task-000007"]!.effectiveState, "succeeded");
  assert.equal(projection.tasks["task-000004"]!.nextAction, "claim");
  assert.equal(projection.tasks["task-000006"]!.nextAction, "complete");
  assert.deepEqual(projection.actionableOrder, [
    "task-000004",
    "task-000005",
    "task-000006"
  ]);
});

test("higher-priority execution and control states suppress lower-priority blockers", () => {
  const index = graphIndex([
    taskOperation("succeeded"),
    taskOperation("failed"),
    taskOperation("running"),
    taskOperation("dependency"),
    taskOperation("candidate"),
    taskOperation("waiting", {
      control: { mode: "waiting", reason: "waiting" }
    }),
    taskOperation("paused", {
      control: { mode: "paused", reason: "paused" }
    })
  ]);
  const tasks = index.tasks;
  tasks["task-000001"]!.state.execution = { phase: "succeeded", attempt: 1 };
  tasks["task-000001"]!.content.result = { summary: "done", references: {} };
  tasks["task-000001"]!.state.relations.dependsOn = { "task-000004": true };
  tasks["task-000002"]!.state.control = {
    mode: "waiting",
    reason: "lower priority"
  };
  tasks["task-000002"]!.state.execution = {
    phase: "failed",
    attempt: 1,
    reason: "failed"
  };
  tasks["task-000002"]!.state.relations.dependsOn = { "task-000004": true };
  tasks["task-000003"]!.state.control = {
    mode: "paused",
    reason: "lower priority"
  };
  tasks["task-000003"]!.state.execution = {
    phase: "running",
    attempt: 1,
    lease: {
      id: "lease-00000000-0000-4000-8000-000000000103",
      actor: "worker",
      claimedAt: "2026-08-06T08:00:00.000Z",
      renewedAt: "2026-08-06T08:00:00.000Z",
      expiresAt: "2026-08-06T08:30:00.000Z"
    }
  };
  tasks["task-000003"]!.state.relations.dependsOn = { "task-000004": true };
  tasks["task-000005"]!.state.relations.dependsOn = { "task-000004": true };
  tasks["task-000006"]!.state.relations.dependsOn = { "task-000004": true };
  tasks["task-000007"]!.state.relations.dependsOn = { "task-000004": true };

  const projection = projectTaskGraph(index, initialNow);
  for (const taskId of ["task-000001", "task-000002", "task-000003"]) {
    assert.deepEqual(projection.tasks[taskId]!.blockers, []);
    assert.equal(projection.tasks[taskId]!.nextAction, null);
  }
  assert.equal(projection.tasks["task-000001"]!.effectiveState, "succeeded");
  assert.equal(projection.tasks["task-000002"]!.effectiveState, "failed");
  assert.equal(projection.tasks["task-000003"]!.effectiveState, "running");
  for (const [taskId, kind] of [
    ["task-000005", "control-candidate"],
    ["task-000006", "control-waiting"],
    ["task-000007", "control-paused"]
  ] as const) {
    assert.deepEqual(
      projection.tasks[taskId]!.blockers.map((blocker) => blocker.kind),
      [kind]
    );
  }
});

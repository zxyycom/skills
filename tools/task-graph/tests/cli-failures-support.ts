import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { taskContent, withTempWorkspace } from "./helpers.ts";
import { callCli, requireRecord } from "./cli-test-support.ts";

export async function verifyCliFailures(): Promise<void> {
  async function verifyFailureSetup(root: string): Promise<void> {
    const initialized = await callCli(root, ["index", "init"]);
    assert.equal(initialized.result.ok, true);
    assert.equal(initialized.result.revision, 0);

    const task = await callCli(root, [
      "task",
      "create",
      "--title",
      "candidate",
      "--goal",
      "candidate goal",
      "--reference",
      "thread=supported",
      "--expected-revision",
      "0"
    ]);
    assert.equal(task.result.ok, true);
    assert.equal(task.result.revision, 1);

    const shownTask = await callCli(root, ["task", "show", "task-000001"]);
    assert.equal(shownTask.result.ok, true);
    if (shownTask.result.ok) {
      const data = requireRecord(shownTask.result.data, "task show data");
      const taskData = requireRecord(data.task, "task show data.task");
      const content = requireRecord(
        taskData.content,
        "task show data.task.content"
      );
      assert.deepEqual(content.acceptance, []);
      assert.deepEqual(content.references, { thread: "supported" });
    }

    const reservedReference = await callCli(root, [
      "task",
      "create",
      "--title",
      "reserved reference",
      "--goal",
      "reserved reference goal",
      "--acceptance",
      "reserved reference accepted",
      "--reference",
      "prototype=blocked",
      "--expected-revision",
      "1"
    ]);
    assert.equal(reservedReference.result.ok, false);
    if (!reservedReference.result.ok) {
      assert.equal(reservedReference.result.error.code, "REQUEST_INVALID");
    }

    const prototypeReference = await callCli(root, [
      "task",
      "create",
      "--title",
      "invalid prototype",
      "--goal",
      "invalid prototype goal",
      "--acceptance",
      "invalid prototype accepted",
      "--reference",
      "__proto__=blocked",
      "--expected-revision",
      "1"
    ]);
    assert.equal(prototypeReference.result.ok, false);
    if (!prototypeReference.result.ok) {
      assert.equal(prototypeReference.result.error.code, "REQUEST_INVALID");
    }
  }

  async function verifyFailureResponses(root: string): Promise<void> {
    for (const [args, code] of [
      [["task", "show", "constructor"], "TASK_NOT_FOUND"]
    ] as const) {
      const lookup = await callCli(root, [...args]);
      assert.equal(lookup.result.ok, false);
      if (!lookup.result.ok) assert.equal(lookup.result.error.code, code);
    }

    const stateFailure = await callCli(root, [
      "claim",
      "task-000001",
      "--actor",
      "worker"
    ]);
    assert.equal(stateFailure.result.ok, false);
    if (!stateFailure.result.ok) {
      assert.equal(stateFailure.result.error.code, "STATE_CONFLICT");
      assert.equal(stateFailure.result.revision, 1);
    }

    const conflict = await callCli(root, [
      "task",
      "create",
      "--title",
      "stale",
      "--goal",
      "stale revision",
      "--expected-revision",
      "0"
    ]);
    assert.equal(conflict.result.ok, false);
    if (!conflict.result.ok) {
      assert.equal(conflict.result.error.code, "REVISION_CONFLICT");
      assert.equal(conflict.result.error.retryable, true);
    }

    const invalidRequestPath = path.join(root, "invalid-request.json");
    await fs.writeFile(
      invalidRequestPath,
      JSON.stringify({
        expectedRevision: 1,
        operations: [
          { kind: "create-task", content: taskContent("invalid"), extra: true }
        ]
      }),
      "utf8"
    );
    const schemaFailure = await callCli(root, [
      "apply",
      "--file",
      invalidRequestPath
    ]);
    assert.equal(schemaFailure.result.ok, false);
    if (!schemaFailure.result.ok) {
      assert.equal(schemaFailure.result.error.code, "REQUEST_INVALID");
    }

    const missingFile = await callCli(root, [
      "apply",
      "--file",
      path.join(root, "missing.json")
    ]);
    assert.equal(missingFile.result.ok, false);
    if (!missingFile.result.ok) {
      assert.equal(missingFile.result.error.code, "REQUEST_INVALID");
    }

    const duplicateInit = await callCli(root, ["index", "init"]);
    assert.equal(duplicateInit.result.ok, false);
    if (!duplicateInit.result.ok) {
      assert.equal(duplicateInit.result.error.code, "INDEX_EXISTS");
    }
  }

  async function verifyFailureWorkspace(root: string): Promise<void> {
    await verifyFailureSetup(root);
    await verifyFailureResponses(root);
  }

  await withTempWorkspace(verifyFailureWorkspace);

  await withTempWorkspace(async (root) => {
    await callCli(root, ["index", "init"]);
    const unknown = await callCli(
      root,
      [
        "task",
        "create",
        "--title",
        "committed but response lost",
        "--goal",
        "exercise write outcome",
        "--expected-revision",
        "0"
      ],
      {
        atomicWrite: async (target) => {
          await fs.writeFile(target, "{corrupt", "utf8");
          throw new Error("simulated different replacement");
        }
      }
    );
    assert.equal(unknown.result.ok, false);
    if (!unknown.result.ok) {
      assert.equal(unknown.result.error.code, "WRITE_OUTCOME_UNKNOWN");
      assert.equal(unknown.result.revision, null);
      assert.equal(unknown.result.error.details.possibleRevision, 1);
    }
  });

  await withTempWorkspace(async (root) => {
    await callCli(root, ["index", "init"]);
    const unknown = await callCli(
      root,
      [
        "task",
        "create",
        "--title",
        "committed then unreadable",
        "--goal",
        "exercise missing readback",
        "--expected-revision",
        "0"
      ],
      {
        atomicWrite: async (target) => {
          await fs.unlink(target);
        }
      }
    );
    assert.equal(unknown.result.ok, true);
    assert.equal(unknown.result.revision, 1);
  });
}

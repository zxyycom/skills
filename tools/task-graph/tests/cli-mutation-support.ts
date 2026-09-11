import assert from "node:assert/strict";
import { withTempWorkspace } from "./helpers.ts";
import { callCli, requireRecord, requireString } from "./cli-test-support.ts";

async function setupMutationClaim(root: string): Promise<string> {
  await callCli(root, ["index", "init"]);
  await callCli(root, [
    "task",
    "create",
    "--title",
    "running",
    "--goal",
    "running goal",
    "--acceptance",
    "running accepted",
    "--control",
    "queued",
    "--expected-revision",
    "0"
  ]);
  const claimed = await callCli(root, [
    "claim",
    "task-000001",
    "--actor",
    "worker"
  ]);
  assert.equal(claimed.result.ok, true);
  if (!claimed.result.ok) throw new Error("claim setup failed");
  const claimData = requireRecord(claimed.result.data, "claim data");
  const leaseId = requireString(claimData.leaseId, "claim data.leaseId");
  return leaseId;
}

export async function verifyCliMutationRejections(): Promise<void> {
  await withTempWorkspace(async (root) => {
    const leaseId = await setupMutationClaim(root);
    for (const args of [
      [
        "complete",
        "task-000001",
        "--lease",
        leaseId,
        "--expected-revision",
        "3",
        "--result-summary",
        "ambiguous"
      ],
      [
        "cancel",
        "task-000001",
        "--lease",
        leaseId,
        "--expected-revision",
        "3",
        "--reason",
        "ambiguous"
      ],
      [
        "claim",
        "task-000001",
        "--actor",
        "replacement",
        "--recover-lease",
        leaseId
      ]
    ]) {
      const failure = await callCli(root, args);
      assert.equal(failure.result.ok, false);
      if (!failure.result.ok) {
        assert.equal(failure.result.error.code, "ARGUMENT_INVALID");
      }
    }

    for (const args of [
      [
        "complete",
        "task-000001",
        "--result-summary",
        "missing mutation precondition"
      ],
      ["cancel", "task-000001", "--reason", "missing mutation precondition"]
    ]) {
      const failure = await callCli(root, args);
      assert.equal(failure.result.ok, false);
      if (!failure.result.ok) {
        assert.equal(failure.result.error.code, "ARGUMENT_INVALID");
      }
    }

    for (const controlArgs of [
      ["--control", "queued", "--reason", "not allowed"],
      ["--control", "waiting"],
      ["--reason", "orphaned"]
    ]) {
      const failure = await callCli(root, [
        "task",
        "create",
        "--title",
        "invalid control",
        "--goal",
        "invalid control goal",
        "--acceptance",
        "invalid control accepted",
        "--expected-revision",
        "3",
        ...controlArgs
      ]);
      assert.equal(failure.result.ok, false);
      if (!failure.result.ok) {
        assert.equal(failure.result.error.code, "ARGUMENT_INVALID");
      }
    }
  });
}

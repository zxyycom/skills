import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { planChangePlanDirectory } from "../src/lifecycle.ts";
import { validBaseCommit, withTempRoot, writePlan } from "./support.ts";

test("plan confirms drafts and reconfirms plans without task progress gates", () =>
  withTempRoot("lifecycle-plan", async (tempRoot) => {
    const changesRoot = path.join(tempRoot, "changes");
    const draftDirectory = await writePlan(changesRoot, "draft", {
      metadata: { stage: "draft" }
    });
    const progressedPlanDirectory = await writePlan(
      changesRoot,
      "progressed-plan",
      {
        tasks: `# Tasks

本 change 在 Plan 内如实保存各区段的实际进度。

## Readiness

- [ ] 0.1 准备事项仍未完成。

## Implementation

- [x] 1.1 已经形成实现证据。

## Verification

- [x] 2.1 已经形成验证证据。
`
      }
    );

    const draftResult = await planChangePlanDirectory(draftDirectory);
    const planResult = await planChangePlanDirectory(progressedPlanDirectory);

    assert.equal(draftResult.success, true);
    assert.equal(draftResult.action, "plan");
    assert.equal(draftResult.fromStage, "draft");
    assert.equal(draftResult.metadata?.stage, "plan");
    assert.equal(planResult.success, true);
    assert.equal(planResult.fromStage, "plan");
    assert.equal(planResult.metadata?.stage, "plan");
    assert.ok(planResult.metadata?.baseCommit);
  }));

test("plan rejects noncanonical metadata without mutation", () =>
  withTempRoot("lifecycle-noncanonical", async (tempRoot) => {
    const changesRoot = path.join(tempRoot, "changes");
    const invalidInputs = [
      [
        "implementation",
        {
          baseCommit: validBaseCommit,
          stage: "implementation"
        }
      ],
      [
        "shelved",
        {
          baseCommit: validBaseCommit,
          shelf: {
            atCommit: validBaseCommit,
            reason: "等待外部输入",
            source: "explicit"
          },
          stage: "shelved"
        }
      ],
      ["null-base", { baseCommit: null, stage: "plan" }]
    ] as const;

    for (const [name, metadata] of invalidInputs) {
      const directory = await writePlan(changesRoot, name, { metadata });
      const metadataPath = path.join(directory, ".change-plan.json");
      const before = await fs.readFile(metadataPath, "utf8");
      const result = await planChangePlanDirectory(directory);
      assert.equal(result.success, false);
      if (result.success) {
        assert.fail("expected noncanonical metadata to fail");
      }
      assert.equal(result.errorCode, "invalid-source-stage");
      assert.equal(result.fromStage, null);
      assert.ok(
        result.diagnostics.some(
          (diagnostic) => diagnostic.code === "invalid-metadata"
        )
      );
      assert.equal(await fs.readFile(metadataPath, "utf8"), before);
    }
  }));

test("plan refreshes the baseline without inspecting the old distance", () =>
  withTempRoot("lifecycle-distance-failure", async (tempRoot) => {
    const changeDirectory = await writePlan(
      path.join(tempRoot, "changes"),
      "inspection-failure",
      {
        metadata: {
          baseCommit: "a".repeat(256 * 1024),
          stage: "plan"
        }
      }
    );
    const head = spawnSync("git", ["-C", tempRoot, "rev-parse", "HEAD"], {
      encoding: "utf8"
    });
    assert.equal(head.status, 0, head.stderr);

    const result = await planChangePlanDirectory(changeDirectory);
    assert.equal(result.success, true);
    assert.equal(result.fromStage, "plan");
    assert.equal(result.metadata?.stage, "plan");
    assert.equal(
      result.metadata?.stage === "plan" ? result.metadata.baseCommit : null,
      head.stdout.trim()
    );
  }));

test("plan returns a stable version-control failure without metadata mutation", () =>
  withTempRoot("lifecycle-version-control", async (tempRoot) => {
    const repository = path.join(tempRoot, "repository-without-head");
    await fs.mkdir(repository);
    const initialized = spawnSync(
      "git",
      ["-C", repository, "init", "--quiet", "--initial-branch=main"],
      { encoding: "utf8" }
    );
    assert.equal(initialized.status, 0, initialized.stderr);
    const changeDirectory = await writePlan(
      path.join(repository, "changes"),
      "unassessable-plan",
      { metadata: { stage: "draft" } }
    );
    const metadataPath = path.join(changeDirectory, ".change-plan.json");
    const before = await fs.readFile(metadataPath, "utf8");
    const result = await planChangePlanDirectory(changeDirectory);
    assert.equal(result.success, false);
    assert.equal(result.action, "plan");
    assert.equal(result.errorCode, "base-commit-unavailable");
    assert.equal(await fs.readFile(metadataPath, "utf8"), before);
  }));

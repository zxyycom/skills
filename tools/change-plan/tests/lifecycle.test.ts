import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { planChangePlanDirectory } from "../src/lifecycle.ts";
import { withTempRoot, writePlan } from "./support.ts";

test("plan confirms drafts and reconfirms plans without task progress gates", () => (
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
  })
));

test("plan rewrites legacy active metadata to canonical plan metadata", () => (
  withTempRoot("lifecycle-legacy", async (tempRoot) => {
    const changesRoot = path.join(tempRoot, "changes");
    const implementationDirectory = await writePlan(
      changesRoot,
      "implementation",
      {
        metadata: {
          baseCommit: "0123456789abcdef0123456789abcdef01234567",
          stage: "implementation"
        }
      }
    );
    const shelvedDirectory = await writePlan(changesRoot, "shelved", {
      metadata: {
        baseCommit: "0123456789abcdef0123456789abcdef01234567",
        shelf: {
          atCommit: "0123456789abcdef0123456789abcdef01234567",
          reason: "等待外部输入",
          source: "explicit"
        },
        stage: "shelved"
      }
    });
    const nullBaseDirectory = await writePlan(changesRoot, "null-base", {
      metadata: { baseCommit: null, stage: "plan" }
    });

    for (const directory of [
      implementationDirectory,
      shelvedDirectory,
      nullBaseDirectory
    ]) {
      const result = await planChangePlanDirectory(directory);
      assert.equal(result.success, true);
      assert.equal(result.fromStage, "plan");
      const persisted: unknown = JSON.parse(await fs.readFile(
        path.join(directory, ".change-plan.json"),
        "utf8"
      ));
      assert.deepEqual(persisted, result.metadata);
      assert.deepEqual(Object.keys(persisted as object).sort(), [
        "baseCommit",
        "stage"
      ]);
      assert.equal((persisted as { stage: string }).stage, "plan");
    }
  })
));

test("plan refreshes the baseline without inspecting the old distance", () => (
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
  })
));

test("plan returns a stable version-control failure without metadata mutation", () => (
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
  })
));

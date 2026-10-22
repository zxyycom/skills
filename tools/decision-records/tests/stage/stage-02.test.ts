import { withGitFixtureWorkspace } from "../support-git-fixture.ts";
import { stageDecisionRecords } from "../../src/decision-stage-service.ts";
import {
  assert,
  commitWorkspace,
  countGitInvocations,
  createStageScaleFixture,
  decisionFilePath,
  fs,
  initializeGitRepository,
  process,
  runGit,
  test,
  withTemporaryWorkspace,
  syncDecisionIndexBeforeStage
} from "./support.ts";

test(
  "stage keeps Git invocation counts bounded for complete decision snapshots",
  { timeout: 30_000 },
  async (t) => {
    if (process.platform === "win32") {
      t.skip("The Git invocation wrapper is currently POSIX-only");
      return;
    }
    // More entries than either accepted call-count ceiling distinguish bounded
    // Git access from a per-entry regression without making fixture size itself
    // the behavior under test.
    for (const decisionCount of [64]) {
      await withTemporaryWorkspace(
        `stage-call-count-${decisionCount}`,
        async (workspaceRoot) => {
          initializeGitRepository(workspaceRoot);
          const decisionIds = await createStageScaleFixture(
            workspaceRoot,
            decisionCount
          );
          await syncDecisionIndexBeforeStage(workspaceRoot);
          commitWorkspace(workspaceRoot);

          const unchanged = await countGitInvocations(async () =>
            stageDecisionRecords({
              decisionIds: [decisionIds[0]!],
              location: { workspaceRoot, decisionsDir: "docs/decisions" }
            })
          );
          assert.equal(
            unchanged.result.status,
            "ok",
            JSON.stringify(unchanged.result)
          );
          assert.ok(
            unchanged.callCount <= 32,
            `${decisionCount} unchanged decisions used ${unchanged.callCount} Git invocations`
          );
          assert.equal(
            runGit(workspaceRoot, ["diff", "--cached", "--name-only"]),
            ""
          );

          const changedDecisionPath = decisionFilePath(
            workspaceRoot,
            decisionIds[0]!
          );
          await fs.writeFile(
            changedDecisionPath,
            (await fs.readFile(changedDecisionPath, "utf8")).replace(
              "规模化决策 0",
              "修改后的规模化决策"
            ),
            "utf8"
          );
          await syncDecisionIndexBeforeStage(workspaceRoot);
          const changed = await countGitInvocations(async () =>
            stageDecisionRecords({
              decisionIds: [decisionIds[0]!],
              location: { workspaceRoot, decisionsDir: "docs/decisions" }
            })
          );
          assert.equal(
            changed.result.status,
            "ok",
            JSON.stringify(changed.result)
          );
          assert.ok(
            changed.callCount <= 32,
            `${decisionCount} changed decisions used ${changed.callCount} Git invocations`
          );
          const pendingPaths = runGit(workspaceRoot, [
            "diff",
            "--cached",
            "--name-only"
          ]);
          assert.match(pendingPaths, new RegExp(decisionIds[0]!));
          assert.match(pendingPaths, /docs\/decisions\/decision-index\.json/);
          assert.match(
            runGit(workspaceRoot, [
              "show",
              `:docs/decisions/${decisionIds[0]!}.md`
            ]),
            /修改后的规模化决策/
          );
          const pendingIndex = JSON.parse(
            runGit(workspaceRoot, [
              "show",
              ":docs/decisions/decision-index.json"
            ])
          );
          assert.equal(
            pendingIndex.entries[decisionIds[0]!].title,
            "修改后的规模化决策"
          );
        }
      );
    }
  }
);

test("stage refreshes an already selected pending decision without changes", () =>
  withGitFixtureWorkspace("stage-existing-pending", async (workspaceRoot) => {
    const selectedId = "use-generated-cli";
    const first = await stageDecisionRecords({
      decisionIds: [selectedId],
      location: { workspaceRoot: workspaceRoot, decisionsDir: "docs/decisions" }
    });
    assert.equal(first.status, "ok", JSON.stringify(first));
    const second = await stageDecisionRecords({
      decisionIds: [selectedId],
      location: { workspaceRoot: workspaceRoot, decisionsDir: "docs/decisions" }
    });
    assert.equal(second.status, "ok", JSON.stringify(second));
    if (second.status === "ok") assert.deepEqual(second.writtenPaths, []);
  }));

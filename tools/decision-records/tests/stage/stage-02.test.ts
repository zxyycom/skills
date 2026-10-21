import { withGitFixtureWorkspace } from "../support-git-fixture.ts";
import * as v from "valibot";
import { stageDecisionRecords } from "../../src/decision-stage-service.ts";
import { buildStageIndexText } from "../../src/decision-stage-prepare.ts";
import { stageSource, stageTarget } from "./domain-support.ts";
import { decisionBaselineSourcePaths } from "../../src/decision-stage-sources.ts";
import {
  assert,
  candidateDecisionBody,
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
  writeDecision,
  syncDecisionIndexBeforeStage
} from "./support.ts";

test("stage does not bind unrelated identical deletion and addition as a rename", async () => {
  const old = stageSource("old");
  const added = stageSource("new");
  const target = await stageTarget([old], [added], ["old", "new"]);
  assert.deepEqual(
    target.selectedSources.map((s) => [
      s.decisionId,
      s.source?.source.decisionId ?? null
    ]),
    [
      ["old", null],
      ["new", "new"]
    ]
  );
  assert.deepEqual(
    target.sources.map((s) => s.decisionId),
    ["new"]
  );
});

test("stage isolates unselected filesystem changes", async () => {
  const baseline = stageSource("existing");
  const modified = stageSource("existing", "existing.md", "未选中的修改");
  const selected = stageSource("selected");
  const unselected = stageSource("unselected");
  const target = await stageTarget(
    [baseline],
    [modified, selected, unselected],
    ["selected"]
  );
  assert.deepEqual(target.selectedIds, ["selected"]);
  assert.deepEqual(
    target.sources.map((source) => source.decisionId),
    ["existing", "selected"]
  );
  assert.equal(
    target.sources.find((source) => source.decisionId === "existing")?.text,
    baseline.source.text
  );
  assert.deepEqual(
    target.sourceFiles.map((file) => file.path),
    ["docs/decisions/existing.md", "docs/decisions/selected.md"]
  );
  const projected = await buildStageIndexText(
    target.sources,
    "docs/decisions/decision-index.json"
  );
  assert.equal(projected.status, "ok", JSON.stringify(projected));
  if (projected.status !== "ok")
    throw new Error("Expected isolated projection");
  const index = v.parse(
    v.object({
      entries: v.record(v.string(), v.object({ title: v.string() }))
    }),
    JSON.parse(projected.value) as unknown
  );
  assert.ok(index.entries.selected);
  assert.equal(index.entries.existing?.title, "领域暂存来源");
  assert.equal(index.entries.unselected, undefined);
});

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
            unchanged.callCount <= 20,
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
            changed.callCount <= 25,
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

test("stage rejects an existing pending decision index", () =>
  withGitFixtureWorkspace("stage-existing-pending", async (workspaceRoot) => {
    const selectedId = "use-existing-pending";
    await writeDecision(workspaceRoot, selectedId, candidateDecisionBody());
    const first = await stageDecisionRecords({
      decisionIds: [selectedId],
      location: { workspaceRoot: workspaceRoot, decisionsDir: "docs/decisions" }
    });
    assert.equal(first.status, "ok", JSON.stringify(first));
    const second = await stageDecisionRecords({
      decisionIds: [selectedId],
      location: { workspaceRoot: workspaceRoot, decisionsDir: "docs/decisions" }
    });
    assert.equal(second.status, "error");
    assert.match(
      JSON.stringify(second),
      /pending snapshot already contains files/
    );
  }));

test("stage rejects an old domain revision before changing pending files", () => {
  assert.throws(
    () =>
      decisionBaselineSourcePaths("docs/decisions", [
        "docs/decisions/decision-domains.json",
        "docs/decisions/decision-records/legacy.md"
      ]),
    /revision decision scope contains unsupported file: decision-domains.json/
  );
});

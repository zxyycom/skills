import { withGitFixtureWorkspace } from "../support-git-fixture.ts";
import { stageSource, stageTarget } from "./domain-support.ts";
import {
  decisionBaselineSourcePaths,
  readFilesystemDecisionCandidates,
  resolveFilesystemDecisionSource
} from "../../src/decision-stage-sources.ts";
import {
  decisionStageTargetFailure,
  buildStageIndexText
} from "../../src/decision-stage-prepare.ts";
import { stageDecisionRecords } from "../../src/decision-stage-service.ts";
import {
  archivedDecisionId,
  archivedSourcePath,
  assert,
  candidateDecisionBody,
  commitWorkspace,
  currentDecisionId,
  currentSourcePath,
  decisionFilePath,
  fs,
  initializeGitRepository,
  path,
  runGit,
  test,
  withTemporaryWorkspace,
  writeDecision,
  syncDecisionIndexBeforeStage
} from "./support.ts";

test("stage applies selected additions modifications deletions and explicit renames", () =>
  withGitFixtureWorkspace("stage-overlay", async (workspaceRoot) => {
    const modified = decisionFilePath(workspaceRoot, currentSourcePath);
    const deleted = decisionFilePath(workspaceRoot, archivedSourcePath);
    const addedId = "use-added-stage";
    await fs.writeFile(
      modified,
      (await fs.readFile(modified, "utf8"))
        .replace("使用生成 CLI", "使用修改 CLI")
        .replace(
          "relations:\n  - type: 修订\n    target: 260710-use-source-cli",
          "relations: []"
        ),
      "utf8"
    );
    await fs.rm(deleted);
    await writeDecision(
      workspaceRoot,
      addedId,
      candidateDecisionBody({ title: "使用新增 Stage" })
        .replace("status: candidate", "status: active")
        .replace("alignment: null", "alignment: aligned")
        .replace("createdAt: null", "createdAt: 2026-08-15T00:00:00Z")
    );
    await syncDecisionIndexBeforeStage(workspaceRoot);
    const staged = await stageDecisionRecords({
      decisionIds: [currentDecisionId, archivedDecisionId, addedId],
      location: { workspaceRoot: workspaceRoot, decisionsDir: "docs/decisions" }
    });
    assert.equal(staged.status, "ok", JSON.stringify(staged));
    const pending = runGit(workspaceRoot, ["diff", "--cached", "--name-only"]);
    assert.match(pending, new RegExp(currentDecisionId));
    assert.match(pending, new RegExp(archivedDecisionId));
    assert.match(pending, new RegExp(addedId));
    assert.match(pending, /decision-index\.json/);
  }));

test("stage bootstraps the first pending decision collection", () =>
  withTemporaryWorkspace("stage-first-collection", async (workspaceRoot) => {
    initializeGitRepository(workspaceRoot);
    await fs.writeFile(
      path.join(workspaceRoot, "README.md"),
      "baseline\n",
      "utf8"
    );
    commitWorkspace(workspaceRoot);
    const id = "use-first-stage";
    await writeDecision(
      workspaceRoot,
      id,
      candidateDecisionBody()
        .replace("status: candidate", "status: active")
        .replace("alignment: null", "alignment: aligned")
        .replace("createdAt: null", "createdAt: 2026-08-15T00:00:00Z")
    );
    const staged = await stageDecisionRecords({
      decisionIds: [id],
      location: { workspaceRoot: workspaceRoot, decisionsDir: "docs/decisions" }
    });
    assert.equal(staged.status, "ok", JSON.stringify(staged));
    const pending = runGit(workspaceRoot, ["diff", "--cached", "--name-only"]);
    assert.match(pending, new RegExp(id));
    assert.match(pending, /decision-index\.json/);
  }));

test("stage bootstraps a new Decision when revision contains only the derived index", async () => {
  assert.deepEqual(
    decisionBaselineSourcePaths("docs/decisions", [
      "docs/decisions/decision-index.json"
    ]),
    []
  );
  const source = stageSource("selected");
  const target = await stageTarget([], [source], ["selected"]);
  const projected = await buildStageIndexText(
    target.sources,
    "docs/decisions/decision-index.json"
  );
  assert.equal(projected.status, "ok");
  if (projected.status === "ok")
    assert.ok(JSON.parse(projected.value).entries.selected);
});

test("stage rejects invalid duplicate and missing paths without changing the pending snapshot", async () => {
  for (const ids of [
    [currentDecisionId, currentDecisionId],
    ["../outside.md"]
  ]) {
    const result = await stageDecisionRecords({
      decisionIds: ids,
      location: {
        workspaceRoot: "missing-stage-root",
        decisionsDir: "docs/decisions"
      }
    });
    assert.equal(result.status, "error");
    if (result.status === "error") {
      assert.equal(result.exitCode, 2);
      assert.match(
        JSON.stringify(result.diagnostics),
        /must not be repeated|extensionless kebab-case/
      );
    }
  }
  await assert.rejects(
    stageTarget([stageSource("existing")], [], ["missing"]),
    /Selected Decision name does not exist/
  );
});

test("stage keeps duplicate selected source identities as a domain diagnostic", async () => {
  await withTemporaryWorkspace("stage-duplicate-source", async (root) => {
    const source = stageSource("selected");
    await fs.writeFile(path.join(root, "first.md"), source.source.text);
    await fs.writeFile(path.join(root, "second.md"), source.source.text);
    const candidates = await readFilesystemDecisionCandidates(
      root,
      "docs/decisions"
    );
    let failure;
    try {
      resolveFilesystemDecisionSource(candidates, source.source.decisionId);
      assert.fail("duplicate source must fail");
    } catch (error) {
      failure = decisionStageTargetFailure(error);
    }
    assert.equal(failure.status, "error");
    assert.match(JSON.stringify(failure.diagnostics), /stage-snapshot-invalid/);
    assert.match(
      JSON.stringify(failure.diagnostics),
      /more than one filesystem source path/
    );
    assert.doesNotMatch(
      JSON.stringify(failure.diagnostics),
      /causeCategory.*unknown/
    );
  });
});

test("stage rejects invalid candidate relation targets before pending writes", async () => {
  const source = stageSource("existing").source;
  const invalid = {
    ...stageSource("invalid").source,
    text: candidateDecisionBody({
      id: "invalid",
      relations: [{ type: "修订", target: "missing-target" }]
    })
  };
  const result = await buildStageIndexText(
    [source, invalid],
    "docs/decisions/decision-index.json"
  );
  assert.equal(result.status, "error");
  if (result.status === "error")
    assert.match(
      JSON.stringify(result.diagnostics),
      /target does not exist.*missing-target/
    );
});

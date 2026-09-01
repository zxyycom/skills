import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import test from "node:test";
import { createCliProgram } from "../src/cli-args.ts";
import {
  archivedDecisionId,
  archivedSourcePath,
  candidateDecisionBody,
  commitWorkspace,
  currentDecisionId,
  currentSourcePath,
  decisionFilePath,
  withTemporaryWorkspace,
  initializeGitRepository,
  runGit,
  runSourceCli,
  withGitFixtureWorkspace,
  writeDecision
} from "./support.ts";

test("stage selects one Decision ID when its sourcePath moves between root and archive", () =>
  withGitFixtureWorkspace("stage-move", async (workspaceRoot) => {
    const currentPath = decisionFilePath(workspaceRoot, currentSourcePath);
    const archivedPath = decisionFilePath(
      workspaceRoot,
      `archive/${currentDecisionId}`
    );
    await fs.mkdir(path.dirname(archivedPath), { recursive: true });
    await fs.rename(currentPath, archivedPath);
    await fs.writeFile(
      archivedPath,
      (await fs.readFile(archivedPath, "utf8")).replace(
        "status: active",
        "status: archived"
      ),
      "utf8"
    );

    const staged = await runSourceCli([
      "stage",
      currentDecisionId,
      "--root",
      workspaceRoot
    ]);
    assert.equal(staged.exitCode, 0, staged.stderr);
    const pendingPaths = runGit(workspaceRoot, [
      "diff",
      "--cached",
      "--name-status"
    ]);
    assert.match(
      pendingPaths,
      new RegExp(
        `R\\d+\\tdocs/decisions/${currentDecisionId}\\tdocs/decisions/archive/${currentDecisionId}`
      )
    );
    assert.match(pendingPaths, /docs\/decisions\/decision-index\.json/);
  }));

test("stage treats a selected new ID as an addition and preserves an unselected old ID", () =>
  withGitFixtureWorkspace("stage-addition", async (workspaceRoot) => {
    const addedId = "use-added-cli.md";
    await writeDecision(
      workspaceRoot,
      addedId,
      candidateDecisionBody({ title: "新增稳定 ID" })
        .replace("status: candidate", "status: active")
        .replace("alignment: null", "alignment: aligned")
        .replace("createdAt: null", "createdAt: 2026-08-15T00:00:00Z")
    );
    const staged = await runSourceCli([
      "stage",
      addedId,
      "--root",
      workspaceRoot
    ]);
    assert.equal(staged.exitCode, 0, staged.stderr);
    const pending = JSON.parse(
      runGit(workspaceRoot, ["show", ":docs/decisions/decision-index.json"])
    );
    assert.ok(pending.entries[currentDecisionId]);
    assert.ok(pending.entries[addedId]);
  }));

test("stage expresses a basename identity rename by selecting both IDs", () =>
  withGitFixtureWorkspace("stage-rename", async (workspaceRoot) => {
    const renamedId = "use-renamed-cli.md";
    const renamedPath = decisionFilePath(workspaceRoot, renamedId);
    await fs.rename(
      decisionFilePath(workspaceRoot, currentSourcePath),
      renamedPath
    );
    await fs.writeFile(
      renamedPath,
      (await fs.readFile(renamedPath, "utf8")).replace(
        "使用生成 CLI",
        "重命名后编辑 CLI"
      ),
      "utf8"
    );
    const staged = await runSourceCli([
      "stage",
      currentDecisionId,
      renamedId,
      "--root",
      workspaceRoot
    ]);
    assert.equal(staged.exitCode, 0, staged.stderr);
    const pending = JSON.parse(
      runGit(workspaceRoot, ["show", ":docs/decisions/decision-index.json"])
    );
    assert.equal(pending.entries[currentDecisionId], undefined);
    assert.equal(pending.entries[renamedId].state.title, "重命名后编辑 CLI");
  }));

test("stage does not bind unrelated identical deletion and addition as a rename", () =>
  withGitFixtureWorkspace(
    "stage-unrelated-identical",
    async (workspaceRoot) => {
      const oldId = "use-old-candidate.md";
      const newId = "use-new-candidate.md";
      const body = candidateDecisionBody({ title: "相同但无关的候选" });
      await writeDecision(workspaceRoot, oldId, body);
      commitWorkspace(workspaceRoot);
      await fs.rm(decisionFilePath(workspaceRoot, oldId));
      await writeDecision(workspaceRoot, newId, body);
      const staged = await runSourceCli([
        "stage",
        oldId,
        newId,
        "--root",
        workspaceRoot
      ]);
      assert.equal(staged.exitCode, 0, staged.stderr);
      const status = runGit(workspaceRoot, [
        "diff",
        "--cached",
        "--name-status",
        "--no-renames"
      ]);
      assert.match(status, new RegExp(`D\\tdocs/decisions/${oldId}`));
      assert.match(status, new RegExp(`A\\tdocs/decisions/${newId}`));
    }
  ));

test("stage isolates unselected filesystem changes", () =>
  withGitFixtureWorkspace("stage-isolation", async (workspaceRoot) => {
    const selectedId = "use-selected-stage.md";
    const unselectedId = "use-unselected-stage.md";
    await writeDecision(workspaceRoot, selectedId, candidateDecisionBody());
    await writeDecision(
      workspaceRoot,
      unselectedId,
      candidateDecisionBody({ title: "未选择的暂存变更" })
    );
    const staged = await runSourceCli([
      "stage",
      selectedId,
      "--root",
      workspaceRoot
    ]);
    assert.equal(staged.exitCode, 0, staged.stderr);
    const pending = runGit(workspaceRoot, ["diff", "--cached", "--name-only"]);
    assert.match(pending, new RegExp(selectedId));
    assert.doesNotMatch(pending, new RegExp(unselectedId));
  }));

test(
  "stage keeps Git invocation counts bounded for complete decision snapshots",
  { timeout: 30_000 },
  async (t) => {
    if (process.platform === "win32") {
      t.skip("The Git invocation wrapper is currently POSIX-only");
      return;
    }
    for (const decisionCount of [150, 300]) {
      await withTemporaryWorkspace(
        `stage-call-count-${decisionCount}`,
        async (workspaceRoot) => {
          initializeGitRepository(workspaceRoot);
          const decisionIds = await createStageScaleFixture(
            workspaceRoot,
            decisionCount
          );
          const synced = await runSourceCli([
            "sync-index",
            "--root",
            workspaceRoot
          ]);
          assert.equal(synced.exitCode, 0, synced.stderr);
          commitWorkspace(workspaceRoot);

          const unchanged = await countGitInvocations(async () =>
            runSourceCli(["stage", decisionIds[0]!, "--root", workspaceRoot])
          );
          assert.equal(unchanged.result.exitCode, 0, unchanged.result.stderr);
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
          const changed = await countGitInvocations(async () =>
            runSourceCli(["stage", decisionIds[0]!, "--root", workspaceRoot])
          );
          assert.equal(changed.result.exitCode, 0, changed.result.stderr);
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
              `:docs/decisions/${decisionIds[0]!}`
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
            pendingIndex.entries[decisionIds[0]!].state.title,
            "修改后的规模化决策"
          );
        }
      );
    }
  }
);

test("stage rejects an existing pending decision index", () =>
  withGitFixtureWorkspace("stage-existing-pending", async (workspaceRoot) => {
    const selectedId = "use-existing-pending.md";
    await writeDecision(workspaceRoot, selectedId, candidateDecisionBody());
    const first = await runSourceCli([
      "stage",
      selectedId,
      "--root",
      workspaceRoot
    ]);
    assert.equal(first.exitCode, 0, first.stderr);
    const second = await runSourceCli([
      "stage",
      selectedId,
      "--root",
      workspaceRoot
    ]);
    assert.notEqual(second.exitCode, 0);
    assert.match(second.stderr, /pending snapshot already contains files/);
  }));

test("stage rejects an old domain revision before changing pending files", () =>
  withGitFixtureWorkspace("stage-old-revision", async (workspaceRoot) => {
    const decisionsRoot = path.join(workspaceRoot, "docs", "decisions");
    await fs.rm(decisionsRoot, { force: true, recursive: true });
    await fs.mkdir(`${decisionsRoot}/decision-records`, { recursive: true });
    await fs.writeFile(
      `${decisionsRoot}/decision-domains.json`,
      '{"schemaVersion":1,"domains":[]}',
      "utf8"
    );
    await fs.writeFile(
      `${decisionsRoot}/decision-records/${currentDecisionId}`,
      candidateDecisionBody(),
      "utf8"
    );
    commitWorkspace(workspaceRoot);

    await fs.rm(decisionsRoot, { force: true, recursive: true });
    await writeDecision(
      workspaceRoot,
      currentDecisionId,
      candidateDecisionBody()
    );
    const staged = await runSourceCli([
      "stage",
      currentDecisionId,
      "--root",
      workspaceRoot
    ]);
    assert.notEqual(staged.exitCode, 0);
    assert.equal(
      runGit(workspaceRoot, ["diff", "--cached", "--name-only"]),
      ""
    );
  }));

test("stage applies selected additions modifications deletions and explicit renames", () =>
  withGitFixtureWorkspace("stage-overlay", async (workspaceRoot) => {
    const modified = decisionFilePath(workspaceRoot, currentSourcePath);
    const deleted = decisionFilePath(workspaceRoot, archivedSourcePath);
    const addedId = "use-added-stage.md";
    await fs.writeFile(
      modified,
      (await fs.readFile(modified, "utf8"))
        .replace("使用生成 CLI", "使用修改 CLI")
        .replace(
          "relations:\n  - type: 修订\n    target: 260710-use-source-cli.md",
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
    const staged = await runSourceCli([
      "stage",
      currentDecisionId,
      archivedDecisionId,
      addedId,
      "--root",
      workspaceRoot
    ]);
    assert.equal(staged.exitCode, 0, staged.stderr);
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
    const id = "use-first-stage.md";
    await writeDecision(
      workspaceRoot,
      id,
      candidateDecisionBody()
        .replace("status: candidate", "status: active")
        .replace("alignment: null", "alignment: aligned")
        .replace("createdAt: null", "createdAt: 2026-08-15T00:00:00Z")
    );
    const staged = await runSourceCli(["stage", id, "--root", workspaceRoot]);
    assert.equal(staged.exitCode, 0, staged.stderr);
    const pending = runGit(workspaceRoot, ["diff", "--cached", "--name-only"]);
    assert.match(pending, new RegExp(id));
    assert.match(pending, /decision-index\.json/);
  }));

test("stage bootstraps a new Decision when revision contains only the derived index", () =>
  withTemporaryWorkspace("stage-index-only-baseline", async (workspaceRoot) => {
    initializeGitRepository(workspaceRoot);
    const decisionsDirectory = path.join(workspaceRoot, "docs", "decisions");
    await fs.mkdir(decisionsDirectory, { recursive: true });
    await fs.writeFile(
      path.join(decisionsDirectory, "decision-index.json"),
      "{}\n",
      "utf8"
    );
    commitWorkspace(workspaceRoot);

    const decisionId = "use-index-only-baseline.md";
    await writeDecision(
      workspaceRoot,
      decisionId,
      candidateDecisionBody({ title: "从仅索引基线建立决策" })
        .replace("status: candidate", "status: active")
        .replace("alignment: null", "alignment: aligned")
        .replace("createdAt: null", "createdAt: 2026-08-15T00:00:00Z")
    );
    const staged = await runSourceCli([
      "stage",
      decisionId,
      "--root",
      workspaceRoot
    ]);
    assert.equal(staged.exitCode, 0, staged.stderr);
    const pending = JSON.parse(
      runGit(workspaceRoot, ["show", ":docs/decisions/decision-index.json"])
    );
    assert.ok(pending.entries[decisionId]);
    assert.match(
      runGit(workspaceRoot, ["diff", "--cached", "--name-only"]),
      new RegExp(decisionId)
    );
  }));

test("stage rejects invalid duplicate and missing paths without changing the pending snapshot", () =>
  withGitFixtureWorkspace("stage-invalid-input", async (workspaceRoot) => {
    const sourcePath = decisionFilePath(workspaceRoot, currentSourcePath);
    const indexPath = path.join(
      workspaceRoot,
      "docs",
      "decisions",
      "decision-index.json"
    );
    const sourceBefore = await fs.readFile(sourcePath, "utf8");
    const indexBefore = await fs.readFile(indexPath, "utf8");
    for (const { ids, expectedError } of [
      {
        expectedError: /must not repeat a Decision ID/,
        ids: [currentDecisionId, currentDecisionId]
      },
      {
        expectedError:
          /Selected Decision ID does not exist in the revision or filesystem: use-missing-stage\.md/,
        ids: ["use-missing-stage.md"]
      },
      {
        expectedError:
          /Decision ID is invalid; must be a basename ending in \.md/,
        ids: ["../outside.md"]
      }
    ]) {
      const result = await runSourceCli([
        "stage",
        ...ids,
        "--root",
        workspaceRoot
      ]);
      assert.equal(result.exitCode, 2);
      assert.match(result.stderr, expectedError);
    }
    assert.equal(await fs.readFile(sourcePath, "utf8"), sourceBefore);
    assert.equal(await fs.readFile(indexPath, "utf8"), indexBefore);
    assert.equal(
      runGit(workspaceRoot, ["diff", "--cached", "--name-only"]),
      ""
    );
  }));

test("stage rejects invalid candidate relation targets before pending writes", () =>
  withGitFixtureWorkspace("stage-invalid-candidate", async (workspaceRoot) => {
    const invalid = "use-invalid-relation.md";
    await writeDecision(
      workspaceRoot,
      invalid,
      candidateDecisionBody({
        relations: [{ type: "修订", target: "use-missing-target.md" }]
      })
    );
    const result = await runSourceCli([
      "stage",
      invalid,
      "--root",
      workspaceRoot
    ]);
    assert.notEqual(result.exitCode, 0);
    assert.equal(
      runGit(workspaceRoot, ["diff", "--cached", "--name-only"]),
      ""
    );
  }));

test("stage reports unavailable version control without writing filesystem state", () =>
  withTemporaryWorkspace("stage-no-version-control", async (workspaceRoot) => {
    const id = "use-no-git.md";
    await writeDecision(
      workspaceRoot,
      id,
      candidateDecisionBody()
        .replace("status: candidate", "status: active")
        .replace("alignment: null", "alignment: aligned")
        .replace("createdAt: null", "createdAt: 2026-08-15T00:00:00Z")
    );
    const source = decisionFilePath(workspaceRoot, id);
    const before = await fs.readFile(source, "utf8");
    const result = await runSourceCli(["stage", id, "--root", workspaceRoot]);
    assert.notEqual(result.exitCode, 0);
    assert.match(result.stderr, /version-controlled decision workspace/);
    assert.equal(await fs.readFile(source, "utf8"), before);
  }));

test("help exposes stage independently without adding lifecycle stage options", () => {
  const program = createCliProgram(
    async () => 0,
    () => undefined
  );
  assert.match(program.helpInformation(), /stage <decision-id\.\.\.>/);
  for (const command of [
    "activate",
    "evolve",
    "archive",
    "mark-aligned",
    "discard"
  ]) {
    const entry = program.commands.find(
      (candidate) => candidate.name() === command
    );
    assert.ok(entry);
    assert.doesNotMatch(entry.helpInformation(), /--stage/);
  }
});

test("stage preserves concurrent pending bytes discovered by the replacement CAS", () =>
  withGitFixtureWorkspace("stage-pending-race", async (workspaceRoot) => {
    const concurrentId = "use-concurrent-pending.md";
    const concurrentBody = candidateDecisionBody({
      title: "并发 pending 决策"
    });
    const selectedPath = decisionFilePath(workspaceRoot, currentSourcePath);
    const descriptor = Object.getOwnPropertyDescriptor(fs, "readFile");
    assert.ok(descriptor);
    const readFile = fs.readFile.bind(fs);
    let injected = false;
    Object.defineProperty(fs, "readFile", {
      ...descriptor,
      value: async (
        filePath: string,
        encoding: BufferEncoding
      ): Promise<string> => {
        if (!injected && path.resolve(filePath) === selectedPath) {
          injected = true;
          await writeDecision(workspaceRoot, concurrentId, concurrentBody);
          runGit(workspaceRoot, ["add", `docs/decisions/${concurrentId}`]);
        }
        return await readFile(filePath, encoding);
      }
    });
    try {
      const staged = await runSourceCli([
        "stage",
        currentDecisionId,
        "--root",
        workspaceRoot
      ]);
      assert.notEqual(staged.exitCode, 0);
      assert.match(staged.stderr, /Pending snapshot replacement conflicted/);
    } finally {
      Object.defineProperty(fs, "readFile", descriptor);
    }
    assert.equal(injected, true);
    assert.equal(
      runGit(workspaceRoot, ["show", `:docs/decisions/${concurrentId}`]),
      concurrentBody
    );
  }));

test("stage rejects selected source drift before replacing the pending snapshot", async () => {
  for (const mutation of ["change", "delete", "move"] as const) {
    await withGitFixtureWorkspace(
      `stage-selected-drift-${mutation}`,
      async (workspaceRoot) => {
        const sourcePath = decisionFilePath(workspaceRoot, currentSourcePath);
        const descriptor = Object.getOwnPropertyDescriptor(fs, "readFile");
        assert.ok(descriptor);
        const readFile = fs.readFile.bind(fs);
        let reads = 0;
        let injected = false;
        Object.defineProperty(fs, "readFile", {
          ...descriptor,
          value: async (
            filePath: string,
            encoding: BufferEncoding
          ): Promise<string> => {
            if (path.resolve(filePath) === sourcePath && ++reads === 2) {
              injected = true;
              if (mutation === "change") {
                await fs.writeFile(
                  sourcePath,
                  (await readFile(sourcePath, "utf8")).replace(
                    "使用生成 CLI",
                    "并发改写 CLI"
                  ),
                  "utf8"
                );
              } else if (mutation === "delete") {
                await fs.rm(sourcePath);
              } else {
                await fs.rename(
                  sourcePath,
                  decisionFilePath(
                    workspaceRoot,
                    `archive/${currentDecisionId}`
                  )
                );
              }
            }
            return await readFile(filePath, encoding);
          }
        });
        try {
          const staged = await runSourceCli([
            "stage",
            currentDecisionId,
            "--root",
            workspaceRoot
          ]);
          assert.notEqual(staged.exitCode, 0, mutation);
          assert.match(
            staged.stderr,
            /changed before staging|changed after snapshot|failed to verify selected/i
          );
        } finally {
          Object.defineProperty(fs, "readFile", descriptor);
        }
        assert.equal(injected, true, mutation);
        assert.equal(
          runGit(workspaceRoot, ["diff", "--cached", "--name-only"]),
          ""
        );
      }
    );
  }
});

test("stage rejects a missing ID when bootstrapping without a revision", () =>
  withTemporaryWorkspace("stage-bootstrap-missing", async (workspaceRoot) => {
    initializeGitRepository(workspaceRoot);
    await fs.writeFile(
      path.join(workspaceRoot, "README.md"),
      "baseline\n",
      "utf8"
    );
    commitWorkspace(workspaceRoot);
    await fs.mkdir(path.join(workspaceRoot, "docs", "decisions"), {
      recursive: true
    });
    const staged = await runSourceCli([
      "stage",
      "use-missing-bootstrap.md",
      "--root",
      workspaceRoot
    ]);
    assert.notEqual(staged.exitCode, 0);
    assert.match(
      staged.stderr,
      /does not exist|must produce at least one established/i
    );
    assert.equal(
      runGit(workspaceRoot, ["diff", "--cached", "--name-only"]),
      ""
    );
  }));

test("stage isolates unselected invalid filesystem content from a selected revision ID", () =>
  withGitFixtureWorkspace("stage-unselected-invalid", async (workspaceRoot) => {
    const invalidName = "invalid_candidate.md";
    await writeDecision(workspaceRoot, invalidName, candidateDecisionBody());
    const selectedPath = decisionFilePath(workspaceRoot, currentSourcePath);
    await fs.writeFile(
      selectedPath,
      (await fs.readFile(selectedPath, "utf8")).replace(
        "使用生成 CLI",
        "选择的合法修改"
      ),
      "utf8"
    );
    const staged = await runSourceCli([
      "stage",
      currentDecisionId,
      "--root",
      workspaceRoot
    ]);
    assert.equal(staged.exitCode, 0, staged.stderr);
    const pendingPaths = runGit(workspaceRoot, [
      "diff",
      "--cached",
      "--name-only"
    ]);
    assert.match(pendingPaths, new RegExp(currentDecisionId));
    assert.doesNotMatch(pendingPaths, new RegExp(invalidName));
  }));

test("stage treats a selected old ID as a deletion without inferring a rename", () =>
  withGitFixtureWorkspace("stage-deletion", async (workspaceRoot) => {
    const replacementId = "use-unselected-replacement.md";
    await fs.rm(decisionFilePath(workspaceRoot, currentSourcePath));
    await writeDecision(
      workspaceRoot,
      replacementId,
      candidateDecisionBody({ title: "未选择的替代记录" })
        .replace("status: candidate", "status: active")
        .replace("alignment: null", "alignment: aligned")
        .replace("createdAt: null", "createdAt: 2026-08-15T00:00:00Z")
    );
    const staged = await runSourceCli([
      "stage",
      currentDecisionId,
      "--root",
      workspaceRoot
    ]);
    assert.equal(staged.exitCode, 0, staged.stderr);
    const pendingPaths = runGit(workspaceRoot, [
      "diff",
      "--cached",
      "--name-status",
      "--no-renames"
    ]);
    assert.match(
      pendingPaths,
      new RegExp(`D\\tdocs/decisions/${currentDecisionId}`)
    );
    assert.doesNotMatch(pendingPaths, new RegExp(replacementId));
  }));

test("stage rejects a selected symlink source outside the decision root without writing pending", async (t) => {
  await withGitFixtureWorkspace(
    "stage-selected-nonregular",
    async (workspaceRoot) => {
      const selectedPath = decisionFilePath(workspaceRoot, currentSourcePath);
      const outsidePath = path.join(workspaceRoot, "outside-decision.md");
      const outsideText = await fs.readFile(selectedPath, "utf8");
      await fs.writeFile(outsidePath, outsideText, "utf8");
      await fs.rm(selectedPath);
      try {
        await fs.symlink(outsidePath, selectedPath);
      } catch (error) {
        if (
          error instanceof Error &&
          "code" in error &&
          error.code === "EPERM"
        ) {
          t.skip("symlinks are unavailable on this platform");
          return;
        }
        throw error;
      }
      const staged = await runSourceCli([
        "stage",
        currentDecisionId,
        "--root",
        workspaceRoot
      ]);
      assert.equal(staged.exitCode, 1);
      assert.match(
        staged.stderr,
        new RegExp(
          "Decision source must be a regular non-symlink file: " +
            currentDecisionId
        )
      );
      assert.equal(await fs.readFile(outsidePath, "utf8"), outsideText);
      assert.equal((await fs.lstat(selectedPath)).isSymbolicLink(), true);
      assert.equal(
        runGit(workspaceRoot, ["diff", "--cached", "--name-only"]),
        ""
      );
    }
  );
});

async function createStageScaleFixture(
  workspaceRoot: string,
  decisionCount: number
): Promise<string[]> {
  const decisionIds: string[] = [];
  for (let index = 0; index < decisionCount; index += 1) {
    const decisionId = `use-scale-${String(index).padStart(3, "0")}.md`;
    decisionIds.push(decisionId);
    await writeDecision(
      workspaceRoot,
      decisionId,
      candidateDecisionBody({ title: `规模化决策 ${index}` })
        .replace("status: candidate", "status: active")
        .replace("alignment: null", "alignment: aligned")
        .replace("createdAt: null", "createdAt: 2026-08-15T00:00:00Z")
    );
  }
  return decisionIds;
}

async function countGitInvocations<T>(
  operation: () => Promise<T>
): Promise<{ callCount: number; result: T }> {
  const wrapperDirectory = await fs.mkdtemp(
    path.join(os.tmpdir(), "decision-stage-git-")
  );
  const wrapperPath = path.join(wrapperDirectory, "git");
  const countPath = path.join(wrapperDirectory, "calls.log");
  const gitExecutable = execFileSync("sh", ["-c", "command -v git"], {
    encoding: "utf8"
  }).trim();
  const previousPath = process.env.PATH;
  const previousCountPath = process.env.DECISION_STAGE_GIT_COUNT_PATH;
  const previousGitExecutable = process.env.DECISION_STAGE_REAL_GIT;
  await fs.writeFile(
    wrapperPath,
    "#!/bin/sh\n" +
      'printf "1\\n" >> "$DECISION_STAGE_GIT_COUNT_PATH" || exit 1\n' +
      'exec "$DECISION_STAGE_REAL_GIT" "$@"\n',
    "utf8"
  );
  await fs.chmod(wrapperPath, 0o755);
  process.env.DECISION_STAGE_GIT_COUNT_PATH = countPath;
  process.env.DECISION_STAGE_REAL_GIT = gitExecutable;
  process.env.PATH = `${wrapperDirectory}${path.delimiter}${previousPath ?? ""}`;
  try {
    const result = await operation();
    let calls = "";
    try {
      calls = await fs.readFile(countPath, "utf8");
    } catch (error) {
      if (
        !(error instanceof Error && "code" in error && error.code === "ENOENT")
      ) {
        throw error;
      }
    }
    return {
      callCount:
        calls.trim().length === 0 ? 0 : calls.trim().split("\n").length,
      result
    };
  } finally {
    if (previousPath === undefined) {
      delete process.env.PATH;
    } else {
      process.env.PATH = previousPath;
    }
    if (previousCountPath === undefined) {
      delete process.env.DECISION_STAGE_GIT_COUNT_PATH;
    } else {
      process.env.DECISION_STAGE_GIT_COUNT_PATH = previousCountPath;
    }
    if (previousGitExecutable === undefined) {
      delete process.env.DECISION_STAGE_REAL_GIT;
    } else {
      process.env.DECISION_STAGE_REAL_GIT = previousGitExecutable;
    }
    await fs.rm(wrapperDirectory, { force: true, recursive: true });
  }
}

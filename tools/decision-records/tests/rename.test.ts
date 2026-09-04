import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";
import {
  archivedDecisionId,
  candidateDecisionBody,
  currentDecisionId,
  decisionFilePath,
  readIndex,
  runSourceCli,
  withFixtureWorkspace,
  withGitFixtureWorkspace
} from "./support.ts";
import type { DecisionId } from "../src/types.ts";

const renamedCliId = "260711-renamed-cli" as DecisionId;

test("Decision rename keeps the established date, moves its source, and rebuilds the complete index", () =>
  withFixtureWorkspace("rename-established", async (workspaceRoot) => {
    const result = await runSourceCli([
      "rename",
      "use-generated-cli.md",
      "renamed-cli",
      "--root",
      workspaceRoot
    ]);
    assert.equal(result.exitCode, 0, result.stderr);
    assert.match(result.stdout, /old ID: use-generated-cli/u);
    assert.match(result.stdout, /new ID: 260711-renamed-cli/u);
    assert.equal(
      await fs
        .readFile(decisionFilePath(workspaceRoot, "renamed-cli.md"), "utf8")
        .then(() => true),
      true
    );
    await assert.rejects(
      fs.access(decisionFilePath(workspaceRoot, "use-generated-cli.md"))
    );
    const index = await readIndex(workspaceRoot);
    assert.ok(Object.hasOwn(index.entries, renamedCliId));
    assert.ok(!Object.hasOwn(index.entries, currentDecisionId));
    assert.equal(
      index.entries[renamedCliId]?.state.sourcePath,
      "renamed-cli.md"
    );
    assert.equal(
      (await runSourceCli(["check", "--root", workspaceRoot])).exitCode,
      0
    );
  }));

test("Decision rename rewrites candidate and established structured relation targets", () =>
  withFixtureWorkspace("rename-relations", async (workspaceRoot) => {
    const candidatePath = decisionFilePath(workspaceRoot, "dependent.md");
    await fs.writeFile(
      candidatePath,
      candidateDecisionBody({
        id: "260712-dependent",
        relations: [{ target: currentDecisionId, type: "修订" }]
      }),
      "utf8"
    );
    const result = await runSourceCli([
      "rename",
      currentDecisionId,
      "renamed-cli",
      "--root",
      workspaceRoot
    ]);
    assert.equal(result.exitCode, 0, result.stderr);
    const candidate = await fs.readFile(candidatePath, "utf8");
    assert.match(candidate, /target: 260711-renamed-cli/u);
    const index = await readIndex(workspaceRoot);
    assert.equal(
      index.entries[renamedCliId]?.state.relations[0]?.target,
      "260710-use-source-cli"
    );
    assert.equal(
      (await runSourceCli(["check", "--root", workspaceRoot])).exitCode,
      0
    );
  }));

test("Decision rename preflight is read-only and legacy candidates require an explicit dated target", () =>
  withFixtureWorkspace("rename-preflight", async (workspaceRoot) => {
    const originalPath = decisionFilePath(
      workspaceRoot,
      "use-generated-cli.md"
    );
    const before = await fs.readFile(originalPath, "utf8");
    const preflight = await runSourceCli([
      "rename",
      "use-generated-cli",
      "renamed-cli",
      "--preflight",
      "--root",
      workspaceRoot
    ]);
    assert.equal(preflight.exitCode, 0, preflight.stderr);
    assert.equal(await fs.readFile(originalPath, "utf8"), before);
    const dateConflict = await runSourceCli([
      "rename",
      "use-generated-cli",
      "260712-renamed-cli",
      "--preflight",
      "--root",
      workspaceRoot
    ]);
    assert.equal(dateConflict.exitCode, 1);
    assert.match(dateConflict.stderr, /rename-date-mismatch/u);
    assert.equal(await fs.readFile(originalPath, "utf8"), before);
    const legacyCandidatePath = decisionFilePath(
      workspaceRoot,
      "legacy-candidate.md"
    );
    await fs.writeFile(
      legacyCandidatePath,
      candidateDecisionBody({ id: "legacy-candidate" }),
      "utf8"
    );
    const invalid = await runSourceCli([
      "rename",
      "legacy-candidate",
      "migrated-candidate",
      "--root",
      workspaceRoot
    ]);
    assert.equal(invalid.exitCode, 1);
    assert.match(invalid.stderr, /rename-date-required/u);
    const explicit = await runSourceCli([
      "rename",
      "legacy-candidate",
      "260712-migrated-candidate",
      "--root",
      workspaceRoot
    ]);
    assert.equal(explicit.exitCode, 0, explicit.stderr);
  }));

test("Decision rename uses a dated source exactly, reports ambiguous names, and preserves archive placement", () =>
  withFixtureWorkspace("rename-dated-source", async (workspaceRoot) => {
    await fs.writeFile(
      decisionFilePath(workspaceRoot, "same-name.md"),
      candidateDecisionBody({ id: "260712-use-source-cli" }),
      "utf8"
    );
    const ambiguous = await runSourceCli([
      "rename",
      "use-source-cli",
      "renamed-source",
      "--preflight",
      "--root",
      workspaceRoot
    ]);
    assert.equal(ambiguous.exitCode, 1);
    assert.match(ambiguous.stderr, /rename-source-ambiguous/u);
    const renamed = await runSourceCli([
      "rename",
      archivedDecisionId,
      "renamed-source.md",
      "--root",
      workspaceRoot
    ]);
    assert.equal(renamed.exitCode, 0, renamed.stderr);
    await fs.access(
      decisionFilePath(workspaceRoot, "archive/renamed-source.md")
    );
    await assert.rejects(
      fs.access(
        decisionFilePath(workspaceRoot, "archive/260710-use-source-cli.md")
      )
    );
  }));

test("Decision rename falls back to its dated basename without overwriting an occupied name path", () =>
  withFixtureWorkspace("rename-path-fallback", async (workspaceRoot) => {
    const occupiedPath = decisionFilePath(workspaceRoot, "renamed-cli.md");
    await fs.writeFile(
      occupiedPath,
      candidateDecisionBody({ id: "260712-unrelated" }),
      "utf8"
    );
    const occupiedBefore = await fs.readFile(occupiedPath, "utf8");
    const result = await runSourceCli([
      "rename",
      currentDecisionId,
      "renamed-cli",
      "--root",
      workspaceRoot
    ]);
    assert.equal(result.exitCode, 0, result.stderr);
    await fs.access(decisionFilePath(workspaceRoot, "260711-renamed-cli.md"));
    assert.equal(await fs.readFile(occupiedPath, "utf8"), occupiedBefore);
    assert.match(
      await fs.readFile(occupiedPath, "utf8"),
      /id: 260712-unrelated/u
    );
  }));

test("Decision rename requires recorded-history confirmation without changing the source", () =>
  withGitFixtureWorkspace("rename-recorded", async (workspaceRoot) => {
    const sourcePath = decisionFilePath(workspaceRoot, "use-generated-cli.md");
    const before = await fs.readFile(sourcePath, "utf8");
    const paused = await runSourceCli([
      "rename",
      currentDecisionId,
      "renamed-cli",
      "--root",
      workspaceRoot
    ]);
    assert.equal(paused.exitCode, 1);
    assert.match(paused.stderr, /rename-recorded-decision/u);
    assert.equal(await fs.readFile(sourcePath, "utf8"), before);
    const confirmed = await runSourceCli([
      "rename",
      currentDecisionId,
      "renamed-cli",
      "--rename-recorded-decision",
      "--root",
      workspaceRoot
    ]);
    assert.equal(confirmed.exitCode, 0, confirmed.stderr);
  }));

test("Decision rename leaves an existing pending stage untouched by rejecting the rename", () =>
  withGitFixtureWorkspace("rename-pending-stage", async (workspaceRoot) => {
    const sourcePath = decisionFilePath(workspaceRoot, "use-generated-cli.md");
    await fs.writeFile(
      sourcePath,
      (await fs.readFile(sourcePath, "utf8")).replace(
        "确保生成后的 CLI 能在独立运行环境中读取并校验决策记录。",
        "验证 rename 不会覆盖既有 pending snapshot。"
      ),
      "utf8"
    );
    const synchronized = await runSourceCli([
      "sync-index",
      "--root",
      workspaceRoot
    ]);
    assert.equal(synchronized.exitCode, 0, synchronized.stderr);
    const staged = await runSourceCli([
      "stage",
      currentDecisionId,
      "--root",
      workspaceRoot
    ]);
    assert.equal(staged.exitCode, 0, staged.stderr);
    const before = await fs.readFile(sourcePath, "utf8");
    const rename = await runSourceCli([
      "rename",
      currentDecisionId,
      "renamed-cli",
      "--rename-recorded-decision",
      "--root",
      workspaceRoot
    ]);
    assert.equal(rename.exitCode, 1);
    assert.match(rename.stderr, /rename-pending-stage-conflict/u);
    assert.equal(await fs.readFile(sourcePath, "utf8"), before);
  }));

test("Decision rename reports committed cleanup when its lock release fails after publication", () =>
  withFixtureWorkspace("rename-lock-release", async (workspaceRoot) => {
    const descriptor = Object.getOwnPropertyDescriptor(fs, "rm");
    assert.ok(descriptor);
    const remove = fs.rm.bind(fs);
    let releaseBlocked = false;
    Object.defineProperty(fs, "rm", {
      ...descriptor,
      value: async (...args: Parameters<typeof fs.rm>) => {
        if (
          String(args[0]).endsWith(".decision-index.json.mutation.lock") &&
          !releaseBlocked
        ) {
          releaseBlocked = true;
          throw Object.assign(new Error("simulated lock release failure"), {
            code: "EACCES"
          });
        }
        return await remove(...args);
      }
    });
    let renamed: Awaited<ReturnType<typeof runSourceCli>>;
    try {
      renamed = await runSourceCli([
        "rename",
        currentDecisionId,
        "renamed-cli",
        "--root",
        workspaceRoot
      ]);
    } finally {
      Object.defineProperty(fs, "rm", descriptor);
    }
    assert.equal(releaseBlocked, true);
    assert.equal(renamed!.exitCode, 1);
    assert.match(renamed!.stderr, /outcome: committed-cleanup-pending/u);
    assert.match(
      renamed!.stderr,
      /code: decision-records\.collection-lock-release-failed/u
    );
    await fs.access(decisionFilePath(workspaceRoot, "renamed-cli.md"));
    const index = await readIndex(workspaceRoot);
    assert.ok(Object.hasOwn(index.entries, renamedCliId));
    await fs.rm(
      decisionFilePath(workspaceRoot, "../.decision-index.json.mutation.lock"),
      { force: true }
    );
  }));

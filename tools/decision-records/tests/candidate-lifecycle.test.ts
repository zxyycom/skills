import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { validateDecisionRecords } from "../src/index.ts";
import {
  archivedSourcePath,
  candidateDecisionBody,
  commitWorkspace,
  currentRelativePath,
  decisionFilePath,
  fileExists,
  findIndexEntry,
  initializeGitRepository,
  readIndex,
  runSourceCli,
  runSuccessfulSourceCli,
  withFixtureWorkspace,
  withTemporaryWorkspace,
  writeDecision,
  writeIndex,
} from "./support.ts";

const unindexedBody = [
  "---",
  "title: 验证未登记成员",
  "status: candidate",
  "alignment: null",
  "createdAt: null",
  "purpose: 验证多条预写候选可以按显式目标逐条激活。",
  "background: 其他完整候选需要明确提醒，但不应阻断当前目标。",
  "decision: 单次只激活目标，索引排除其他候选并允许等待审核。",
  "tags:",
  "  - decision-records",
  "relations: []",
  "---",
  "",
  "## 目的",
  "- 验证多条预写候选可以按显式目标逐条激活。",
  "",
  "## 背景",
  "- 其他完整候选需要明确提醒，但不应阻断当前目标。",
  "",
  "## 决策",
  "- 采用: 单次只激活目标，索引排除其他候选并允许等待审核。",
  "",
].join("\n");

test("discard rejects established decisions without mutation", () =>
  withFixtureWorkspace(
    "candidate-discard-established",
    async (workspaceRoot) => {
      const decisionsDirectory = path.join(workspaceRoot, "docs", "decisions");
      const indexPath = path.join(decisionsDirectory, "decision-index.json");
      const originalIndexText = await fs.readFile(indexPath, "utf8");
      const establishedPath = decisionFilePath(
        workspaceRoot,
        currentRelativePath,
      );
      const establishedText = await fs.readFile(establishedPath, "utf8");

      const discarded = await runSourceCli([
        "discard",
        currentRelativePath,
        "--root",
        workspaceRoot,
      ]);
      assert.equal(discarded.exitCode, 1);
      assert.match(discarded.stderr, /Cannot discard established decision/);
      assert.equal(await fs.readFile(establishedPath, "utf8"), establishedText);
      assert.equal(await fs.readFile(indexPath, "utf8"), originalIndexText);

      const spoofedCandidateText = establishedText
        .replace("status: active", "status: candidate")
        .replace("alignment: aligned", "alignment: null")
        .replace("createdAt: 2026-07-11T14:15:16+08:00", "createdAt: null");
      await fs.writeFile(establishedPath, spoofedCandidateText, "utf8");
      assert.ok(
        (await validateDecisionRecords({ workspaceRoot })).errors.some(
          (error) =>
            error.includes(
              "candidate status is allowed only for a complete, unindexed",
            ),
        ),
      );
      assert.equal(await fs.readFile(indexPath, "utf8"), originalIndexText);
      await fs.writeFile(establishedPath, establishedText, "utf8");
    },
  ));

test("discard rejects invalid candidate lifecycle or body without mutation", () =>
  withFixtureWorkspace(
    "candidate-discard-invalid-body",
    async (workspaceRoot) => {
      const decisionsDirectory = path.join(workspaceRoot, "docs", "decisions");
      const indexPath = path.join(decisionsDirectory, "decision-index.json");
      const originalIndexText = await fs.readFile(indexPath, "utf8");
      const invalidLifecycleRelativePath = "use-invalid-candidate-lifecycle.md";
      const invalidLifecyclePath = decisionFilePath(
        workspaceRoot,
        invalidLifecycleRelativePath,
      );

      for (const invalidLifecycleBody of [
        candidateDecisionBody().replace(
          "alignment: null",
          "alignment: aligned",
        ),
        candidateDecisionBody().replace(
          "createdAt: null",
          "createdAt: 2026-08-06T10:20:30Z",
        ),
      ]) {
        await fs.writeFile(invalidLifecyclePath, invalidLifecycleBody, "utf8");
        await assertRejectedDiscardPreserves({
          decisionPath: invalidLifecyclePath,
          expectedError:
            /Discard requires a complete reviewable decision candidate/,
          indexPath,
          relativePath: invalidLifecycleRelativePath,
          workspaceRoot,
        });
      }
      await fs.rm(invalidLifecyclePath);

      const invalidRelativePath = "use-invalid-candidate.md";
      const invalidPath = decisionFilePath(workspaceRoot, invalidRelativePath);
      const invalidBody = candidateDecisionBody().replace(
        "\n## 目的\n- 验证 Markdown 生命周期独立定义候选和已建立状态。\n",
        "\n",
      );
      await fs.writeFile(invalidPath, invalidBody, "utf8");
      await assertRejectedDiscardPreserves({
        decisionPath: invalidPath,
        expectedError: /Discard requires a complete reviewable/,
        indexPath,
        relativePath: invalidRelativePath,
        workspaceRoot,
      });
      assert.equal(await fs.readFile(indexPath, "utf8"), originalIndexText);
    },
  ));

test("discard rejects candidates with invalid relation targets without mutation", () =>
  withFixtureWorkspace(
    "candidate-discard-invalid-relation",
    async (workspaceRoot) => {
      const indexPath = path.join(
        workspaceRoot,
        "docs",
        "decisions",
        "decision-index.json",
      );
      const invalidTargetRelativePath =
        "use-invalid-existing-discard-target.md";
      const invalidTargetPath = decisionFilePath(
        workspaceRoot,
        invalidTargetRelativePath,
      );
      const invalidTargetText = candidateDecisionBody().replace(
        "\n## 目的\n- 验证 Markdown 生命周期独立定义候选和已建立状态。\n",
        "\n",
      );
      await fs.writeFile(invalidTargetPath, invalidTargetText, "utf8");

      const sourceRelativePath = "use-invalid-target-discard-source.md";
      const sourcePath = decisionFilePath(workspaceRoot, sourceRelativePath);
      await fs.writeFile(
        sourcePath,
        candidateDecisionBody({
          relations: [{ type: "修订", target: invalidTargetRelativePath }],
        }),
        "utf8",
      );

      await assertRejectedDiscardPreserves({
        decisionPath: sourcePath,
        expectedError: /target is not a valid scanned decision/,
        indexPath,
        relativePath: sourceRelativePath,
        workspaceRoot,
      });
      assert.equal(
        await fs.readFile(invalidTargetPath, "utf8"),
        invalidTargetText,
      );
    },
  ));

test("discard rejects a candidate that is still referenced without mutation", () =>
  withFixtureWorkspace(
    "candidate-discard-referenced",
    async (workspaceRoot) => {
      const indexPath = path.join(
        workspaceRoot,
        "docs",
        "decisions",
        "decision-index.json",
      );
      const targetRelativePath = "use-discard-candidate-target.md";
      const targetPath = decisionFilePath(workspaceRoot, targetRelativePath);
      const targetText = candidateDecisionBody();
      await fs.writeFile(targetPath, targetText, "utf8");

      const sourceRelativePath = "use-candidate-target-discard-source.md";
      const sourcePath = decisionFilePath(workspaceRoot, sourceRelativePath);
      const sourceText = candidateDecisionBody({
        relations: [{ type: "修订", target: targetRelativePath }],
      });
      await fs.writeFile(sourcePath, sourceText, "utf8");

      await assertRejectedDiscardPreserves({
        decisionPath: targetPath,
        expectedError: /still referenced/,
        indexPath,
        relativePath: targetRelativePath,
        workspaceRoot,
      });
      assert.equal(await fs.readFile(targetPath, "utf8"), targetText);
      assert.equal(await fs.readFile(sourcePath, "utf8"), sourceText);
    },
  ));

test("discard accepts a candidate with a valid active-target relation", () =>
  withFixtureWorkspace(
    "candidate-discard-active-target",
    async (workspaceRoot) => {
      const indexPath = path.join(
        workspaceRoot,
        "docs",
        "decisions",
        "decision-index.json",
      );
      const originalIndexText = await fs.readFile(indexPath, "utf8");
      const sourceRelativePath = "use-active-target-discard-source.md";
      const sourcePath = decisionFilePath(workspaceRoot, sourceRelativePath);
      await fs.writeFile(
        sourcePath,
        candidateDecisionBody({
          relations: [{ type: "修订", target: currentRelativePath }],
        }),
        "utf8",
      );

      const discarded = await runSourceCli([
        "discard",
        sourceRelativePath,
        "--root",
        workspaceRoot,
      ]);
      assert.equal(discarded.exitCode, 0, discarded.stderr);
      assert.equal(await fileExists(sourcePath), false);
      assert.equal(await fs.readFile(indexPath, "utf8"), originalIndexText);
    },
  ));

test("discard removes only the selected candidate and preserves siblings", () =>
  withFixtureWorkspace("candidate-discard-selection", async (workspaceRoot) => {
    const decisionsDirectory = path.join(workspaceRoot, "docs", "decisions");
    const indexPath = path.join(decisionsDirectory, "decision-index.json");
    const originalIndexText = await fs.readFile(indexPath, "utf8");
    const otherCandidateRelativePath = "use-other-valid-candidate.md";
    const otherCandidatePath = decisionFilePath(
      workspaceRoot,
      otherCandidateRelativePath,
    );
    const otherCandidateText = candidateDecisionBody();
    await fs.writeFile(otherCandidatePath, otherCandidateText, "utf8");
    const discardedRelativePath = "use-discarded-candidate.md";
    const discardedPath = decisionFilePath(
      workspaceRoot,
      discardedRelativePath,
    );
    await fs.writeFile(discardedPath, candidateDecisionBody(), "utf8");
    initializeGitRepository(workspaceRoot);
    commitWorkspace(workspaceRoot, "record reviewable candidates");
    const candidateCheck = await runSourceCli([
      "check",
      "--root",
      workspaceRoot,
    ]);
    assert.equal(candidateCheck.exitCode, 0, candidateCheck.stderr);
    assert.equal(candidateCheck.stderr, "");
    assert.match(candidateCheck.stdout, /2 candidates/);
    const discarded = await runSourceCli([
      "discard",
      discardedRelativePath,
      "--root",
      workspaceRoot,
    ]);
    assert.equal(discarded.exitCode, 0, discarded.stderr);
    assert.match(discarded.stdout, /Discarded decision candidate/);
    assert.match(discarded.stderr, /use-other-valid-candidate\.md/);
    assert.equal(await fileExists(discardedPath), false);
    assert.equal(
      await fs.readFile(otherCandidatePath, "utf8"),
      otherCandidateText,
    );
    assert.equal(await fs.readFile(indexPath, "utf8"), originalIndexText);
    await fs.rm(otherCandidatePath);
  }));

test("candidate queries discover source records while activation indexes only reviewed targets", () =>
  withFixtureWorkspace(
    "candidate-activation-selection",
    async (workspaceRoot) => {
      const decisionsDirectory = path.join(workspaceRoot, "docs", "decisions");
      const indexPath = path.join(decisionsDirectory, "decision-index.json");
      const originalIndexText = await fs.readFile(indexPath, "utf8");
      const firstUnindexedRelativePath = "use-first-unindexed.md";
      const secondUnindexedRelativePath = "use-second-unindexed.md";
      const firstUnindexedPath = decisionFilePath(
        workspaceRoot,
        firstUnindexedRelativePath,
      );
      const secondUnindexedPath = decisionFilePath(
        workspaceRoot,
        secondUnindexedRelativePath,
      );
      await fs.writeFile(firstUnindexedPath, unindexedBody, "utf8");
      await fs.writeFile(secondUnindexedPath, unindexedBody, "utf8");
      const invalidRelativePath = "use-invalid-source-candidate.md";
      const invalidPath = decisionFilePath(workspaceRoot, invalidRelativePath);
      await fs.writeFile(
        invalidPath,
        candidateDecisionBody().replace("\n## 决策\n", "\n## 非法章节\n"),
        "utf8",
      );
      const discoveredCandidates = await runSourceCli([
        "candidates",
        "--root",
        workspaceRoot,
      ]);
      assert.equal(
        discoveredCandidates.exitCode,
        0,
        discoveredCandidates.stderr,
      );
      assert.match(
        discoveredCandidates.stderr,
        /query completed with warnings/i,
      );
      assert.match(
        discoveredCandidates.stderr,
        /use-invalid-source-candidate\.md/,
      );
      assert.match(discoveredCandidates.stdout, /Candidates:/);
      assert.match(discoveredCandidates.stdout, /use-first-unindexed\.md/);
      assert.match(discoveredCandidates.stdout, /use-second-unindexed\.md/);
      assert.doesNotMatch(
        discoveredCandidates.stdout,
        /use-invalid-source-candidate\.md/,
      );
      const shownCandidate = await runSourceCli([
        "show-candidate",
        secondUnindexedRelativePath,
        "--root",
        workspaceRoot,
      ]);
      assert.equal(shownCandidate.exitCode, 0, shownCandidate.stderr);
      assert.match(shownCandidate.stderr, /use-invalid-source-candidate\.md/);
      assert.match(shownCandidate.stdout, /^status: candidate$/m);
      assert.match(shownCandidate.stdout, /^alignment: null$/m);
      assert.match(shownCandidate.stdout, /^createdAt: null$/m);
      const invalidCandidate = await runSourceCli([
        "show-candidate",
        invalidRelativePath,
        "--root",
        workspaceRoot,
      ]);
      assert.equal(invalidCandidate.exitCode, 1);
      assert.match(
        invalidCandidate.stderr,
        /not a valid reviewable candidate.*use-invalid-source-candidate\.md/i,
      );
      assert.match(
        invalidCandidate.stderr,
        /has unsupported section ## 非法章节/,
      );
      await fs.rm(invalidPath);
      const candidateCheckBeforeActivation = await runSourceCli([
        "check",
        "--root",
        workspaceRoot,
      ]);
      assert.equal(
        candidateCheckBeforeActivation.exitCode,
        0,
        candidateCheckBeforeActivation.stderr,
      );
      assert.match(candidateCheckBeforeActivation.stdout, /2 candidates/);
      const multipleUnindexedActivation = await runSourceCli([
        "activate",
        firstUnindexedRelativePath,
        "--alignment",
        "aligned",
        "--root",
        workspaceRoot,
      ]);
      assert.equal(multipleUnindexedActivation.exitCode, 0);
      assert.match(
        multipleUnindexedActivation.stdout,
        /Activated new decision as aligned use-first-unindexed\.md\./,
      );
      assert.match(
        multipleUnindexedActivation.stderr,
        /Reviewable decision candidate remains: use-second-unindexed\.md/,
      );
      assert.doesNotMatch(
        multipleUnindexedActivation.stderr,
        /Reviewable decision candidate remains: use-first-unindexed\.md/,
      );
      const firstActivationIndex = await readIndex(indexPath);
      findIndexEntry(firstActivationIndex, firstUnindexedRelativePath);
      assert.equal(
        Object.hasOwn(
          firstActivationIndex.entries,
          secondUnindexedRelativePath,
        ),
        false,
      );

      const remainingCandidateCheck = await runSourceCli([
        "check",
        "--root",
        workspaceRoot,
      ]);
      assert.equal(remainingCandidateCheck.exitCode, 0);
      assert.equal(remainingCandidateCheck.stderr, "");
      assert.match(remainingCandidateCheck.stdout, /1 candidates/);
      const candidateValidation = await validateDecisionRecords({
        workspaceRoot,
      });
      assert.equal(candidateValidation.activationCandidateCount, 1);

      const candidateList = await runSourceCli([
        "list",
        "--root",
        workspaceRoot,
      ]);
      assert.equal(candidateList.exitCode, 0);
      assert.equal(candidateList.stderr, "");
      assert.match(candidateList.stdout, /use-first-unindexed\.md/);
      assert.doesNotMatch(candidateList.stdout, /use-second-unindexed\.md/);

      const candidateSync = await runSourceCli([
        "sync-index",
        "--write",
        "--root",
        workspaceRoot,
      ]);
      assert.equal(candidateSync.exitCode, 0);
      assert.match(candidateSync.stdout, /Decision index is up to date/);
      assert.match(candidateSync.stderr, /use-second-unindexed\.md/);

      const secondActivation = await runSuccessfulSourceCli([
        "activate",
        secondUnindexedRelativePath,
        "--alignment",
        "aligned",
        "--root",
        workspaceRoot,
      ]);
      assert.match(secondActivation, /Activated new decision as aligned/);
      const completeCandidateIndex = await readIndex(indexPath);
      findIndexEntry(completeCandidateIndex, firstUnindexedRelativePath);
      findIndexEntry(completeCandidateIndex, secondUnindexedRelativePath);
      await runSuccessfulSourceCli(["check", "--root", workspaceRoot]);
      await fs.rm(firstUnindexedPath);
      await fs.rm(secondUnindexedPath);
      await fs.writeFile(indexPath, originalIndexText, "utf8");
    },
  ));

test("activation reconciles unindexed established records before committing a candidate", () =>
  withFixtureWorkspace("candidate-activation-index", async (workspaceRoot) => {
    const decisionsDirectory = path.join(workspaceRoot, "docs", "decisions");
    const indexPath = path.join(decisionsDirectory, "decision-index.json");
    const targetCandidateRelativePath = "use-target-candidate.md";
    const orphanRelativePath = "use-orphan-established.md";
    const targetCandidatePath = decisionFilePath(
      workspaceRoot,
      targetCandidateRelativePath,
    );
    const orphanPath = decisionFilePath(workspaceRoot, orphanRelativePath);
    await fs.writeFile(targetCandidatePath, unindexedBody, "utf8");
    await fs.writeFile(
      orphanPath,
      unindexedBody
        .replace("status: candidate", "status: active")
        .replace("alignment: null", "alignment: aligned")
        .replace("createdAt: null", "createdAt: 2026-07-22T10:20:30+08:00"),
      "utf8",
    );
    for (const staleQueryArgs of [
      ["list", "--root", workspaceRoot],
      ["show", currentRelativePath, "--root", workspaceRoot],
      ["trace", currentRelativePath, "--root", workspaceRoot],
    ]) {
      const staleQueryWithOrphan = await runSourceCli(staleQueryArgs);
      assert.equal(
        staleQueryWithOrphan.exitCode,
        0,
        staleQueryWithOrphan.stderr,
      );
      assert.doesNotMatch(
        staleQueryWithOrphan.stdout,
        /use-orphan-established\.md/,
      );
    }

    const syncWithOrphan = await runSourceCli([
      "sync-index",
      "--write",
      "--root",
      workspaceRoot,
    ]);
    assert.equal(syncWithOrphan.exitCode, 0);
    assert.match(syncWithOrphan.stderr, /use-target-candidate\.md/);
    findIndexEntry(await readIndex(indexPath), orphanRelativePath);

    const activationWithOrphan = await runSourceCli([
      "activate",
      targetCandidateRelativePath,
      "--alignment",
      "aligned",
      "--root",
      workspaceRoot,
    ]);
    assert.equal(activationWithOrphan.exitCode, 0);
    assert.match(
      await fs.readFile(targetCandidatePath, "utf8"),
      /createdAt: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z/,
    );
    const indexWithEstablishedAdditions = await readIndex(indexPath);
    findIndexEntry(indexWithEstablishedAdditions, targetCandidateRelativePath);
    findIndexEntry(indexWithEstablishedAdditions, orphanRelativePath);
  }));

test("discarding the only candidate leaves no established decision index", () =>
  withTemporaryWorkspace("only-candidate", async (workspaceRoot) => {
    const decisionsDirectory = path.join(workspaceRoot, "docs", "decisions");
    const relativePath = "use-only-candidate.md";
    const decisionPath = decisionFilePath(workspaceRoot, relativePath);
    await fs.mkdir(path.dirname(decisionPath), { recursive: true });
    await fs.writeFile(decisionPath, candidateDecisionBody(), "utf8");
    const discarded = await runSourceCli([
      "discard",
      relativePath,
      "--root",
      workspaceRoot,
    ]);
    assert.equal(discarded.exitCode, 0, discarded.stderr);
    assert.equal(await fileExists(decisionPath), false);
    assert.equal(
      await fileExists(path.join(decisionsDirectory, "decision-index.json")),
      false,
    );
    assert.equal(
      await fileExists(path.join(decisionsDirectory, "decision-index.json")),
      false,
    );
  }));

async function assertRejectedDiscardPreserves(options: {
  decisionPath: string;
  expectedError: RegExp;
  indexPath: string;
  relativePath: string;
  workspaceRoot: string;
}): Promise<void> {
  const decisionText = await fs.readFile(options.decisionPath, "utf8");
  const indexText = await fs.readFile(options.indexPath, "utf8");
  const result = await runSourceCli([
    "discard",
    options.relativePath,
    "--root",
    options.workspaceRoot,
  ]);
  assert.equal(result.exitCode, 1);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, options.expectedError);
  assert.equal(await fs.readFile(options.decisionPath, "utf8"), decisionText);
  assert.equal(await fs.readFile(options.indexPath, "utf8"), indexText);
}

test("candidate collection requires a current valid index when established records exist", async () => {
  for (const indexState of ["missing", "invalid", "stale"] as const) {
    await withFixtureWorkspace(
      `candidate-index-${indexState}`,
      async (workspaceRoot) => {
        const indexPath = path.join(
          workspaceRoot,
          "docs",
          "decisions",
          "decision-index.json",
        );
        if (indexState === "missing") {
          await fs.rm(indexPath);
        } else if (indexState === "invalid") {
          await fs.writeFile(indexPath, "not JSON\n", "utf8");
        } else {
          const sourcePath = decisionFilePath(
            workspaceRoot,
            currentRelativePath,
          );
          await fs.writeFile(
            sourcePath,
            (await fs.readFile(sourcePath, "utf8")).replace(
              "使用生成 CLI",
              "过期索引来源",
            ),
            "utf8",
          );
        }
        const candidates = await runSourceCli([
          "candidates",
          "--root",
          workspaceRoot,
        ]);
        assert.notEqual(candidates.exitCode, 0, indexState);
        assert.equal(candidates.stdout, "", indexState);
      },
    );
  }
});

test("first candidate discovery succeeds with no established records and no index", () =>
  withTemporaryWorkspace("candidate-first-discovery", async (workspaceRoot) => {
    const candidateId = "use-first-candidate.md";
    await writeDecision(workspaceRoot, candidateId, candidateDecisionBody());
    const candidates = await runSourceCli([
      "candidates",
      "--root",
      workspaceRoot,
    ]);
    assert.equal(candidates.exitCode, 0, candidates.stderr);
    assert.match(candidates.stdout, new RegExp(candidateId));
  }));

test("candidate collection rejects an empty index when only candidates remain", () =>
  withFixtureWorkspace("candidate-empty-index", async (workspaceRoot) => {
    const decisionsDirectory = path.join(workspaceRoot, "docs", "decisions");
    const candidateId = "use-only-candidate.md";
    await fs.rm(decisionFilePath(workspaceRoot, currentRelativePath));
    await fs.rm(decisionFilePath(workspaceRoot, archivedSourcePath));
    await writeDecision(workspaceRoot, candidateId, candidateDecisionBody());
    const indexPath = path.join(decisionsDirectory, "decision-index.json");
    const emptyIndex = await readIndex(workspaceRoot);
    emptyIndex.entries = {};
    emptyIndex.sourceRevision.entries = {};
    await writeIndex(indexPath, emptyIndex);

    for (const args of [["candidates"], ["show-candidate", candidateId]]) {
      const result = await runSourceCli([...args, "--root", workspaceRoot]);
      assert.notEqual(result.exitCode, 0, args.join(" "));
      assert.equal(result.stdout, "", args.join(" "));
      assert.match(result.stderr, /decision-index|index/i, args.join(" "));
    }
  }));

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { validateDecisionRecords } from "../src/index.ts";
import {
  candidateDecisionBody,
  commitWorkspace,
  currentRelativePath,
  decisionFilePath,
  fileExists,
  findIndexEntry,
  initializeGitRepository,
  readIndex,
  runBundledCli,
  runSourceCli,
  runSuccessfulCli,
  withFixtureWorkspace,
  withTemporaryWorkspace,
  writeTestDomainCatalog
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
  ""
].join("\n");

test("discard rejects established, incomplete, invalid, or referenced candidates without mutation", () => (
  withFixtureWorkspace("candidate-lifecycle", async (workspaceRoot) => {
  const decisionsDirectory = path.join(workspaceRoot, "docs", "decisions");
  const indexPath = path.join(decisionsDirectory, "decision-index.json");
  const originalIndexText = await fs.readFile(indexPath, "utf8");
  const establishedPath = decisionFilePath(workspaceRoot, currentRelativePath);
  const establishedText = await fs.readFile(establishedPath, "utf8");

  const establishedDiscard = await runSourceCli([
    "discard",
    currentRelativePath,
    "--root",
    workspaceRoot
  ]);
  assert.equal(establishedDiscard.exitCode, 1);
  assert.match(establishedDiscard.stderr, /Cannot discard established decision/);
  assert.equal(await fs.readFile(establishedPath, "utf8"), establishedText);
  assert.equal(await fs.readFile(indexPath, "utf8"), originalIndexText);

  await fs.writeFile(
    establishedPath,
    establishedText
      .replace("status: active", "status: candidate")
      .replace("alignment: aligned", "alignment: null")
      .replace(
        "createdAt: 2026-07-11T14:15:16+08:00",
        "createdAt: null"
      ),
    "utf8"
  );
  assert.ok((await validateDecisionRecords({ workspaceRoot })).errors.some(
    (error) => error.includes(
      "candidate status is allowed only for a complete, unindexed"
    )
  ));
  await fs.writeFile(establishedPath, establishedText, "utf8");

  const invalidLifecycleRelativePath =
    "decision-records/use-invalid-candidate-lifecycle.md";
  const invalidLifecyclePath = decisionFilePath(
    workspaceRoot,
    invalidLifecycleRelativePath
  );
  for (const invalidLifecycleBody of [
    candidateDecisionBody().replace("alignment: null", "alignment: aligned"),
    candidateDecisionBody().replace(
      "createdAt: null",
      "createdAt: 2026-08-06T10:20:30Z"
    )
  ]) {
    await fs.writeFile(invalidLifecyclePath, invalidLifecycleBody, "utf8");
    const invalidLifecycleDiscard = await runSourceCli([
      "discard",
      invalidLifecycleRelativePath,
      "--root",
      workspaceRoot
    ]);
    assert.equal(invalidLifecycleDiscard.exitCode, 1);
    assert.match(
      invalidLifecycleDiscard.stderr,
      /Discard requires a complete reviewable decision candidate/
    );
    assert.equal(
      await fs.readFile(invalidLifecyclePath, "utf8"),
      invalidLifecycleBody
    );
    assert.equal(await fs.readFile(indexPath, "utf8"), originalIndexText);
  }
  await fs.rm(invalidLifecyclePath);

  const invalidRelativePath = "decision-records/use-invalid-candidate.md";
  const invalidPath = decisionFilePath(workspaceRoot, invalidRelativePath);
  await fs.mkdir(path.dirname(invalidPath), { recursive: true });
  await fs.writeFile(
    invalidPath,
    candidateDecisionBody().replace(
      "\n## 目的\n- 验证 Markdown 生命周期独立定义候选和已建立状态。\n",
      "\n"
    ),
    "utf8"
  );
  const invalidDiscard = await runSourceCli([
    "discard",
    invalidRelativePath,
    "--root",
    workspaceRoot
  ]);
  assert.equal(invalidDiscard.exitCode, 1);
  assert.match(invalidDiscard.stderr, /Discard requires a complete reviewable/);
  assert.equal(await fileExists(invalidPath), true);
  assert.equal(await fs.readFile(indexPath, "utf8"), originalIndexText);
  await fs.rm(invalidPath);

  const activeTargetSourceRelativePath =
    "decision-records/use-active-target-discard-source.md";
  const activeTargetSourcePath = decisionFilePath(
    workspaceRoot,
    activeTargetSourceRelativePath
  );
  await fs.writeFile(
    activeTargetSourcePath,
    candidateDecisionBody({
      relationTarget: currentRelativePath
    }),
    "utf8"
  );
  const discardedActiveTargetSource = await runSourceCli([
    "discard",
    activeTargetSourceRelativePath,
    "--root",
    workspaceRoot
  ]);
  assert.equal(
    discardedActiveTargetSource.exitCode,
    0,
    discardedActiveTargetSource.stderr
  );
  assert.equal(await fileExists(activeTargetSourcePath), false);
  assert.equal(await fs.readFile(indexPath, "utf8"), originalIndexText);

  const discardCandidateTargetRelativePath =
    "decision-records/use-discard-candidate-target.md";
  const discardCandidateTargetPath = decisionFilePath(
    workspaceRoot,
    discardCandidateTargetRelativePath
  );
  const discardCandidateTargetText = candidateDecisionBody();
  await fs.writeFile(
    discardCandidateTargetPath,
    discardCandidateTargetText,
    "utf8"
  );
  const candidateTargetSourceRelativePath =
    "decision-records/use-candidate-target-discard-source.md";
  const candidateTargetSourcePath = decisionFilePath(
    workspaceRoot,
    candidateTargetSourceRelativePath
  );
  await fs.writeFile(
    candidateTargetSourcePath,
    candidateDecisionBody({
      relationTarget: discardCandidateTargetRelativePath
    }),
    "utf8"
  );
  await assertRejectedDiscardPreserves({
    decisionPath: discardCandidateTargetPath,
    expectedError: /still referenced/,
    indexPath,
    relativePath: discardCandidateTargetRelativePath,
    workspaceRoot
  });
  assert.equal(
    await fs.readFile(discardCandidateTargetPath, "utf8"),
    discardCandidateTargetText
  );
  const discardedCandidateTargetSource = await runSourceCli([
    "discard",
    candidateTargetSourceRelativePath,
    "--root",
    workspaceRoot
  ]);
  assert.equal(
    discardedCandidateTargetSource.exitCode,
    0,
    discardedCandidateTargetSource.stderr
  );
  await fs.rm(discardCandidateTargetPath);

  const invalidTargetRelativePath =
    "decision-records/use-invalid-existing-discard-target.md";
  const invalidTargetPath = decisionFilePath(
    workspaceRoot,
    invalidTargetRelativePath
  );
  const invalidTargetText = candidateDecisionBody().replace(
    "\n## 目的\n- 验证 Markdown 生命周期独立定义候选和已建立状态。\n",
    "\n"
  );
  await fs.writeFile(invalidTargetPath, invalidTargetText, "utf8");
  const invalidTargetSourceRelativePath =
    "decision-records/use-invalid-target-discard-source.md";
  const invalidTargetSourcePath = decisionFilePath(
    workspaceRoot,
    invalidTargetSourceRelativePath
  );
  await fs.writeFile(
    invalidTargetSourcePath,
    candidateDecisionBody({
      relationTarget: invalidTargetRelativePath
    }),
    "utf8"
  );
  await assertRejectedDiscardPreserves({
    decisionPath: invalidTargetSourcePath,
    expectedError: /target is not a valid scanned decision/,
    indexPath,
    relativePath: invalidTargetSourceRelativePath,
    workspaceRoot
  });
  assert.equal(await fs.readFile(invalidTargetPath, "utf8"), invalidTargetText);
  await fs.rm(invalidTargetSourcePath);
  await fs.rm(invalidTargetPath);
  })
));

test("discard removes only the selected candidate and preserves siblings", () => (
  withFixtureWorkspace("candidate-discard-selection", async (workspaceRoot) => {
  const decisionsDirectory = path.join(workspaceRoot, "docs", "decisions");
  const indexPath = path.join(decisionsDirectory, "decision-index.json");
  const originalIndexText = await fs.readFile(indexPath, "utf8");
  const otherCandidateRelativePath =
    "decision-records/use-other-valid-candidate.md";
  const otherCandidatePath = decisionFilePath(
    workspaceRoot,
    otherCandidateRelativePath
  );
  const otherCandidateText = candidateDecisionBody();
  await fs.writeFile(otherCandidatePath, otherCandidateText, "utf8");
  const discardedRelativePath =
    "decision-records/use-discarded-candidate.md";
  const discardedPath = decisionFilePath(workspaceRoot, discardedRelativePath);
  await fs.writeFile(
    discardedPath,
    candidateDecisionBody(),
    "utf8"
  );
  initializeGitRepository(workspaceRoot);
  commitWorkspace(workspaceRoot, "record reviewable candidates");
  const candidateCheck = await runSourceCli([
    "check",
    "--root",
    workspaceRoot
  ]);
  assert.equal(candidateCheck.exitCode, 0, candidateCheck.stderr);
  assert.equal(candidateCheck.stderr, "");
  assert.match(candidateCheck.stdout, /2 candidates/);
  const discarded = await runSourceCli([
    "discard",
    discardedRelativePath,
    "--root",
    workspaceRoot
  ]);
  assert.equal(discarded.exitCode, 0, discarded.stderr);
  assert.match(discarded.stdout, /Discarded decision candidate/);
  assert.match(discarded.stderr, /use-other-valid-candidate\.md/);
  assert.equal(await fileExists(discardedPath), false);
  assert.equal(await fs.readFile(otherCandidatePath, "utf8"), otherCandidateText);
  assert.equal(await fs.readFile(indexPath, "utf8"), originalIndexText);
  await fs.rm(otherCandidatePath);
  })
));

test("candidate queries discover source records while activation indexes only reviewed targets", () => (
  withFixtureWorkspace("candidate-activation-selection", async (workspaceRoot) => {
  const decisionsDirectory = path.join(workspaceRoot, "docs", "decisions");
  const indexPath = path.join(decisionsDirectory, "decision-index.json");
  const originalIndexText = await fs.readFile(indexPath, "utf8");
  const firstUnindexedRelativePath =
    "decision-records/use-first-unindexed.md";
  const secondUnindexedRelativePath =
    "decision-records/use-second-unindexed.md";
  const firstUnindexedPath = decisionFilePath(
    workspaceRoot,
    firstUnindexedRelativePath
  );
  const secondUnindexedPath = decisionFilePath(
    workspaceRoot,
    secondUnindexedRelativePath
  );
  await fs.writeFile(firstUnindexedPath, unindexedBody, "utf8");
  await fs.writeFile(secondUnindexedPath, unindexedBody, "utf8");
  const invalidRelativePath = "decision-records/use-invalid-source-candidate.md";
  const invalidPath = decisionFilePath(workspaceRoot, invalidRelativePath);
  await fs.writeFile(
    invalidPath,
    candidateDecisionBody().replace("\n## 决策\n", "\n## 非法章节\n"),
    "utf8"
  );
  const discoveredCandidates = await runBundledCli([
    "candidates",
    "--root",
    workspaceRoot
  ]);
  assert.equal(discoveredCandidates.exitCode, 0, discoveredCandidates.stderr);
  assert.match(discoveredCandidates.stderr, /query completed with warnings/i);
  assert.match(discoveredCandidates.stderr, /use-invalid-source-candidate\.md/);
  assert.match(discoveredCandidates.stdout, /Candidates:/);
  assert.match(discoveredCandidates.stdout, /use-first-unindexed\.md/);
  assert.match(discoveredCandidates.stdout, /use-second-unindexed\.md/);
  assert.doesNotMatch(
    discoveredCandidates.stdout,
    /use-invalid-source-candidate\.md/
  );
  const shownCandidate = await runBundledCli([
    "show-candidate",
    secondUnindexedRelativePath,
    "--root",
    workspaceRoot
  ]);
  assert.equal(shownCandidate.exitCode, 0, shownCandidate.stderr);
  assert.match(shownCandidate.stderr, /use-invalid-source-candidate\.md/);
  assert.match(shownCandidate.stdout, /^status: candidate$/m);
  assert.match(shownCandidate.stdout, /^alignment: null$/m);
  assert.match(shownCandidate.stdout, /^createdAt: null$/m);
  const invalidCandidate = await runBundledCli([
    "show-candidate",
    invalidRelativePath,
    "--root",
    workspaceRoot
  ]);
  assert.equal(invalidCandidate.exitCode, 1);
  assert.match(
    invalidCandidate.stderr,
    /not a valid reviewable candidate.*use-invalid-source-candidate\.md/i
  );
  assert.match(
    invalidCandidate.stderr,
    /has unsupported section ## 非法章节/
  );
  await fs.rm(invalidPath);
  const candidateCheckBeforeActivation = await runBundledCli([
    "check",
    "--root",
    workspaceRoot
  ]);
  assert.equal(
    candidateCheckBeforeActivation.exitCode,
    0,
    candidateCheckBeforeActivation.stderr
  );
  assert.match(candidateCheckBeforeActivation.stdout, /2 candidates/);
  const multipleUnindexedActivation = await runBundledCli([
    "activate",
    firstUnindexedRelativePath,
    "--alignment",
    "aligned",
    "--root",
    workspaceRoot
  ]);
  assert.equal(multipleUnindexedActivation.exitCode, 0);
  assert.match(
    multipleUnindexedActivation.stdout,
    /Activated new decision as aligned decision-records\/use-first-unindexed\.md\./
  );
  assert.match(
    multipleUnindexedActivation.stderr,
    /Reviewable decision candidate remains: decision-records\/use-second-unindexed\.md/
  );
  assert.doesNotMatch(
    multipleUnindexedActivation.stderr,
    /Reviewable decision candidate remains: decision-records\/use-first-unindexed\.md/
  );
  const firstActivationIndex = await readIndex(indexPath);
  findIndexEntry(firstActivationIndex, firstUnindexedRelativePath);
  assert.equal(
    Object.hasOwn(firstActivationIndex.entries, secondUnindexedRelativePath),
    false
  );

  const remainingCandidateCheck = await runBundledCli([
    "check",
    "--root",
    workspaceRoot
  ]);
  assert.equal(remainingCandidateCheck.exitCode, 0);
  assert.equal(remainingCandidateCheck.stderr, "");
  assert.match(remainingCandidateCheck.stdout, /1 candidates/);
  const candidateValidation = await validateDecisionRecords({ workspaceRoot });
  assert.equal(candidateValidation.activationCandidateCount, 1);

  const candidateList = await runBundledCli([
    "list",
    "--root",
    workspaceRoot
  ]);
  assert.equal(candidateList.exitCode, 0);
  assert.equal(candidateList.stderr, "");
  assert.match(candidateList.stdout, /use-first-unindexed\.md/);
  assert.doesNotMatch(candidateList.stdout, /use-second-unindexed\.md/);

  const candidateSync = await runBundledCli([
    "sync-index",
    "--write",
    "--root",
    workspaceRoot
  ]);
  assert.equal(candidateSync.exitCode, 0);
  assert.match(candidateSync.stdout, /Decision index is up to date/);
  assert.match(candidateSync.stderr, /use-second-unindexed\.md/);

  const secondActivation = await runSuccessfulCli([
    "activate",
    secondUnindexedRelativePath,
    "--alignment",
    "aligned",
    "--root",
    workspaceRoot
  ]);
  assert.match(secondActivation, /Activated new decision as aligned/);
  const completeCandidateIndex = await readIndex(indexPath);
  findIndexEntry(completeCandidateIndex, firstUnindexedRelativePath);
  findIndexEntry(completeCandidateIndex, secondUnindexedRelativePath);
  await runSuccessfulCli(["check", "--root", workspaceRoot]);
  await fs.rm(firstUnindexedPath);
  await fs.rm(secondUnindexedPath);
  await fs.writeFile(indexPath, originalIndexText, "utf8");
  })
));

test("activation reconciles unindexed established records before committing a candidate", () => (
  withFixtureWorkspace("candidate-activation-index", async (workspaceRoot) => {
  const decisionsDirectory = path.join(workspaceRoot, "docs", "decisions");
  const indexPath = path.join(decisionsDirectory, "decision-index.json");
  const targetCandidateRelativePath =
    "decision-records/use-target-candidate.md";
  const orphanRelativePath =
    "decision-records/use-orphan-established.md";
  const targetCandidatePath = decisionFilePath(
    workspaceRoot,
    targetCandidateRelativePath
  );
  const orphanPath = decisionFilePath(workspaceRoot, orphanRelativePath);
  await fs.writeFile(targetCandidatePath, unindexedBody, "utf8");
  await fs.writeFile(
    orphanPath,
    unindexedBody.replace(
      "status: candidate",
      "status: active"
    ).replace(
      "alignment: null",
      "alignment: aligned"
    ).replace(
      "createdAt: null",
      "createdAt: 2026-07-22T10:20:30+08:00"
    ),
    "utf8"
  );
  for (const staleQueryArgs of [
    ["list", "--root", workspaceRoot],
    ["show", currentRelativePath, "--root", workspaceRoot],
    ["trace", currentRelativePath, "--root", workspaceRoot]
  ]) {
    const staleQueryWithOrphan = await runBundledCli(staleQueryArgs);
    assert.equal(
      staleQueryWithOrphan.exitCode,
      0,
      staleQueryWithOrphan.stderr
    );
    assert.doesNotMatch(staleQueryWithOrphan.stdout, /use-orphan-established\.md/);
  }

  const syncWithOrphan = await runBundledCli([
    "sync-index",
    "--write",
    "--root",
    workspaceRoot
  ]);
  assert.equal(syncWithOrphan.exitCode, 0);
  assert.match(syncWithOrphan.stderr, /use-target-candidate\.md/);
  findIndexEntry(await readIndex(indexPath), orphanRelativePath);

  const activationWithOrphan = await runBundledCli([
    "activate",
    targetCandidateRelativePath,
    "--alignment",
    "aligned",
    "--root",
    workspaceRoot
  ]);
  assert.equal(activationWithOrphan.exitCode, 0);
  assert.match(
    await fs.readFile(targetCandidatePath, "utf8"),
    /createdAt: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z/
  );
  const indexWithEstablishedAdditions = await readIndex(indexPath);
  findIndexEntry(indexWithEstablishedAdditions, targetCandidateRelativePath);
  findIndexEntry(indexWithEstablishedAdditions, orphanRelativePath);
  })
));

test("discarding the only candidate preserves the domain catalog", () => (
  withTemporaryWorkspace("only-candidate", async (workspaceRoot) => {
  const decisionsDirectory = path.join(workspaceRoot, "docs", "decisions");
  const relativePath = "decision-records/use-only-candidate.md";
  const decisionPath = decisionFilePath(workspaceRoot, relativePath);
  await writeTestDomainCatalog(decisionsDirectory);
  await fs.mkdir(path.dirname(decisionPath), { recursive: true });
  await fs.writeFile(
    decisionPath,
    candidateDecisionBody(),
    "utf8"
  );
  const discarded = await runSourceCli([
    "discard",
    relativePath,
    "--root",
    workspaceRoot
  ]);
  assert.equal(discarded.exitCode, 0, discarded.stderr);
  assert.equal(await fileExists(decisionPath), false);
  assert.equal(
    await fileExists(path.join(decisionsDirectory, "decision-domains.json")),
    true
  );
  assert.equal(
    await fileExists(path.join(decisionsDirectory, "decision-index.json")),
    false
  );
  })
));

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
    options.workspaceRoot
  ]);
  assert.equal(result.exitCode, 1);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, options.expectedError);
  assert.equal(await fs.readFile(options.decisionPath, "utf8"), decisionText);
  assert.equal(await fs.readFile(options.indexPath, "utf8"), indexText);
}

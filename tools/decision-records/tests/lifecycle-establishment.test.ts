import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { validateDecisionRecords } from "../src/index.ts";
import {
  currentRelativePath,
  findIndexEntry,
  fixtureRoot,
  readIndex,
  runBundledCli,
  runSourceCli,
  runSuccessfulSourceCli,
  writeTestDomainCatalog
} from "./support.ts";

const lifecycleRoot = await fs.mkdtemp(
  path.join(os.tmpdir(), "decision-records-lifecycle-")
);
try {
  await fs.cp(fixtureRoot, lifecycleRoot, { recursive: true });
  assert.equal(await fileExists(path.join(lifecycleRoot, ".git")), false);

  const decisionsDirectory = path.join(lifecycleRoot, "docs", "decisions");
  const indexPath = path.join(decisionsDirectory, "decision-index.json");
  const establishedPath = path.join(decisionsDirectory, currentRelativePath);
  const establishedText = await fs.readFile(establishedPath, "utf8");
  const originalIndexText = await fs.readFile(indexPath, "utf8");

  const establishedDiscard = await runSourceCli([
    "discard",
    currentRelativePath,
    "--root",
    lifecycleRoot
  ]);
  assert.equal(establishedDiscard.exitCode, 1);
  assert.match(establishedDiscard.stderr, /Cannot discard established decision/);
  assert.equal(await fs.readFile(establishedPath, "utf8"), establishedText);
  assert.equal(await fs.readFile(indexPath, "utf8"), originalIndexText);

  const invalidRelativePath = "decision-records/use-invalid-candidate.md";
  const invalidPath = path.join(decisionsDirectory, invalidRelativePath);
  await fs.mkdir(path.dirname(invalidPath), { recursive: true });
  await fs.writeFile(
    invalidPath,
    candidateDecisionBody({ alignment: "aligned" }).replace(
      "\n## 目的\n- 验证 Markdown 生命周期独立定义候选和已建立状态。\n",
      "\n"
    ),
    "utf8"
  );
  const invalidDiscard = await runSourceCli([
    "discard",
    invalidRelativePath,
    "--root",
    lifecycleRoot
  ]);
  assert.equal(invalidDiscard.exitCode, 1);
  assert.match(invalidDiscard.stderr, /Discard requires a complete unactivated/);
  assert.equal(await fileExists(invalidPath), true);
  assert.equal(await fs.readFile(indexPath, "utf8"), originalIndexText);
  await fs.rm(invalidPath);

  const activeTargetSourceRelativePath =
    "decision-records/use-active-target-discard-source.md";
  const activeTargetSourcePath = path.join(
    decisionsDirectory,
    activeTargetSourceRelativePath
  );
  await fs.writeFile(
    activeTargetSourcePath,
    candidateDecisionBody({
      alignment: "aligned",
      relationTarget: currentRelativePath
    }),
    "utf8"
  );
  await assertRejectedDiscardPreserves({
    decisionPath: activeTargetSourcePath,
    expectedError: /target must be archived/,
    indexPath,
    relativePath: activeTargetSourceRelativePath,
    workspaceRoot: lifecycleRoot
  });
  await fs.rm(activeTargetSourcePath);

  const discardCandidateTargetRelativePath =
    "decision-records/use-discard-candidate-target.md";
  const discardCandidateTargetPath = path.join(
    decisionsDirectory,
    discardCandidateTargetRelativePath
  );
  const discardCandidateTargetText = candidateDecisionBody({
    alignment: "aligned"
  });
  await fs.writeFile(
    discardCandidateTargetPath,
    discardCandidateTargetText,
    "utf8"
  );
  const candidateTargetSourceRelativePath =
    "decision-records/use-candidate-target-discard-source.md";
  const candidateTargetSourcePath = path.join(
    decisionsDirectory,
    candidateTargetSourceRelativePath
  );
  await fs.writeFile(
    candidateTargetSourcePath,
    candidateDecisionBody({
      alignment: "aligned",
      relationTarget: discardCandidateTargetRelativePath
    }),
    "utf8"
  );
  await assertRejectedDiscardPreserves({
    decisionPath: candidateTargetSourcePath,
    expectedError: /target must be archived/,
    indexPath,
    relativePath: candidateTargetSourceRelativePath,
    workspaceRoot: lifecycleRoot
  });
  assert.equal(
    await fs.readFile(discardCandidateTargetPath, "utf8"),
    discardCandidateTargetText
  );
  await fs.rm(candidateTargetSourcePath);
  await fs.rm(discardCandidateTargetPath);

  const invalidTargetRelativePath =
    "decision-records/use-invalid-existing-discard-target.md";
  const invalidTargetPath = path.join(
    decisionsDirectory,
    invalidTargetRelativePath
  );
  const invalidTargetText = candidateDecisionBody({ alignment: "aligned" }).replace(
    "\n## 目的\n- 验证 Markdown 生命周期独立定义候选和已建立状态。\n",
    "\n"
  );
  await fs.writeFile(invalidTargetPath, invalidTargetText, "utf8");
  const invalidTargetSourceRelativePath =
    "decision-records/use-invalid-target-discard-source.md";
  const invalidTargetSourcePath = path.join(
    decisionsDirectory,
    invalidTargetSourceRelativePath
  );
  await fs.writeFile(
    invalidTargetSourcePath,
    candidateDecisionBody({
      alignment: "aligned",
      relationTarget: invalidTargetRelativePath
    }),
    "utf8"
  );
  await assertRejectedDiscardPreserves({
    decisionPath: invalidTargetSourcePath,
    expectedError: /target is not a scanned decision/,
    indexPath,
    relativePath: invalidTargetSourceRelativePath,
    workspaceRoot: lifecycleRoot
  });
  assert.equal(await fs.readFile(invalidTargetPath, "utf8"), invalidTargetText);
  await fs.rm(invalidTargetSourcePath);
  await fs.rm(invalidTargetPath);

  const otherCandidateRelativePath = "decision-records/use-other-valid-candidate.md";
  const otherCandidatePath = path.join(
    decisionsDirectory,
    otherCandidateRelativePath
  );
  const otherCandidateText = candidateDecisionBody({ alignment: "unaligned" });
  await fs.writeFile(otherCandidatePath, otherCandidateText, "utf8");
  const discardedRelativePath = "decision-records/use-discarded-candidate.md";
  const discardedPath = path.join(decisionsDirectory, discardedRelativePath);
  await fs.writeFile(
    discardedPath,
    candidateDecisionBody({ alignment: "aligned" }),
    "utf8"
  );
  const candidateCheck = await runSourceCli([
    "check",
    "--root",
    lifecycleRoot
  ]);
  assert.equal(candidateCheck.exitCode, 1);
  assert.match(candidateCheck.stderr, /must be activated or discarded/);
  const discarded = await runSourceCli([
    "discard",
    discardedRelativePath,
    "--root",
    lifecycleRoot
  ]);
  assert.equal(discarded.exitCode, 0, discarded.stderr);
  assert.match(discarded.stdout, /Discarded unactivated decision candidate/);
  assert.match(discarded.stderr, /use-other-valid-candidate\.md/);
  assert.equal(await fileExists(discardedPath), false);
  assert.equal(await fs.readFile(otherCandidatePath, "utf8"), otherCandidateText);
  assert.equal(await fs.readFile(indexPath, "utf8"), originalIndexText);
  await fs.rm(otherCandidatePath);

  const lifecycleRelativePath = "decision-records/use-markdown-establishment.md";
  const lifecyclePath = path.join(decisionsDirectory, lifecycleRelativePath);
  await fs.mkdir(path.dirname(lifecyclePath), { recursive: true });
  await fs.writeFile(
    lifecyclePath,
    candidateDecisionBody({ alignment: "unaligned" }),
    "utf8"
  );

  const activation = await runSourceCli([
    "activate",
    lifecycleRelativePath,
    "--alignment",
    "unaligned",
    "--root",
    lifecycleRoot
  ]);
  assert.equal(activation.exitCode, 0, activation.stderr);
  assert.doesNotMatch(activation.stdout, /pending/i);
  assert.doesNotMatch(activation.stderr, /pending/i);
  const activatedText = await fs.readFile(lifecyclePath, "utf8");
  const createdAt = activatedText.match(/^createdAt: (.+)$/m)?.[1];
  assert.match(createdAt ?? "", /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  findIndexEntry(await readIndex(indexPath), lifecycleRelativePath);

  const repeatedActivation = await runSourceCli([
    "activate",
    lifecycleRelativePath,
    "--alignment",
    "unaligned",
    "--root",
    lifecycleRoot
  ]);
  assert.equal(repeatedActivation.exitCode, 0, repeatedActivation.stderr);
  assert.match(repeatedActivation.stdout, /already active and unaligned/);
  assert.equal(await fs.readFile(lifecyclePath, "utf8"), activatedText);

  await fs.rm(indexPath);
  const markedAligned = await runSourceCli([
    "mark-aligned",
    lifecycleRelativePath,
    "--root",
    lifecycleRoot
  ]);
  assert.equal(markedAligned.exitCode, 0, markedAligned.stderr);
  assert.equal(
    findIndexEntry(await readIndex(indexPath), lifecycleRelativePath).alignment,
    "aligned"
  );

  await fs.writeFile(indexPath, "{ invalid json\n", "utf8");
  const archived = await runSourceCli([
    "archive",
    lifecycleRelativePath,
    "--root",
    lifecycleRoot
  ]);
  assert.equal(archived.exitCode, 0, archived.stderr);
  const archivedState = findIndexEntry(await readIndex(indexPath), lifecycleRelativePath);
  assert.equal(archivedState.status, "archived");
  assert.equal(archivedState.alignment, null);
  assert.equal(archivedState.createdAt, createdAt);

  const archivedDiscard = await runSourceCli([
    "discard",
    lifecycleRelativePath,
    "--root",
    lifecycleRoot
  ]);
  assert.equal(archivedDiscard.exitCode, 1);
  assert.match(archivedDiscard.stderr, /Cannot discard established decision/);

  const reactivated = await runSourceCli([
    "activate",
    lifecycleRelativePath,
    "--alignment",
    "aligned",
    "--root",
    lifecycleRoot
  ]);
  assert.equal(reactivated.exitCode, 0, reactivated.stderr);
  assert.equal(
    findIndexEntry(await readIndex(indexPath), lifecycleRelativePath).createdAt,
    createdAt
  );

  for (const args of [
    ["check", "--root", lifecycleRoot],
    ["list", "--root", lifecycleRoot],
    ["show", lifecycleRelativePath, "--root", lifecycleRoot],
    ["trace", lifecycleRelativePath, "--root", lifecycleRoot],
    ["sync-index", "--write", "--root", lifecycleRoot]
  ]) {
    const result = await runBundledCli(args);
    assert.equal(result.exitCode, 0, `${args[0]} failed: ${result.stderr}`);
    assert.doesNotMatch(result.stdout, /pending/i);
    assert.doesNotMatch(result.stderr, /Git HEAD|pending/i);
  }

  await runSuccessfulSourceCli([
    "archive",
    lifecycleRelativePath,
    "--root",
    lifecycleRoot
  ]);
  const relationRelativePath = "decision-records/use-archived-relation-target.md";
  const relationPath = path.join(decisionsDirectory, relationRelativePath);
  await fs.writeFile(
    relationPath,
    candidateDecisionBody({
      alignment: "aligned",
      relationTarget: lifecycleRelativePath
    }),
    "utf8"
  );
  const relationActivation = await runSourceCli([
    "activate",
    relationRelativePath,
    "--alignment",
    "aligned",
    "--root",
    lifecycleRoot
  ]);
  assert.equal(relationActivation.exitCode, 0, relationActivation.stderr);
  findIndexEntry(await readIndex(indexPath), relationRelativePath);

  const rollbackRelativePath = "decision-records/use-active-relation-target.md";
  const rollbackPath = path.join(decisionsDirectory, rollbackRelativePath);
  const rollbackCandidate = candidateDecisionBody({
    alignment: "aligned",
    relationTarget: currentRelativePath
  });
  await fs.writeFile(rollbackPath, rollbackCandidate, "utf8");
  const indexBeforeRollback = await fs.readFile(indexPath, "utf8");
  const failedActivation = await runSourceCli([
    "activate",
    rollbackRelativePath,
    "--alignment",
    "aligned",
    "--root",
    lifecycleRoot
  ]);
  assert.equal(failedActivation.exitCode, 1);
  assert.match(failedActivation.stderr, /target must be archived/);
  assert.equal(await fs.readFile(rollbackPath, "utf8"), rollbackCandidate);
  assert.equal(await fs.readFile(indexPath, "utf8"), indexBeforeRollback);
  await fs.rm(rollbackPath);

  const candidateTargetRelativePath = "decision-records/use-candidate-target.md";
  const candidateTargetPath = path.join(
    decisionsDirectory,
    candidateTargetRelativePath
  );
  const candidateSourceRelativePath = "decision-records/use-candidate-source.md";
  const candidateSourcePath = path.join(
    decisionsDirectory,
    candidateSourceRelativePath
  );
  await fs.writeFile(
    candidateTargetPath,
    candidateDecisionBody({ alignment: "aligned" }),
    "utf8"
  );
  await fs.writeFile(
    candidateSourcePath,
    candidateDecisionBody({
      alignment: "aligned",
      relationTarget: candidateTargetRelativePath
    }),
    "utf8"
  );
  assert.ok((await validateDecisionRecords({ workspaceRoot: lifecycleRoot })).errors.some(
    (error) => error.includes(
      "relationship 修订 target must be archived: " + candidateTargetRelativePath
    )
  ));
  await fs.rm(candidateSourcePath);
  await fs.rm(candidateTargetPath);

  const invalidRelationRelativePath = "decision-records/use-invalid-relations.md";
  const invalidRelationPath = path.join(
    decisionsDirectory,
    invalidRelationRelativePath
  );
  await fs.writeFile(
    invalidRelationPath,
    candidateDecisionBody({
      alignment: "aligned",
      relationTarget: "decision-records/missing-target.md"
    }),
    "utf8"
  );
  assert.ok((await validateDecisionRecords({ workspaceRoot: lifecycleRoot })).errors.some(
    (error) => error.includes(
      "target does not exist: decision-records/missing-target.md"
    )
  ));

  await fs.writeFile(
    invalidRelationPath,
    candidateDecisionBody({
      alignment: "aligned",
      relationTarget: invalidRelationRelativePath
    }),
    "utf8"
  );
  assert.ok((await validateDecisionRecords({ workspaceRoot: lifecycleRoot })).errors.some(
    (error) => error.includes("must not relate to itself")
  ));

  const duplicateRelationBody = candidateDecisionBody({
    alignment: "aligned",
    relationTarget: lifecycleRelativePath
  }).replace(
    "    target: " + lifecycleRelativePath,
    "    target: " + lifecycleRelativePath + "\n"
      + "  - type: 修订\n"
      + "    target: " + lifecycleRelativePath
  );
  await fs.writeFile(invalidRelationPath, duplicateRelationBody, "utf8");
  assert.ok((await validateDecisionRecords({ workspaceRoot: lifecycleRoot })).errors.some(
    (error) => error.includes("repeats relationship 修订 target")
  ));
} finally {
  await fs.rm(lifecycleRoot, { force: true, recursive: true });
}

const onlyCandidateRoot = await fs.mkdtemp(
  path.join(os.tmpdir(), "decision-records-only-candidate-")
);
try {
  const decisionsDirectory = path.join(onlyCandidateRoot, "docs", "decisions");
  const relativePath = "decision-records/use-only-candidate.md";
  const decisionPath = path.join(decisionsDirectory, relativePath);
  await writeTestDomainCatalog(decisionsDirectory);
  await fs.mkdir(path.dirname(decisionPath), { recursive: true });
  await fs.writeFile(
    decisionPath,
    candidateDecisionBody({ alignment: "aligned" }),
    "utf8"
  );
  const discarded = await runSourceCli([
    "discard",
    relativePath,
    "--root",
    onlyCandidateRoot
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
} finally {
  await fs.rm(onlyCandidateRoot, { force: true, recursive: true });
}

function candidateDecisionBody(options: {
  alignment: "aligned" | "unaligned";
  relationTarget?: string;
}): string {
  const relations = options.relationTarget === undefined
    ? ["relations: []"]
    : [
        "relations:",
        "  - type: 修订",
        "    target: " + options.relationTarget
      ];
  return [
    "---",
    "title: 使用 Markdown 建立状态",
    "status: active",
    "alignment: " + options.alignment,
    "createdAt: null",
    "purpose: 验证 Markdown 生命周期独立定义候选和已建立状态。",
    "background: 索引和版本历史不应共同承担决策成员身份。",
    "decision: 使用 createdAt 是否为空区分候选与已建立决策。",
    ...relations,
    "---",
    "",
    "## 目的",
    "- 验证 Markdown 生命周期独立定义候选和已建立状态。",
    "",
    "## 背景",
    "- 索引和版本历史不应共同承担决策成员身份。",
    "",
    "## 决策",
    "- 采用: 使用 createdAt 是否为空区分候选与已建立决策。",
    ""
  ].join("\n");
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

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

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { applyDecisionChanges } from "../src/decision-transaction.ts";
import { validateDecisionRecords } from "../src/index.ts";
import { scanDecisionRecords } from "../src/scan.ts";
import {
  archivedRelativePath,
  candidateDecisionBody,
  currentRelativePath,
  decisionFilePath,
  findIndexEntry,
  generatedCliPath,
  readIndex,
  runBundledCli,
  runSourceCli,
  runSuccessfulCli,
  runSuccessfulSourceCli,
  traceDecision,
  withFixtureWorkspace
} from "./support.ts";

await withFixtureWorkspace("relation-evolution", async (workspaceRoot) => {
  const decisionsDirectory = path.join(workspaceRoot, "docs", "decisions");
  const indexPath = path.join(decisionsDirectory, "decision-index.json");
  const originalIndexText = await fs.readFile(indexPath, "utf8");
  const archivedDecisionPath = decisionFilePath(
    workspaceRoot,
    archivedRelativePath
  );
  const archivedDecision = await fs.readFile(archivedDecisionPath, "utf8");

  await fs.writeFile(
    archivedDecisionPath,
    archivedDecision
      .replace("status: archived", "status: active")
      .replace("alignment: null", "alignment: aligned"),
    "utf8"
  );
  assert.ok((await validateDecisionRecords({ workspaceRoot })).errors.some(
    (error) => error.includes("relationship 修订 target must be archived")
  ));
  await fs.writeFile(archivedDecisionPath, archivedDecision, "utf8");

  await fs.writeFile(
    archivedDecisionPath,
    archivedDecision.replace(
      "relations: []\n",
      "relations:\n"
        + "  - type: 修订\n"
        + "    target: project-tooling/use-generated-cli.md\n"
    ),
    "utf8"
  );
  assert.ok((await validateDecisionRecords({ workspaceRoot })).errors.some(
    (error) => error.includes("Decision relations must not form a cycle")
  ));
  await fs.writeFile(archivedDecisionPath, archivedDecision, "utf8");

  const activateRelationTarget = await runBundledCli([
    "activate",
    archivedRelativePath,
    "--alignment",
    "aligned",
    "--root",
    workspaceRoot
  ]);
  assert.equal(activateRelationTarget.exitCode, 1);
  assert.match(
    activateRelationTarget.stderr,
    /relationship 修订 target must be archived/
  );
  assert.equal(await fs.readFile(indexPath, "utf8"), originalIndexText);
  assert.equal(
    await fs.readFile(archivedDecisionPath, "utf8"),
    archivedDecision
  );

  const candidateTargetRelativePath =
    "decision-records/use-candidate-target.md";
  const candidateTargetPath = decisionFilePath(
    workspaceRoot,
    candidateTargetRelativePath
  );
  const candidateSourceRelativePath =
    "decision-records/use-candidate-source.md";
  const candidateSourcePath = decisionFilePath(
    workspaceRoot,
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
  assert.ok((await validateDecisionRecords({ workspaceRoot })).errors.some(
    (error) => error.includes(
      "relationship 修订 target must be archived: "
        + candidateTargetRelativePath
    )
  ));
  await fs.rm(candidateSourcePath);
  await fs.rm(candidateTargetPath);

  const invalidRelationRelativePath =
    "decision-records/use-invalid-relations.md";
  const invalidRelationPath = decisionFilePath(
    workspaceRoot,
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
  assert.ok((await validateDecisionRecords({ workspaceRoot })).errors.some(
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
  assert.ok((await validateDecisionRecords({ workspaceRoot })).errors.some(
    (error) => error.includes("must not relate to itself")
  ));

  const duplicateRelationBody = candidateDecisionBody({
    alignment: "aligned",
    relationTarget: archivedRelativePath
  }).replace(
    "    target: " + archivedRelativePath,
    "    target: " + archivedRelativePath + "\n"
      + "  - type: 替代\n"
      + "    target: " + archivedRelativePath
  );
  await fs.writeFile(invalidRelationPath, duplicateRelationBody, "utf8");
  assert.ok((await validateDecisionRecords({ workspaceRoot })).errors.some(
    (error) => error.includes("repeats relationship target")
  ));
  await fs.rm(invalidRelationPath);

  const successorRelativePath = "project-tooling/use-bundled-cli.md";
  const successorPath = decisionFilePath(workspaceRoot, successorRelativePath);
  const successorBody = [
    "---",
    "title: 使用打包 CLI",
    "status: active",
    "alignment: aligned",
    "createdAt: null",
    "purpose: 验证单条激活命令能够完成决策演进。",
    "background: 演进同时改变新记录关系与直接前序生命周期，分步执行会产生无效中间状态。",
    "decision: 激活新决策时显式提供直接关系，并在同一事务归档前序。",
    "relations: []",
    "---",
    "",
    "## 目的",
    "- 验证单条激活命令能够完成决策演进。",
    "",
    "## 背景",
    "- 演进同时改变新记录关系与直接前序生命周期，分步执行会产生无效中间状态。",
    "",
    "## 决策",
    "- 采用: 激活新决策时显式提供直接关系，并在同一事务归档前序。",
    ""
  ].join("\n");
  await fs.writeFile(successorPath, successorBody, "utf8");
  await runSuccessfulCli([
    "activate",
    successorRelativePath,
    "--alignment",
    "aligned",
    "--relation",
    "替代=" + currentRelativePath,
    "--root",
    workspaceRoot
  ]);
  const switched = await validateDecisionRecords({ workspaceRoot });
  assert.deepEqual(switched.errors, []);
  assert.equal(switched.activeCount, 1);
  assert.equal(switched.archivedCount, 2);
  const switchedIndex = await readIndex(indexPath);
  const successorEntry = findIndexEntry(switchedIndex, successorRelativePath);
  assert.equal(successorEntry.status, "active");
  assert.equal(successorEntry.alignment, "aligned");
  assert.deepEqual(successorEntry.relations, [{
    type: "替代",
    target: currentRelativePath
  }]);
  assert.match(
    successorEntry.createdAt,
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/
  );
  assert.equal(
    findIndexEntry(switchedIndex, currentRelativePath).status,
    "archived"
  );
  assert.equal(
    findIndexEntry(switchedIndex, currentRelativePath).alignment,
    null
  );
  assert.equal(
    findIndexEntry(switchedIndex, archivedRelativePath).status,
    "archived"
  );

  const directPredecessorTrace = await traceDecision(
    successorRelativePath,
    ["--direction", "predecessors", "--depth", "1"],
    workspaceRoot
  );
  assert.match(
    directPredecessorTrace,
    /project-tooling\/use-generated-cli\.md/
  );
  assert.doesNotMatch(directPredecessorTrace, /260710-use-source-cli/);

  const fullPredecessorTrace = await traceDecision(
    successorRelativePath,
    ["--direction", "predecessors", "--depth", "2"],
    workspaceRoot
  );
  assert.match(fullPredecessorTrace, /260710-use-source-cli/);
});

await withFixtureWorkspace("evolve-command", async (workspaceRoot) => {
  const decisionsDirectory = path.join(workspaceRoot, "docs", "decisions");
  const indexPath = path.join(decisionsDirectory, "decision-index.json");
  const parallelRelativePath =
    "decision-records/use-parallel-evolution-predecessor.md";
  const parallelPath = decisionFilePath(workspaceRoot, parallelRelativePath);
  await fs.writeFile(
    parallelPath,
    candidateDecisionBody({ alignment: "aligned" }),
    "utf8"
  );
  await runSuccessfulSourceCli([
    "activate",
    parallelRelativePath,
    "--alignment",
    "aligned",
    "--root",
    workspaceRoot
  ]);

  const mergedRelativePath =
    "decision-records/merge-direct-predecessors.md";
  const mergedPath = decisionFilePath(workspaceRoot, mergedRelativePath);
  const mergedCandidate = candidateDecisionBody({ alignment: "aligned" });
  await fs.writeFile(mergedPath, mergedCandidate, "utf8");
  const indexBeforeRejectedEvolution = await fs.readFile(indexPath, "utf8");
  const repeatedPredecessor = spawnSync(
    "node",
    [
      generatedCliPath,
      "evolve",
      mergedRelativePath,
      "--alignment",
      "aligned",
      "--relation",
      "归并=" + currentRelativePath,
      "--relation",
      "替代=" + currentRelativePath,
      "--root",
      workspaceRoot
    ],
    { encoding: "utf8" }
  );
  assert.equal(repeatedPredecessor.status, 2);
  assert.match(
    repeatedPredecessor.stderr,
    /must not repeat a direct predecessor target/
  );
  assert.equal(await fs.readFile(mergedPath, "utf8"), mergedCandidate);
  assert.equal(
    await fs.readFile(indexPath, "utf8"),
    indexBeforeRejectedEvolution
  );

  const currentPath = decisionFilePath(workspaceRoot, currentRelativePath);
  const archivedPath = decisionFilePath(workspaceRoot, archivedRelativePath);
  const currentBeforeRollback = await fs.readFile(currentPath, "utf8");
  const archivedBeforeRollback = await fs.readFile(archivedPath, "utf8");
  const indexBeforeRollback = await fs.readFile(indexPath, "utf8");
  const currentInvalidUpdate = currentBeforeRollback.replace(
    "alignment: aligned",
    "alignment: unaligned"
  );
  const archivedInvalidUpdate = archivedBeforeRollback
    .replace("status: archived", "status: active")
    .replace("alignment: null", "alignment: aligned");
  assert.notEqual(currentInvalidUpdate, currentBeforeRollback);
  assert.notEqual(archivedInvalidUpdate, archivedBeforeRollback);
  const rollbackErrors = await applyDecisionChanges({
    changes: [
      { decisionPath: currentPath, nextText: currentInvalidUpdate },
      { decisionPath: archivedPath, nextText: archivedInvalidUpdate }
    ],
    originalScan: await scanDecisionRecords({ workspaceRoot }),
    scanOptions: { workspaceRoot }
  });
  assert.ok(rollbackErrors.some(
    (error) => /target must be archived/.test(error)
  ));
  assert.equal(await fs.readFile(currentPath, "utf8"), currentBeforeRollback);
  assert.equal(await fs.readFile(archivedPath, "utf8"), archivedBeforeRollback);
  assert.equal(await fs.readFile(indexPath, "utf8"), indexBeforeRollback);

  const rejectedEvolution = await runSourceCli([
    "evolve",
    mergedRelativePath,
    "--alignment",
    "aligned",
    "--relation",
    "归并=" + currentRelativePath,
    "--relation",
    "归并=" + archivedRelativePath,
    "--root",
    workspaceRoot
  ]);
  assert.equal(rejectedEvolution.exitCode, 1);
  assert.match(rejectedEvolution.stderr, /Evolution predecessor must be active/);
  assert.equal(await fs.readFile(mergedPath, "utf8"), mergedCandidate);
  assert.equal(
    await fs.readFile(indexPath, "utf8"),
    indexBeforeRejectedEvolution
  );

  const evolved = await runSourceCli([
    "evolve",
    mergedRelativePath,
    "--alignment",
    "aligned",
    "--relation",
    "归并=" + currentRelativePath,
    "--relation",
    "归并=" + parallelRelativePath,
    "--root",
    workspaceRoot
  ]);
  assert.equal(evolved.exitCode, 0, evolved.stderr);
  assert.match(evolved.stdout, /archived direct predecessors/);

  const evolvedIndex = await readIndex(indexPath);
  assert.equal(
    findIndexEntry(evolvedIndex, currentRelativePath).status,
    "archived"
  );
  assert.equal(
    findIndexEntry(evolvedIndex, parallelRelativePath).status,
    "archived"
  );
  const mergedState = findIndexEntry(evolvedIndex, mergedRelativePath);
  assert.equal(mergedState.status, "active");
  assert.equal(mergedState.alignment, "aligned");
  assert.deepEqual(mergedState.relations, [
    { type: "归并", target: currentRelativePath },
    { type: "归并", target: parallelRelativePath }
  ]);
  assert.match(
    await fs.readFile(mergedPath, "utf8"),
    /relations:\n  - type: 归并\n    target: project-tooling\/use-generated-cli\.md\n  - type: 归并/
  );
  assert.deepEqual(
    (await validateDecisionRecords({ workspaceRoot })).errors,
    []
  );
});

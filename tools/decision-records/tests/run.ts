import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { validateDecisionRecords } from "../src/index.ts";
import {
  archivedRelativePath,
  currentRelativePath,
  findIndexEntry,
  fixtureRoot,
  initializeGitRepository,
  readIndex,
  runBundledCli,
  runSuccessfulCli,
  traceDecision,
  writeIndex
} from "./support.ts";

await import("./generated-artifacts.test.ts");
await import("./queries.test.ts");
await import("./type-path-invariants.test.ts");
await import("./state-snapshot.test.ts");
await import("./configured-decision-directory.test.ts");

const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "decision-records-test-"));
try {
  await fs.cp(fixtureRoot, tempRoot, { recursive: true });
  initializeGitRepository(tempRoot);
  const decisionsDirectory = path.join(tempRoot, "docs", "decisions");
  const indexPath = path.join(decisionsDirectory, "decision-index.json");
  const originalIndexText = await fs.readFile(indexPath, "utf8");
  const originalIndex = await readIndex(indexPath);
  const currentDecisionPath = path.join(
    decisionsDirectory,
    "tooling",
    "use-generated-cli.md"
  );
  const currentDecision = await fs.readFile(currentDecisionPath, "utf8");
  const archivedDecisionPath = path.join(
    decisionsDirectory,
    "tooling",
    "260710-use-source-cli.md"
  );
  const archivedDecision = await fs.readFile(archivedDecisionPath, "utf8");

  const rejectedAlignmentRollback = await runBundledCli([
    "activate",
    currentRelativePath,
    "--alignment",
    "unaligned",
    "--root",
    tempRoot
  ]);
  assert.equal(rejectedAlignmentRollback.exitCode, 1);
  assert.match(
    rejectedAlignmentRollback.stderr,
    /cannot be changed back to unaligned/
  );
  assert.equal(await fs.readFile(currentDecisionPath, "utf8"), currentDecision);
  assert.equal(await fs.readFile(indexPath, "utf8"), originalIndexText);

  const copiedContractPath = path.join(
    decisionsDirectory,
    "decision-record-rules.md"
  );
  await fs.writeFile(copiedContractPath, "# Copied contract\n", "utf8");
  const withCopiedContract = await validateDecisionRecords({ workspaceRoot: tempRoot });
  assert.ok(withCopiedContract.errors.some(
    (error) => error.includes("root contains unsupported file decision-record-rules.md")
  ));
  await fs.rm(copiedContractPath);

  await fs.writeFile(
    indexPath,
    JSON.stringify({ ...originalIndex, unsupported: true }, null, 2) + "\n",
    "utf8"
  );
  const withUnsupportedIndexField = await validateDecisionRecords({
    workspaceRoot: tempRoot
  });
  assert.ok(withUnsupportedIndexField.errors.some(
    (error) => error.includes(
      'unsupported Invalid key: Expected never but received "unsupported"'
    )
  ));

  await fs.writeFile(
    indexPath,
    JSON.stringify({ schemaVersion: 3, records: [] }, null, 2) + "\n",
    "utf8"
  );
  const withUnsupportedSchemaVersion = await validateDecisionRecords({
    workspaceRoot: tempRoot
  });
  assert.ok(withUnsupportedSchemaVersion.errors.some(
    (error) => error.includes("schemaVersion must be 1")
  ));
  const listWithInvalidIndex = await runBundledCli([
    "list",
    "--root",
    tempRoot
  ]);
  assert.equal(listWithInvalidIndex.exitCode, 1);
  assert.match(listWithInvalidIndex.stderr, /Decision records command failed/);

  const invalidTimestampIndex = structuredClone(originalIndex);
  invalidTimestampIndex.entries[0]!.state.createdAt = "2026-07-10";
  await writeIndex(indexPath, invalidTimestampIndex);
  assert.ok((await validateDecisionRecords({ workspaceRoot: tempRoot })).errors.some(
    (error) => error.includes("createdAt must be an RFC 3339 timestamp")
  ));

  const fractionalTimestampIndex = structuredClone(originalIndex);
  fractionalTimestampIndex.entries[0]!.state.createdAt =
    "2026-07-10T09:10:11.123+08:00";
  await writeIndex(indexPath, fractionalTimestampIndex);
  assert.ok((await validateDecisionRecords({ workspaceRoot: tempRoot })).errors.some(
    (error) => error.includes("precise to seconds")
  ));

  const invalidAlignmentIndex = structuredClone(originalIndex);
  findIndexEntry(invalidAlignmentIndex, currentRelativePath).alignment = null;
  await writeIndex(indexPath, invalidAlignmentIndex);
  assert.ok((await validateDecisionRecords({ workspaceRoot: tempRoot })).errors.some(
    (error) => error.includes("alignment must be aligned or unaligned when status is active")
  ));

  const shortProjectionIndex = structuredClone(originalIndex);
  shortProjectionIndex.entries[0]!.state.title = "短";
  await writeIndex(indexPath, shortProjectionIndex);
  assert.ok((await validateDecisionRecords({ workspaceRoot: tempRoot })).errors.some(
    (error) => error.includes("actual 1")
  ));

  const longProjectionIndex = structuredClone(originalIndex);
  longProjectionIndex.entries[0]!.state.purpose = "长".repeat(101);
  await writeIndex(indexPath, longProjectionIndex);
  assert.ok((await validateDecisionRecords({ workspaceRoot: tempRoot })).errors.some(
    (error) => error.includes("actual 101")
  ));

  await fs.writeFile(
    archivedDecisionPath,
    archivedDecision
      .replace("status: archived", "status: active")
      .replace("alignment: null", "alignment: aligned"),
    "utf8"
  );
  assert.ok((await validateDecisionRecords({ workspaceRoot: tempRoot })).errors.some(
    (error) => error.includes("relationship 修订 target must be archived")
  ));
  await fs.writeFile(archivedDecisionPath, archivedDecision, "utf8");
  await fs.writeFile(indexPath, originalIndexText, "utf8");

  await fs.rm(indexPath);
  assert.match(
    await runSuccessfulCli([
      "sync-index",
      "--write",
      "--root",
      tempRoot
    ]),
    /Rebuilt .*decision-index\.json from decision Markdown files/
  );
  assert.equal((await readIndex(indexPath)).schemaVersion, 1);
  assert.deepEqual(
    (await validateDecisionRecords({ workspaceRoot: tempRoot })).errors,
    []
  );

  await fs.writeFile(
    currentDecisionPath,
    currentDecision.replace(
      "purpose: 确保生成后的 CLI 能在独立运行环境中读取并校验决策记录。\n",
      ""
    ),
    "utf8"
  );
  assert.ok((await validateDecisionRecords({ workspaceRoot: tempRoot })).errors.some(
    (error) => error.includes("frontmatter is missing purpose")
  ));
  await fs.writeFile(currentDecisionPath, currentDecision, "utf8");

  const ordinaryUnalignedDecision = currentDecision.replace(
    "alignment: aligned",
    "alignment: unaligned"
  );
  await fs.writeFile(currentDecisionPath, ordinaryUnalignedDecision, "utf8");
  await runSuccessfulCli([
    "sync-index",
    "--write",
    "--root",
    tempRoot
  ]);
  assert.deepEqual(
    (await validateDecisionRecords({ workspaceRoot: tempRoot })).errors,
    []
  );
  await fs.writeFile(currentDecisionPath, currentDecision, "utf8");
  await fs.writeFile(indexPath, originalIndexText, "utf8");

  await fs.writeFile(
    currentDecisionPath,
    currentDecision.replace("createdAt: 2026-07-11T14:15:16+08:00", "createdAt: null"),
    "utf8"
  );
  assert.ok((await validateDecisionRecords({ workspaceRoot: tempRoot })).errors.some(
    (error) => error.includes("frontmatter createdAt must not be null")
  ));
  await fs.writeFile(currentDecisionPath, currentDecision, "utf8");

  await fs.writeFile(
    currentDecisionPath,
    currentDecision.replace(
      "\n## 目的\n"
      + "- 确保生成后的 CLI 能在独立运行环境中读取并校验决策记录。\n",
      "\n"
    ),
    "utf8"
  );
  const listWithInvalidRecord = await runBundledCli([
    "list",
    "--root",
    tempRoot
  ]);
  assert.equal(listWithInvalidRecord.exitCode, 1);
  assert.equal(listWithInvalidRecord.stdout, "");
  assert.match(listWithInvalidRecord.stderr, /does not match source revision/);
  const traceWithInvalidRecord = await runBundledCli([
    "trace",
    currentRelativePath,
    "--root",
    tempRoot
  ]);
  assert.equal(traceWithInvalidRecord.exitCode, 1);
  assert.equal(traceWithInvalidRecord.stdout, "");
  assert.match(traceWithInvalidRecord.stderr, /does not match source revision/);
  await fs.writeFile(currentDecisionPath, currentDecision, "utf8");

  await fs.writeFile(
    currentDecisionPath,
    currentDecision.replace("title: 使用生成 CLI", "title: 很短"),
    "utf8"
  );
  assert.ok((await validateDecisionRecords({ workspaceRoot: tempRoot })).errors.some(
    (error) => error.includes("title projection must contain 4 to 100")
      && error.includes("actual 2")
  ));
  await fs.writeFile(currentDecisionPath, currentDecision, "utf8");

  await fs.writeFile(
    currentDecisionPath,
    currentDecision.replace(
      "relations:\n"
      + "  - type: 修订\n"
      + "    target: tooling/260710-use-source-cli.md\n",
      "relations: []\n"
    ),
    "utf8"
  );
  const traceWithRelationDrift = await runBundledCli([
    "trace",
    archivedRelativePath,
    "--root",
    tempRoot
  ]);
  assert.equal(traceWithRelationDrift.exitCode, 1);
  assert.equal(traceWithRelationDrift.stdout, "");
  assert.match(traceWithRelationDrift.stderr, /does not match source revision/);
  await fs.writeFile(currentDecisionPath, currentDecision, "utf8");

  await fs.writeFile(
    archivedDecisionPath,
    archivedDecision.replace(
      "relations: []\n",
      "relations:\n"
      + "  - type: 修订\n"
      + "    target: tooling/use-generated-cli.md\n"
    ),
    "utf8"
  );
  assert.ok((await validateDecisionRecords({ workspaceRoot: tempRoot })).errors.some(
    (error) => error.includes("Decision relations must not form a cycle")
  ));
  await fs.writeFile(archivedDecisionPath, archivedDecision, "utf8");

  const activateRelationTarget = await runBundledCli([
    "activate",
    archivedRelativePath,
    "--alignment",
    "aligned",
    "--root",
    tempRoot
  ]);
  assert.equal(activateRelationTarget.exitCode, 1);
  assert.match(
    activateRelationTarget.stderr,
    /relationship 修订 target must be archived/
  );
  assert.equal(await fs.readFile(indexPath, "utf8"), originalIndexText);
  assert.equal(await fs.readFile(archivedDecisionPath, "utf8"), archivedDecision);

  const unindexedBody = [
    "---",
    "title: 验证未登记成员",
    "status: active",
    "alignment: aligned",
    "createdAt: null",
    "purpose: 验证多条预写候选可以按显式目标逐条激活。",
    "background: 其他完整候选需要明确提醒，但不应阻断当前目标。",
    "decision: 单次只激活目标，索引排除其他候选且严格检查继续阻断。",
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
    "- 采用: 单次只激活目标，索引排除其他候选且严格检查继续阻断。",
    ""
  ].join("\n");
  const firstUnindexedRelativePath = "tooling/use-first-unindexed.md";
  const secondUnindexedRelativePath = "tooling/use-second-unindexed.md";
  const firstUnindexedPath = path.join(
    decisionsDirectory,
    firstUnindexedRelativePath
  );
  const secondUnindexedPath = path.join(
    decisionsDirectory,
    secondUnindexedRelativePath
  );
  await fs.writeFile(firstUnindexedPath, unindexedBody, "utf8");
  await fs.writeFile(secondUnindexedPath, unindexedBody, "utf8");
  const multipleUnindexedActivation = await runBundledCli([
    "activate",
    firstUnindexedRelativePath,
    "--alignment",
    "aligned",
    "--root",
    tempRoot
  ]);
  assert.equal(multipleUnindexedActivation.exitCode, 0);
  assert.match(
    multipleUnindexedActivation.stdout,
    /Activated new decision as aligned tooling\/use-first-unindexed\.md \[pending\]/
  );
  assert.match(
    multipleUnindexedActivation.stderr,
    /Unactivated decision candidate remains: tooling\/use-second-unindexed\.md/
  );
  assert.doesNotMatch(
    multipleUnindexedActivation.stderr,
    /Unactivated decision candidate remains: tooling\/use-first-unindexed\.md/
  );
  const firstActivationIndex = await readIndex(indexPath);
  findIndexEntry(firstActivationIndex, firstUnindexedRelativePath);
  assert.equal(
    firstActivationIndex.entries.some(
      (record) => record.id === secondUnindexedRelativePath
    ),
    false
  );

  const candidateCheck = await runBundledCli(["check", "--root", tempRoot]);
  assert.equal(candidateCheck.exitCode, 1);
  assert.match(
    candidateCheck.stderr,
    /Unactivated decision candidate must be activated or discarded before strict check: tooling\/use-second-unindexed\.md/
  );
  const candidateValidation = await validateDecisionRecords({
    workspaceRoot: tempRoot
  });
  assert.equal(candidateValidation.activationCandidateCount, 1);

  const candidateList = await runBundledCli(["list", "--root", tempRoot]);
  assert.equal(candidateList.exitCode, 0);
  assert.match(candidateList.stderr, /use-second-unindexed\.md/);
  assert.match(candidateList.stdout, /use-first-unindexed\.md/);
  assert.doesNotMatch(candidateList.stdout, /use-second-unindexed\.md/);

  const candidateSync = await runBundledCli([
    "sync-index",
    "--write",
    "--root",
    tempRoot
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
    tempRoot
  ]);
  assert.match(secondActivation, /Activated new decision as aligned/);
  const completeCandidateIndex = await readIndex(indexPath);
  findIndexEntry(completeCandidateIndex, firstUnindexedRelativePath);
  findIndexEntry(completeCandidateIndex, secondUnindexedRelativePath);
  await runSuccessfulCli(["check", "--root", tempRoot]);
  await fs.rm(firstUnindexedPath);
  await fs.rm(secondUnindexedPath);
  await fs.writeFile(indexPath, originalIndexText, "utf8");

  const targetCandidateRelativePath = "tooling/use-target-candidate.md";
  const orphanRelativePath = "tooling/use-orphan-established.md";
  const targetCandidatePath = path.join(
    decisionsDirectory,
    targetCandidateRelativePath
  );
  const orphanPath = path.join(decisionsDirectory, orphanRelativePath);
  await fs.writeFile(targetCandidatePath, unindexedBody, "utf8");
  await fs.writeFile(
    orphanPath,
    unindexedBody.replace(
      "createdAt: null",
      "createdAt: 2026-07-22T10:20:30+08:00"
    ),
    "utf8"
  );
  const activationWithOrphan = await runBundledCli([
    "activate",
    targetCandidateRelativePath,
    "--alignment",
    "aligned",
    "--root",
    tempRoot
  ]);
  assert.equal(activationWithOrphan.exitCode, 1);
  assert.match(
    activationWithOrphan.stderr,
    /does not include decision tooling\/use-orphan-established\.md/
  );
  assert.match(
    await fs.readFile(targetCandidatePath, "utf8"),
    /createdAt: null/
  );
  assert.equal(await fs.readFile(indexPath, "utf8"), originalIndexText);
  const syncWithOrphan = await runBundledCli([
    "sync-index",
    "--write",
    "--root",
    tempRoot
  ]);
  assert.equal(syncWithOrphan.exitCode, 1);
  assert.match(
    syncWithOrphan.stderr,
    /does not include decision tooling\/use-orphan-established\.md/
  );
  assert.equal(await fs.readFile(indexPath, "utf8"), originalIndexText);
  await fs.rm(targetCandidatePath);
  await fs.rm(orphanPath);

  const driftedDecision = currentDecision.replaceAll(
    "需要验证生成后的 CLI 能读取一套最小决策目录。",
    "需要验证索引同步会刷新全部记录的摘要投影。"
  );
  await fs.writeFile(currentDecisionPath, driftedDecision, "utf8");
  const driftedList = await runBundledCli(["list", "--root", tempRoot]);
  assert.equal(driftedList.exitCode, 1);
  assert.equal(driftedList.stdout, "");
  assert.match(driftedList.stderr, /does not match source revision/);
  await runSuccessfulCli([
    "sync-index",
    "--write",
    "--root",
    tempRoot
  ]);
  const synchronizedIndex = await readIndex(indexPath);
  const synchronizedEntry = findIndexEntry(synchronizedIndex, currentRelativePath);
  assert.equal(
    synchronizedEntry.background,
    "需要验证索引同步会刷新全部记录的摘要投影。"
  );
  assert.equal(synchronizedEntry.status, "active");
  assert.equal(synchronizedEntry.alignment, "aligned");
  assert.equal(
    synchronizedEntry.createdAt,
    "2026-07-11T14:15:16+08:00"
  );
  await fs.writeFile(currentDecisionPath, currentDecision, "utf8");
  await fs.writeFile(indexPath, originalIndexText, "utf8");

  const successorRelativePath = "tooling/use-bundled-cli.md";
  const successorPath = path.join(decisionsDirectory, successorRelativePath);
  const successorBody = [
    "---",
    "title: 使用打包 CLI",
    "status: active",
    "alignment: aligned",
    "createdAt: null",
    "purpose: 验证显式生命周期命令能够完成决策演进。",
    "background: 状态变化与关系已经拆分为彼此独立的操作。",
    "decision: 分别归档前序并激活新的打包 CLI 决策。",
    "relations:",
    "  - type: 替代",
    "    target: tooling/use-generated-cli.md",
    "---",
    "",
    "## 目的",
    "- 验证显式生命周期命令能够完成决策演进。",
    "",
    "## 背景",
    "- 状态变化与关系已经拆分为彼此独立的操作。",
    "",
    "## 决策",
    "- 采用: 分别归档前序并激活新的打包 CLI 决策。",
    ""
  ].join("\n");

  await fs.writeFile(successorPath, successorBody, "utf8");
  const hiddenSwitchAttempt = await runBundledCli([
    "activate",
    successorRelativePath,
    "--alignment",
    "aligned",
    "--root",
    tempRoot
  ]);
  assert.equal(hiddenSwitchAttempt.exitCode, 1);
  assert.match(
    hiddenSwitchAttempt.stderr,
    /relationship 替代 target must be archived/
  );
  assert.equal(await fs.readFile(indexPath, "utf8"), originalIndexText);
  await fs.rm(successorPath);

  await runSuccessfulCli([
    "archive",
    currentRelativePath,
    "--root",
    tempRoot
  ]);
  const archivedIndex = await readIndex(indexPath);
  assert.equal(findIndexEntry(archivedIndex, currentRelativePath).status, "archived");
  assert.equal(findIndexEntry(archivedIndex, currentRelativePath).alignment, null);
  assert.equal(findIndexEntry(archivedIndex, archivedRelativePath).status, "archived");

  await fs.writeFile(successorPath, successorBody, "utf8");
  await runSuccessfulCli([
    "activate",
    successorRelativePath,
    "--alignment",
    "aligned",
    "--root",
    tempRoot
  ]);
  const switched = await validateDecisionRecords({ workspaceRoot: tempRoot });
  assert.deepEqual(switched.errors, []);
  assert.equal(switched.activeCount, 1);
  assert.equal(switched.archivedCount, 2);
  const switchedIndex = await readIndex(indexPath);
  const successorEntry = findIndexEntry(switchedIndex, successorRelativePath);
  assert.equal(successorEntry.status, "active");
  assert.equal(successorEntry.alignment, "aligned");
  assert.match(
    successorEntry.createdAt,
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/
  );

  const directPredecessorTrace = await traceDecision(
    successorRelativePath,
    ["--direction", "predecessors", "--depth", "1"],
    tempRoot
  );
  assert.match(directPredecessorTrace, /tooling\/use-generated-cli\.md/);
  assert.doesNotMatch(directPredecessorTrace, /260710-use-source-cli/);

  const fullPredecessorTrace = await traceDecision(
    successorRelativePath,
    ["--direction", "predecessors", "--depth", "2"],
    tempRoot
  );
  assert.match(fullPredecessorTrace, /260710-use-source-cli/);
} finally {
  await fs.rm(tempRoot, { force: true, recursive: true });
}

const firstActivationRoot = await fs.mkdtemp(
  path.join(os.tmpdir(), "decision-records-first-")
);
try {
  initializeGitRepository(firstActivationRoot, { commit: false });
  const firstDecisionsDirectory = path.join(
    firstActivationRoot,
    "docs",
    "decisions"
  );
  const firstAreaDirectory = path.join(firstDecisionsDirectory, "tooling");
  await fs.mkdir(firstAreaDirectory, { recursive: true });
  const firstRelativePath = "tooling/use-first-index.md";
  const firstDecisionPath = path.join(firstDecisionsDirectory, firstRelativePath);
  await fs.writeFile(
    firstDecisionPath,
    [
      "---",
      "title: 使用首条索引",
      "status: active",
      "alignment: aligned",
      "createdAt: null",
      "purpose: 验证首次激活能够建立全生命周期索引。",
      "background: 决策根目录中只有一条已经确认的记录。",
      "decision: 激活该记录并保存秒级创建时间。",
      "relations: []",
      "---",
      "",
      "## 目的",
      "- 验证首次激活能够建立全生命周期索引。",
      "",
      "## 背景",
      "- 决策根目录中只有一条已经确认的记录。",
      "",
      "## 决策",
      "- 采用: 激活该记录并保存秒级创建时间。",
      ""
    ].join("\n"),
    "utf8"
  );
  const secondRelativePath = "tooling/use-second-index.md";
  await fs.writeFile(
    path.join(firstDecisionsDirectory, secondRelativePath),
    (await fs.readFile(firstDecisionPath, "utf8")).replace(
      "title: 使用首条索引",
      "title: 使用第二条索引"
    ),
    "utf8"
  );

  const firstActivation = await runBundledCli([
    "activate",
    firstRelativePath,
    "--alignment",
    "aligned",
    "--root",
    firstActivationRoot
  ]);
  assert.equal(firstActivation.exitCode, 0);
  assert.match(firstActivation.stdout, /Activated new decision as aligned/);
  assert.match(firstActivation.stderr, /use-second-index\.md/);
  const firstIndex = await readIndex(
    path.join(firstDecisionsDirectory, "decision-index.json")
  );
  assert.equal(firstIndex.schemaVersion, 1);
  assert.equal(firstIndex.namespace, "decisions");
  assert.equal(firstIndex.definitionVersion, 2);
  assert.equal(firstIndex.entries.length, 1);
  assert.equal(firstIndex.entries[0]!.state.status, "active");
  assert.equal(firstIndex.entries[0]!.state.alignment, "aligned");
  assert.match(
    firstIndex.entries[0]!.state.createdAt,
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/
  );
  const firstActivationValidation = await validateDecisionRecords({
    workspaceRoot: firstActivationRoot
  });
  assert.equal(firstActivationValidation.activationCandidateCount, 1);
  assert.ok(firstActivationValidation.errors.some(
    (error) => error.includes("use-second-index.md")
  ));

  await runSuccessfulCli([
    "activate",
    secondRelativePath,
    "--alignment",
    "aligned",
    "--root",
    firstActivationRoot
  ]);
  const completedFirstIndex = await readIndex(
    path.join(firstDecisionsDirectory, "decision-index.json")
  );
  assert.equal(completedFirstIndex.entries.length, 2);
  assert.deepEqual(
    (await validateDecisionRecords({ workspaceRoot: firstActivationRoot })).errors,
    []
  );
} finally {
  await fs.rm(firstActivationRoot, { force: true, recursive: true });
}

await import("./head-presence.test.ts");

console.log("Decision records CLI tests passed.");

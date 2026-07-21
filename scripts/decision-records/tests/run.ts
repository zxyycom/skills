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
  readIndex,
  runBundledCli,
  runSuccessfulCli,
  traceDecision,
  writeIndex
} from "./support.ts";
import "./generated-artifacts.test.ts";
import "./queries.test.ts";

const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "decision-records-test-"));
try {
  await fs.cp(fixtureRoot, tempRoot, { recursive: true });
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
    (error) => error.includes("must contain only schemaVersion and records")
  ));

  await fs.writeFile(
    indexPath,
    JSON.stringify({ schemaVersion: 4, records: [] }, null, 2) + "\n",
    "utf8"
  );
  const withUnsupportedSchemaVersion = await validateDecisionRecords({
    workspaceRoot: tempRoot
  });
  assert.ok(withUnsupportedSchemaVersion.errors.some(
    (error) => error.includes("schemaVersion must be 3")
  ));
  const listWithInvalidIndex = await runBundledCli([
    "list",
    "--root",
    tempRoot
  ]);
  assert.equal(listWithInvalidIndex.exitCode, 1);
  assert.match(listWithInvalidIndex.stderr, /Decision records command failed/);

  const invalidTimestampIndex = structuredClone(originalIndex);
  invalidTimestampIndex.records[0]!.createdAt = "2026-07-10";
  await writeIndex(indexPath, invalidTimestampIndex);
  assert.ok((await validateDecisionRecords({ workspaceRoot: tempRoot })).errors.some(
    (error) => error.includes("createdAt must be an RFC 3339 timestamp")
  ));

  const fractionalTimestampIndex = structuredClone(originalIndex);
  fractionalTimestampIndex.records[0]!.createdAt =
    "2026-07-10T09:10:11.123+08:00";
  await writeIndex(indexPath, fractionalTimestampIndex);
  assert.ok((await validateDecisionRecords({ workspaceRoot: tempRoot })).errors.some(
    (error) => error.includes("precise to seconds")
  ));

  const shortProjectionIndex = structuredClone(originalIndex);
  shortProjectionIndex.records[0]!.title = "短";
  await writeIndex(indexPath, shortProjectionIndex);
  assert.ok((await validateDecisionRecords({ workspaceRoot: tempRoot })).errors.some(
    (error) => error.includes("actual 1")
  ));

  const longProjectionIndex = structuredClone(originalIndex);
  longProjectionIndex.records[0]!.purpose = "长".repeat(101);
  await writeIndex(indexPath, longProjectionIndex);
  assert.ok((await validateDecisionRecords({ workspaceRoot: tempRoot })).errors.some(
    (error) => error.includes("actual 101")
  ));

  const withActiveRelationTargetIndex = structuredClone(originalIndex);
  findIndexEntry(withActiveRelationTargetIndex, archivedRelativePath).status = "active";
  await writeIndex(indexPath, withActiveRelationTargetIndex);
  assert.ok((await validateDecisionRecords({ workspaceRoot: tempRoot })).errors.some(
    (error) => error.includes("relationship 修订 target must be archived")
  ));
  await fs.writeFile(indexPath, originalIndexText, "utf8");

  await fs.writeFile(
    currentDecisionPath,
    currentDecision.replace(
      "\n## 索引摘要\n"
      + "- 目的: 确保生成后的 CLI 能在独立运行环境中读取并校验决策记录。\n"
      + "- 背景: 需要验证生成后的 CLI 能读取一套最小决策目录。\n"
      + "- 决策: 使用固定结构的测试夹具。\n",
      "\n"
    ),
    "utf8"
  );
  assert.ok((await validateDecisionRecords({ workspaceRoot: tempRoot })).errors.some(
    (error) => error.includes("is missing section ## 索引摘要")
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
  assert.equal(listWithInvalidRecord.exitCode, 0);
  assert.match(
    listWithInvalidRecord.stdout,
    /tooling\/use-generated-cli\.md \[invalid\]/
  );
  assert.match(listWithInvalidRecord.stderr, /is missing section ## 目的/);
  const traceWithInvalidRecord = await runBundledCli([
    "trace",
    currentRelativePath,
    "--root",
    tempRoot
  ]);
  assert.equal(traceWithInvalidRecord.exitCode, 0);
  assert.match(traceWithInvalidRecord.stdout, /tooling\/260710-use-source-cli\.md/);
  assert.match(traceWithInvalidRecord.stderr, /is missing section ## 目的/);
  await fs.writeFile(currentDecisionPath, currentDecision, "utf8");

  await fs.writeFile(
    currentDecisionPath,
    currentDecision.replace("# 使用生成 CLI", "# 很短"),
    "utf8"
  );
  assert.ok((await validateDecisionRecords({ workspaceRoot: tempRoot })).errors.some(
    (error) => error.includes("title must contain 4 to 100")
      && error.includes("actual 2")
  ));
  await fs.writeFile(currentDecisionPath, currentDecision, "utf8");

  await fs.writeFile(
    currentDecisionPath,
    currentDecision.replace(
      "\n## 关系\n- 修订: [使用源码 CLI](260710-use-source-cli.md)\n",
      "\n"
    ),
    "utf8"
  );
  const traceWithRelationDrift = await runBundledCli([
    "trace",
    archivedRelativePath,
    "--root",
    tempRoot
  ]);
  assert.equal(traceWithRelationDrift.exitCode, 0);
  assert.match(
    traceWithRelationDrift.stdout,
    /tooling\/use-generated-cli\.md --修订--> tooling\/260710-use-source-cli\.md/
  );
  assert.match(traceWithRelationDrift.stderr, /is out of sync/);
  await fs.writeFile(currentDecisionPath, currentDecision, "utf8");

  const cycleIndex = structuredClone(originalIndex);
  findIndexEntry(cycleIndex, archivedRelativePath).relations = [{
    target: currentRelativePath,
    type: "修订"
  }];
  await writeIndex(indexPath, cycleIndex);
  assert.ok((await validateDecisionRecords({ workspaceRoot: tempRoot })).errors.some(
    (error) => error.includes("Decision relations must not form a cycle")
  ));
  await fs.writeFile(indexPath, originalIndexText, "utf8");

  const activateRelationTarget = await runBundledCli([
    "activate",
    archivedRelativePath,
    "--root",
    tempRoot
  ]);
  assert.equal(activateRelationTarget.exitCode, 1);
  assert.match(
    activateRelationTarget.stderr,
    /relationship 修订 target must be archived/
  );
  assert.equal(await fs.readFile(indexPath, "utf8"), originalIndexText);

  const unindexedBody = [
    "# 验证未登记成员",
    "",
    "## 索引摘要",
    "- 目的: 验证严格登记事务只允许一个明确目标。",
    "- 背景: 其他未登记记录必须继续阻断索引更新。",
    "- 决策: 多个未登记记录存在时保持原索引不变。",
    "",
    "## 目的",
    "- 验证严格登记事务只允许一个明确目标。",
    "",
    "## 背景",
    "- 其他未登记记录必须继续阻断索引更新。",
    "",
    "## 决策",
    "- 采用: 多个未登记记录存在时保持原索引不变。",
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
    "--root",
    tempRoot
  ]);
  assert.equal(multipleUnindexedActivation.exitCode, 1);
  assert.match(
    multipleUnindexedActivation.stderr,
    /does not include decision tooling\/use-second-unindexed\.md/
  );
  assert.doesNotMatch(
    multipleUnindexedActivation.stderr,
    /does not include decision tooling\/use-first-unindexed\.md/
  );
  assert.equal(await fs.readFile(indexPath, "utf8"), originalIndexText);
  await fs.rm(firstUnindexedPath);
  await fs.rm(secondUnindexedPath);

  const driftedDecision = currentDecision.replaceAll(
    "需要验证生成后的 CLI 能读取一套最小决策目录。",
    "需要验证索引同步会刷新全部记录的摘要投影。"
  );
  await fs.writeFile(currentDecisionPath, driftedDecision, "utf8");
  const driftedList = await runBundledCli(["list", "--root", tempRoot]);
  assert.equal(driftedList.exitCode, 0);
  assert.match(driftedList.stderr, /is out of sync/);
  assert.match(driftedList.stdout, /需要验证生成后的 CLI 能读取一套最小决策目录/);
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
  assert.equal(
    synchronizedEntry.createdAt,
    "2026-07-11T14:15:16+08:00"
  );
  await fs.writeFile(currentDecisionPath, currentDecision, "utf8");
  await fs.writeFile(indexPath, originalIndexText, "utf8");

  const successorRelativePath = "tooling/use-bundled-cli.md";
  const successorPath = path.join(decisionsDirectory, successorRelativePath);
  const successorBody = [
    "# 使用打包 CLI",
    "",
    "## 索引摘要",
    "- 目的: 验证显式生命周期命令能够完成决策演进。",
    "- 背景: 状态变化与关系已经拆分为彼此独立的操作。",
    "- 决策: 分别归档前序并激活新的打包 CLI 决策。",
    "",
    "## 目的",
    "- 验证显式生命周期命令能够完成决策演进。",
    "",
    "## 背景",
    "- 状态变化与关系已经拆分为彼此独立的操作。",
    "",
    "## 决策",
    "- 采用: 分别归档前序并激活新的打包 CLI 决策。",
    "",
    "## 关系",
    "- 替代: [使用生成 CLI](use-generated-cli.md)",
    ""
  ].join("\n");

  await fs.writeFile(successorPath, successorBody, "utf8");
  const hiddenSwitchAttempt = await runBundledCli([
    "activate",
    successorRelativePath,
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
  assert.equal(findIndexEntry(archivedIndex, archivedRelativePath).status, "archived");

  await fs.writeFile(successorPath, successorBody, "utf8");
  await runSuccessfulCli([
    "activate",
    successorRelativePath,
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
  const firstDecisionsDirectory = path.join(
    firstActivationRoot,
    "docs",
    "decisions"
  );
  const firstAreaDirectory = path.join(firstDecisionsDirectory, "tooling");
  await fs.mkdir(firstAreaDirectory, { recursive: true });
  const firstRelativePath = "tooling/use-first-index.md";
  await fs.writeFile(
    path.join(firstDecisionsDirectory, firstRelativePath),
    [
      "# 使用首条索引",
      "",
      "## 索引摘要",
      "- 目的: 验证首次激活能够建立全生命周期索引。",
      "- 背景: 决策根目录中只有一条已经确认的记录。",
      "- 决策: 激活该记录并保存秒级创建时间。",
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

  const firstActivation = await runBundledCli([
    "activate",
    firstRelativePath,
    "--root",
    firstActivationRoot
  ]);
  assert.equal(firstActivation.exitCode, 0);
  assert.match(firstActivation.stdout, /Initialized .* and activated/);
  const firstIndex = await readIndex(
    path.join(firstDecisionsDirectory, "decision-index.json")
  );
  assert.equal(firstIndex.schemaVersion, 3);
  assert.equal(firstIndex.records.length, 1);
  assert.equal(firstIndex.records[0]!.status, "active");
  assert.match(
    firstIndex.records[0]!.createdAt,
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/
  );
  assert.deepEqual(
    (await validateDecisionRecords({ workspaceRoot: firstActivationRoot })).errors,
    []
  );
} finally {
  await fs.rm(firstActivationRoot, { force: true, recursive: true });
}

console.log("Decision records CLI tests passed.");

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { validateDecisionRecords } from "../src/index.ts";
import {
  decisionFilePath,
  readIndex,
  runBundledCli,
  runSuccessfulCli,
  withTemporaryWorkspace,
  writeTestDomainCatalog
} from "./support.ts";

test("first establishment creates a decision domain and current index", () => (
  withTemporaryWorkspace("first-establishment", async (workspaceRoot) => {
  const decisionsDirectory = path.join(workspaceRoot, "docs", "decisions");
  const firstDomainDirectory = path.join(
    decisionsDirectory,
    "decision-records"
  );
  await fs.mkdir(firstDomainDirectory, { recursive: true });
  await writeTestDomainCatalog(decisionsDirectory);

  const firstRelativePath = "decision-records/use-first-index.md";
  const firstDecisionPath = decisionFilePath(workspaceRoot, firstRelativePath);
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
  const secondRelativePath = "decision-records/use-second-index.md";
  await fs.writeFile(
    decisionFilePath(workspaceRoot, secondRelativePath),
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
    workspaceRoot
  ]);
  assert.equal(firstActivation.exitCode, 0);
  assert.match(firstActivation.stdout, /Activated new decision as aligned/);
  assert.match(firstActivation.stderr, /use-second-index\.md/);
  const indexPath = path.join(decisionsDirectory, "decision-index.json");
  const firstIndex = await readIndex(indexPath);
  assert.equal(firstIndex.schemaVersion, 2);
  assert.deepEqual(
    firstIndex.metadata.domains.map((domain) => domain.id),
    ["decision-records"]
  );
  assert.equal(firstIndex.namespace, "decisions");
  assert.equal(firstIndex.definitionVersion, 5);
  assert.equal(firstIndex.entries.length, 1);
  assert.equal(firstIndex.entries[0]!.state.status, "active");
  assert.equal(firstIndex.entries[0]!.state.alignment, "aligned");
  assert.match(
    firstIndex.entries[0]!.state.createdAt,
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/
  );
  const firstActivationValidation = await validateDecisionRecords({
    workspaceRoot
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
    workspaceRoot
  ]);
  const completedFirstIndex = await readIndex(indexPath);
  assert.equal(completedFirstIndex.entries.length, 2);
  assert.deepEqual(
    (await validateDecisionRecords({ workspaceRoot })).errors,
    []
  );
  })
));

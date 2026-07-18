import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateDecisionRecords } from "../src/index.ts";

const testsDirectory = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(testsDirectory, "../../..");
const fixtureRoot = path.join(testsDirectory, "fixtures", "valid");
const generatedCliPath = path.join(
  rootDir,
  "skills",
  "decision-records",
  "scripts",
  "decision-records.mjs"
);
const generatedUpdaterPath = path.join(
  rootDir,
  "skills",
  "decision-records",
  "scripts",
  "update-skill.cjs"
);

function traceDecision(
  decisionPath: string,
  options: string[] = [],
  workspaceRoot = fixtureRoot
): string {
  return execFileSync(
    "node",
    [
      generatedCliPath,
      "trace",
      decisionPath,
      ...options,
      "--root",
      workspaceRoot
    ],
    { encoding: "utf8" }
  );
}

const validation = await validateDecisionRecords({ workspaceRoot: fixtureRoot });
assert.deepEqual(validation.errors, []);
assert.equal(validation.areaCount, 1);
assert.equal(validation.decisionCount, 2);
assert.equal(validation.currentCount, 1);
assert.equal(validation.archivedCount, 1);

const cliOutput = execFileSync(
  "node",
  [generatedCliPath, "check", "--root", fixtureRoot],
  { encoding: "utf8" }
);
assert.match(cliOutput, /Decision records check passed \(1 areas, 2 decisions, 1 current, 1 archived\)\./);

const defaultCliOutput = execFileSync(
  "node",
  [generatedCliPath, "--root", fixtureRoot],
  { encoding: "utf8" }
);
assert.match(defaultCliOutput, /Decision records check passed/);

const currentList = execFileSync(
  "node",
  [generatedCliPath, "list", "--root", fixtureRoot],
  { encoding: "utf8" }
);
assert.match(currentList, /current\s+2026-07-11 tooling\/260711-use-generated-cli\.md/);
assert.doesNotMatch(currentList, /260710-use-source-cli/);

const archivedList = execFileSync(
  "node",
  [generatedCliPath, "list", "--archived", "--root", fixtureRoot],
  { encoding: "utf8" }
);
assert.match(archivedList, /archived\s+2026-07-10 tooling\/260710-use-source-cli\.md/);

const relationTrace = traceDecision("tooling/260710-use-source-cli.md");
assert.match(
  relationTrace,
  /tooling\/260711-use-generated-cli\.md --修订--> tooling\/260710-use-source-cli\.md/
);

const predecessorTrace = traceDecision(
  "tooling/260711-use-generated-cli.md",
  ["--direction", "predecessors"]
);
assert.match(predecessorTrace, /tooling\/260710-use-source-cli\.md/);

const noPredecessorTrace = traceDecision(
  "tooling/260710-use-source-cli.md",
  ["--direction", "predecessors"]
);
assert.doesNotMatch(noPredecessorTrace, /260711-use-generated-cli/);

const successorTrace = traceDecision(
  "tooling/260710-use-source-cli.md",
  ["--direction", "successors"]
);
assert.match(successorTrace, /tooling\/260711-use-generated-cli\.md/);

const invalidDepth = spawnSync(
  "node",
  [
    generatedCliPath,
    "trace",
    "tooling/260710-use-source-cli.md",
    "--depth",
    "-1",
    "--root",
    fixtureRoot
  ],
  { encoding: "utf8" }
);
assert.equal(invalidDepth.status, 2);
assert.match(invalidDepth.stderr, /must be a non-negative integer/);

const cliSource = await fs.readFile(generatedCliPath, "utf8");
assert.match(cliSource, /Repository: https:\/\/github\.com\/zxyycom\/skills/);
assert.match(cliSource, /Maintained source: https:\/\/github\.com\/zxyycom\/skills\/blob\/main\/scripts\/decision-records\/src\/cli\.ts/);
assert.match(cliSource, /Source path: scripts\/decision-records\/src\/cli\.ts/);
assert.match(cliSource, /Skill source directory: https:\/\/github\.com\/zxyycom\/skills\/tree\/main\/skills\/decision-records/);
assert.match(cliSource, /Rebuild: bun run sync:decision-records-cli/);

const updaterSource = await fs.readFile(generatedUpdaterPath, "utf8");
assert.match(updaterSource, /Repository: https:\/\/github\.com\/zxyycom\/skills/);
assert.match(updaterSource, /Maintained source: https:\/\/github\.com\/zxyycom\/skills\/blob\/main\/scripts\/templates\/update-skill\.ts/);
assert.match(updaterSource, /Rebuild: bun run sync:skill-updaters/);

const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "decision-records-test-"));
try {
  await fs.cp(fixtureRoot, tempRoot, { recursive: true });
  const copiedContractPath = path.join(
    tempRoot,
    "docs",
    "decisions",
    "decision-record-rules.md"
  );
  await fs.writeFile(copiedContractPath, "# Copied contract\n", "utf8");
  const withCopiedContract = await validateDecisionRecords({ workspaceRoot: tempRoot });
  assert.ok(withCopiedContract.errors.some(
    (error) => error.includes("root contains unsupported file decision-record-rules.md")
  ));
  await fs.rm(copiedContractPath);

  const decisionsDirectory = path.join(tempRoot, "docs", "decisions");
  const indexPath = path.join(decisionsDirectory, "decision-index.json");
  const originalIndex = await fs.readFile(indexPath, "utf8");
  const index = JSON.parse(originalIndex) as {
    current: Array<{
      background: string;
      decision: string;
      path: string;
      purpose: string;
      title: string;
    }>;
    schemaVersion: number;
  };

  await fs.writeFile(
    indexPath,
    JSON.stringify({ ...index, unsupported: true }, null, 2) + "\n",
    "utf8"
  );
  const withUnsupportedIndexField = await validateDecisionRecords({ workspaceRoot: tempRoot });
  assert.ok(withUnsupportedIndexField.errors.some(
    (error) => error.includes("must contain only schemaVersion and current")
  ));
  await fs.writeFile(indexPath, originalIndex, "utf8");

  await fs.writeFile(
    indexPath,
    JSON.stringify({ ...index, schemaVersion: 1 }, null, 2) + "\n",
    "utf8"
  );
  const withLegacySchemaVersion = await validateDecisionRecords({ workspaceRoot: tempRoot });
  assert.ok(withLegacySchemaVersion.errors.some(
    (error) => error.includes("schemaVersion must be 2")
  ));
  await fs.writeFile(indexPath, originalIndex, "utf8");

  index.current.push({
    background: "需要为直接关系校验提供一条可追溯的前序决定。",
    decision: "使用源码 CLI 作为测试夹具的初始做法。",
    path: "tooling/260710-use-source-cli.md",
    purpose: "为 CLI 关系和生命周期测试保留可追溯的前序判断。",
    title: "使用源码 CLI"
  });
  await fs.writeFile(indexPath, JSON.stringify(index, null, 2) + "\n", "utf8");
  const withCurrentRelationTarget = await validateDecisionRecords({ workspaceRoot: tempRoot });
  assert.ok(withCurrentRelationTarget.errors.some(
    (error) => error.includes("relationship 修订 target must be archived")
  ));
  await fs.writeFile(indexPath, originalIndex, "utf8");

  const currentRelativePath = "tooling/260711-use-generated-cli.md";
  const currentDecisionPath = path.join(
    decisionsDirectory,
    "tooling",
    "260711-use-generated-cli.md"
  );
  const currentDecision = await fs.readFile(currentDecisionPath, "utf8");
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
  const withoutExplicitSummary = await validateDecisionRecords({ workspaceRoot: tempRoot });
  assert.ok(withoutExplicitSummary.errors.some(
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
  const withoutPurposeSection = await validateDecisionRecords({ workspaceRoot: tempRoot });
  assert.ok(withoutPurposeSection.errors.some(
    (error) => error.includes("is missing section ## 目的")
  ));
  await fs.writeFile(currentDecisionPath, currentDecision, "utf8");

  await fs.writeFile(
    currentDecisionPath,
    currentDecision.replace(
      "- 目的: 确保生成后的 CLI 能在独立运行环境中读取并校验决策记录。\n",
      ""
    ),
    "utf8"
  );
  const withoutSummaryPurpose = await validateDecisionRecords({ workspaceRoot: tempRoot });
  assert.ok(withoutSummaryPurpose.errors.some(
    (error) => error.includes("must include field \"- 目的: <value>\"")
  ));
  await fs.writeFile(currentDecisionPath, currentDecision, "utf8");

  await fs.writeFile(
    currentDecisionPath,
    currentDecision.replace(
      "- 决策: 使用固定结构的测试夹具。",
      "- 决策: 使用固定结构的测试夹具。\n- area: tooling"
    ),
    "utf8"
  );
  const withExtraSummaryField = await validateDecisionRecords({ workspaceRoot: tempRoot });
  assert.ok(withExtraSummaryField.errors.some(
    (error) => error.includes("section ## 索引摘要 must contain only")
  ));
  await fs.writeFile(currentDecisionPath, currentDecision, "utf8");

  await fs.writeFile(
    currentDecisionPath,
    currentDecision.replace(
      "\n## 关系\n- 修订: [2026-07-10 - 使用源码 CLI](260710-use-source-cli.md)\n",
      "\n"
    ),
    "utf8"
  );
  const withoutIncomingRelation = await validateDecisionRecords({ workspaceRoot: tempRoot });
  assert.deepEqual(withoutIncomingRelation.errors, []);
  await fs.writeFile(currentDecisionPath, currentDecision, "utf8");

  const archivedDecisionPath = path.join(
    decisionsDirectory,
    "tooling",
    "260710-use-source-cli.md"
  );
  const archivedDecision = await fs.readFile(archivedDecisionPath, "utf8");
  await fs.writeFile(
    archivedDecisionPath,
    archivedDecision.trimEnd()
      + "\n\n## 关系\n"
      + "- 修订: [2026-07-11 - 使用生成 CLI](260711-use-generated-cli.md)\n",
    "utf8"
  );
  const withRelationCycle = await validateDecisionRecords({ workspaceRoot: tempRoot });
  assert.ok(withRelationCycle.errors.some(
    (error) => error.includes("Decision relations must not form a cycle")
  ));
  await fs.writeFile(archivedDecisionPath, archivedDecision, "utf8");

  await fs.writeFile(
    indexPath,
    originalIndex.replace("需要验证生成后的 CLI 能读取一套最小决策目录。", "过期背景"),
    "utf8"
  );
  const drifted = await validateDecisionRecords({ workspaceRoot: tempRoot });
  assert.ok(drifted.errors.some((error) => error.includes("is out of sync")));
  execFileSync(
    "node",
    [generatedCliPath, "sync-index", "--write", "--root", tempRoot],
    { encoding: "utf8" }
  );
  assert.deepEqual((await validateDecisionRecords({ workspaceRoot: tempRoot })).errors, []);

  execFileSync(
    "node",
    [generatedCliPath, "archive", currentRelativePath, "--root", tempRoot],
    { encoding: "utf8" }
  );
  const independentlyArchived = await validateDecisionRecords({ workspaceRoot: tempRoot });
  assert.deepEqual(independentlyArchived.errors, []);
  assert.equal(independentlyArchived.currentCount, 0);
  assert.equal(independentlyArchived.archivedCount, 2);
  await fs.writeFile(indexPath, originalIndex, "utf8");

  const successorRelativePath = "tooling/260712-use-bundled-cli.md";
  const successorPath = path.join(decisionsDirectory, successorRelativePath);
  await fs.writeFile(
    successorPath,
    [
      "# 2026-07-12 - 使用打包 CLI",
      "",
      "## 索引摘要",
      "- 目的: 验证 CLI 能以校验式事务切换当前决策。",
      "- 背景: 需要验证 JSON 当前索引的校验式成员更新。",
      "- 决策: 使用打包 CLI 作为新的当前决定。",
      "",
      "## 目的",
      "- 验证 CLI 能以校验式事务切换当前决策。",
      "",
      "## 背景",
      "- 需要验证 JSON 当前索引的校验式成员更新。",
      "",
      "## 决策",
      "- 采用: 使用打包 CLI 作为新的当前决定。",
      ""
    ].join("\n"),
    "utf8"
  );
  execFileSync(
    "node",
    [generatedCliPath, "activate", successorRelativePath, "--root", tempRoot],
    { encoding: "utf8" }
  );

  const unrelatedSwitch = spawnSync(
    "node",
    [
      generatedCliPath,
      "archive",
      currentRelativePath,
      "--by",
      successorRelativePath,
      "--root",
      tempRoot
    ],
    { encoding: "utf8" }
  );
  assert.equal(unrelatedSwitch.status, 1);
  assert.match(
    unrelatedSwitch.stderr,
    /must directly relate to every archived decision/
  );

  const successor = await fs.readFile(successorPath, "utf8");
  await fs.writeFile(
    successorPath,
    successor.trimEnd()
      + "\n\n## 关系\n"
      + "- 替代: [2026-07-11 - 使用生成 CLI](260711-use-generated-cli.md)\n",
    "utf8"
  );
  execFileSync(
    "node",
    [
      generatedCliPath,
      "archive",
      currentRelativePath,
      "--by",
      successorRelativePath,
      "--root",
      tempRoot
    ],
    { encoding: "utf8" }
  );
  const switched = await validateDecisionRecords({ workspaceRoot: tempRoot });
  assert.deepEqual(switched.errors, []);
  assert.equal(switched.currentCount, 1);
  assert.equal(switched.archivedCount, 2);

  const directPredecessorTrace = traceDecision(
    successorRelativePath,
    ["--direction", "predecessors", "--depth", "1"],
    tempRoot
  );
  assert.match(directPredecessorTrace, /260711-use-generated-cli/);
  assert.doesNotMatch(directPredecessorTrace, /260710-use-source-cli/);

  const fullPredecessorTrace = traceDecision(
    successorRelativePath,
    ["--direction", "predecessors", "--depth", "2"],
    tempRoot
  );
  assert.match(fullPredecessorTrace, /260710-use-source-cli/);
} finally {
  await fs.rm(tempRoot, { force: true, recursive: true });
}

console.log("Decision records CLI tests passed.");

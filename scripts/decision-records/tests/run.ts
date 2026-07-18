import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
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

const relationTrace = execFileSync(
  "node",
  [
    generatedCliPath,
    "trace",
    "tooling/260710-use-source-cli.md",
    "--root",
    fixtureRoot
  ],
  { encoding: "utf8" }
);
assert.match(
  relationTrace,
  /tooling\/260711-use-generated-cli\.md --修订--> tooling\/260710-use-source-cli\.md/
);

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
      title: string;
    }>;
    schemaVersion: number;
  };
  index.current.push({
    background: "需要为直接关系校验提供一条可追溯的前序决定。",
    decision: "使用源码 CLI 作为测试夹具的初始做法。",
    path: "tooling/260710-use-source-cli.md",
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
      "\n## 关系\n- 修订: [2026-07-10 - 使用源码 CLI](260710-use-source-cli.md)\n",
      "\n"
    ),
    "utf8"
  );
  const withoutIncomingRelation = await validateDecisionRecords({ workspaceRoot: tempRoot });
  assert.ok(withoutIncomingRelation.errors.some(
    (error) => error.includes("archived decisions must be referenced by a decision relation")
  ));
  await fs.writeFile(currentDecisionPath, currentDecision, "utf8");

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

  const successorRelativePath = "tooling/260712-use-bundled-cli.md";
  const successorPath = path.join(decisionsDirectory, successorRelativePath);
  await fs.writeFile(
    successorPath,
    [
      "# 2026-07-12 - 使用打包 CLI",
      "",
      "## 索引摘要",
      "- 背景: 需要验证 JSON 当前索引的校验式成员更新。",
      "- 决策: 使用打包 CLI 作为新的当前决定。",
      "",
      "## 背景",
      "- 需要验证 JSON 当前索引的校验式成员更新。",
      "",
      "## 决定",
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
} finally {
  await fs.rm(tempRoot, { force: true, recursive: true });
}

console.log("Decision records CLI tests passed.");

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { discardDecision } from "../src/discard-decision.ts";
import {
  expectedIndex,
  validateDecisionRecords
} from "../src/index.ts";
import {
  currentRelativePath,
  fixtureRoot,
  initializeGitRepository,
  readIndex,
  runBundledCli,
  runGit,
  runSuccessfulCli
} from "./support.ts";

const pendingRoot = await fs.mkdtemp(
  path.join(os.tmpdir(), "decision-records-head-")
);
try {
  await fs.cp(fixtureRoot, pendingRoot, { recursive: true });
  initializeGitRepository(pendingRoot);

  const decisionsDirectory = path.join(pendingRoot, "docs", "decisions");
  const indexPath = path.join(decisionsDirectory, "decision-index.json");
  const establishedDiscard = await runBundledCli([
    "discard",
    currentRelativePath,
    "--root",
    pendingRoot
  ]);
  assert.equal(establishedDiscard.exitCode, 1);
  assert.match(establishedDiscard.stderr, /already present in Git HEAD/);

  const pendingRelativePath = "pending-only/use-pending-decision.md";
  const pendingPath = path.join(decisionsDirectory, pendingRelativePath);
  const pendingBody = pendingDecisionBody();
  await fs.mkdir(path.dirname(pendingPath), { recursive: true });
  await fs.writeFile(pendingPath, pendingBody, "utf8");

  const activation = await runSuccessfulCli([
    "activate",
    pendingRelativePath,
    "--root",
    pendingRoot
  ]);
  assert.match(activation, /\[pending\]/);

  const pendingList = await runSuccessfulCli([
    "list",
    "--root",
    pendingRoot
  ]);
  assert.match(
    pendingList,
    /active \d{4}-\d{2}-\d{2} pending-only\/use-pending-decision\.md \[pending\]/
  );
  const pendingShow = await runSuccessfulCli([
    "show",
    pendingRelativePath,
    "--root",
    pendingRoot
  ]);
  assert.match(pendingShow, /^pending: true$/m);

  const pendingIndexText = await fs.readFile(indexPath, "utf8");
  const indexWithPendingTarget = await readIndex(indexPath);
  const pendingTarget = indexWithPendingTarget.records.find(
    (entry) => entry.path === pendingRelativePath
  );
  const establishedSource = indexWithPendingTarget.records.find(
    (entry) => entry.path === currentRelativePath
  );
  assert.ok(pendingTarget);
  assert.ok(establishedSource);
  pendingTarget.status = "archived";
  establishedSource.relations.push({
    target: pendingRelativePath,
    type: "替代"
  });
  await fs.writeFile(
    indexPath,
    JSON.stringify(indexWithPendingTarget, null, 2) + "\n",
    "utf8"
  );
  assert.ok((await validateDecisionRecords({ workspaceRoot: pendingRoot })).errors.some(
    (error) => error.includes(
      "relationship 替代 target is not present in Git HEAD: "
      + pendingRelativePath
    )
  ));
  await fs.writeFile(indexPath, pendingIndexText, "utf8");

  runGit(pendingRoot, [
    "add",
    "docs/decisions/decision-index.json",
    "docs/decisions/" + pendingRelativePath
  ]);
  const stagedList = await runSuccessfulCli([
    "list",
    "--root",
    pendingRoot
  ]);
  assert.match(stagedList, /use-pending-decision\.md \[pending\]/);

  const indexBeforeRejectedArchive = await fs.readFile(indexPath, "utf8");
  const pendingArchive = await runBundledCli([
    "archive",
    pendingRelativePath,
    "--root",
    pendingRoot
  ]);
  assert.equal(pendingArchive.exitCode, 1);
  assert.match(pendingArchive.stderr, /not present in Git HEAD/);
  assert.equal(await fs.readFile(indexPath, "utf8"), indexBeforeRejectedArchive);

  const rollbackValidation = await validateDecisionRecords({
    workspaceRoot: pendingRoot
  });
  assert.deepEqual(rollbackValidation.errors, []);
  const rollbackScan = rollbackValidation.scan;
  assert.ok(rollbackScan.index);
  const rollbackRecord = rollbackScan.records.find(
    (record) => record.relativePath === pendingRelativePath
  );
  assert.ok(rollbackRecord);
  const rollbackIndex = expectedIndex(
    rollbackScan,
    rollbackScan.index.records.filter(
      (entry) => entry.path !== pendingRelativePath
    )
  );
  assert.deepEqual(rollbackIndex.errors, []);
  assert.ok(rollbackIndex.text);
  assert.deepEqual(
    await discardDecision({
      indexText: rollbackIndex.text,
      record: rollbackRecord,
      scan: rollbackScan,
      validate: async () => ["Injected discard validation failure."]
    }),
    ["Injected discard validation failure."]
  );
  assert.equal(await fs.readFile(pendingPath, "utf8"), pendingBody);
  assert.equal(await fs.readFile(indexPath, "utf8"), indexBeforeRejectedArchive);
  assert.equal(await fileExists(path.dirname(pendingPath)), true);

  const discard = await runSuccessfulCli([
    "discard",
    pendingRelativePath,
    "--root",
    pendingRoot
  ]);
  assert.match(discard, /Discarded pending decision/);
  assert.match(discard, /Restage decision files before committing/);
  assert.equal(await fileExists(pendingPath), false);
  assert.equal(await fileExists(path.dirname(pendingPath)), false);
  assert.equal(
    (await readIndex(indexPath)).records.some(
      (entry) => entry.path === pendingRelativePath
    ),
    false
  );
  assert.match(
    runGit(pendingRoot, ["diff", "--cached", "--name-only"]),
    /docs\/decisions\/pending-only\/use-pending-decision\.md/
  );

  const committedRelativePath = "tooling/use-committed-decision.md";
  await fs.writeFile(
    path.join(decisionsDirectory, committedRelativePath),
    pendingDecisionBody().replaceAll("待提交", "提交后"),
    "utf8"
  );
  assert.match(
    await runSuccessfulCli([
      "activate",
      committedRelativePath,
      "--root",
      pendingRoot
    ]),
    /\[pending\]/
  );
  runGit(pendingRoot, ["add", "-A"]);
  runGit(pendingRoot, [
    "commit",
    "--quiet",
    "--no-gpg-sign",
    "-m",
    "Commit pending decision"
  ]);
  const committedShow = await runSuccessfulCli([
    "show",
    committedRelativePath,
    "--root",
    pendingRoot
  ]);
  assert.match(committedShow, /^pending: false$/m);
  await runSuccessfulCli([
    "archive",
    committedRelativePath,
    "--root",
    pendingRoot
  ]);

  const renamedRelativePath = "tooling/use-generated-cli-renamed.md";
  await fs.rename(
    path.join(decisionsDirectory, currentRelativePath),
    path.join(decisionsDirectory, renamedRelativePath)
  );
  const renamedIndex = await readIndex(indexPath);
  const renamedEntry = renamedIndex.records.find(
    (entry) => entry.path === currentRelativePath
  );
  assert.ok(renamedEntry);
  renamedEntry.path = renamedRelativePath;
  renamedIndex.records.sort((left, right) => left.path.localeCompare(right.path));
  await fs.writeFile(
    indexPath,
    JSON.stringify(renamedIndex, null, 2) + "\n",
    "utf8"
  );

  const renamedValidation = await validateDecisionRecords({
    workspaceRoot: pendingRoot
  });
  assert.ok(renamedValidation.errors.some(
    (error) => error.includes(
      "Decision file present in Git HEAD is missing from the working tree: "
      + currentRelativePath
    )
  ));
  const renamedList = await runBundledCli([
    "list",
    "--root",
    pendingRoot
  ]);
  assert.equal(renamedList.exitCode, 0);
  assert.match(renamedList.stderr, /established decision paths must not be deleted or renamed/);
  assert.match(renamedList.stdout, /use-generated-cli-renamed\.md \[pending\]/);

  const renamedSync = await runBundledCli([
    "sync-index",
    "--root",
    pendingRoot
  ]);
  assert.equal(renamedSync.exitCode, 1);
  assert.match(renamedSync.stderr, /established decision paths must not be deleted or renamed/);
  assert.doesNotMatch(renamedSync.stdout, /Decision index is up to date/);

  const renamedActivate = await runBundledCli([
    "activate",
    renamedRelativePath,
    "--root",
    pendingRoot
  ]);
  assert.equal(renamedActivate.exitCode, 1);
  assert.match(
    renamedActivate.stderr,
    /established decision paths must not be deleted or renamed/
  );
  assert.doesNotMatch(renamedActivate.stdout, /already active/);
} finally {
  await fs.rm(pendingRoot, { force: true, recursive: true });
}

const nonGitRoot = await fs.mkdtemp(
  path.join(os.tmpdir(), "decision-records-non-git-")
);
try {
  await fs.cp(fixtureRoot, nonGitRoot, { recursive: true });
  const nonGitList = await runBundledCli([
    "list",
    "--root",
    nonGitRoot
  ]);
  assert.equal(nonGitList.exitCode, 1);
  assert.match(nonGitList.stderr, /Git HEAD decision paths are unavailable/);
  assert.ok((await validateDecisionRecords({ workspaceRoot: nonGitRoot })).errors.some(
    (error) => error.includes("Git HEAD decision paths are unavailable")
  ));
} finally {
  await fs.rm(nonGitRoot, { force: true, recursive: true });
}

const brokenHeadRoot = await fs.mkdtemp(
  path.join(os.tmpdir(), "decision-records-broken-head-")
);
try {
  await fs.cp(fixtureRoot, brokenHeadRoot, { recursive: true });
  initializeGitRepository(brokenHeadRoot);
  const symbolicHead = runGit(brokenHeadRoot, ["symbolic-ref", "HEAD"]).trim();
  assert.match(symbolicHead, /^refs\/heads\//);
  await fs.writeFile(
    path.join(brokenHeadRoot, ".git", ...symbolicHead.split("/")),
    "1".repeat(40) + "\n",
    "utf8"
  );

  const brokenHeadList = await runBundledCli([
    "list",
    "--root",
    brokenHeadRoot
  ]);
  assert.equal(brokenHeadList.exitCode, 1);
  assert.match(brokenHeadList.stderr, /Git HEAD decision paths are unavailable/);
  assert.doesNotMatch(brokenHeadList.stdout, /\[pending\]/);

  const brokenHeadDiscard = await runBundledCli([
    "discard",
    currentRelativePath,
    "--root",
    brokenHeadRoot
  ]);
  assert.equal(brokenHeadDiscard.exitCode, 1);
  assert.match(brokenHeadDiscard.stderr, /Git HEAD decision paths are unavailable/);
  assert.equal(
    await fileExists(path.join(
      brokenHeadRoot,
      "docs",
      "decisions",
      currentRelativePath
    )),
    true
  );
} finally {
  await fs.rm(brokenHeadRoot, { force: true, recursive: true });
}

function pendingDecisionBody(): string {
  return [
    "# 使用待提交决策",
    "",
    "## 索引摘要",
    "- 目的: 验证待提交标记只由 Git HEAD 路径存在性临时推导。",
    "- 背景: 工作区和暂存区都不能代表决策已经进入正式历史。",
    "- 决策: 新决策在首次提交前保持可见并标记为 pending。",
    "",
    "## 目的",
    "- 验证待提交标记只由 Git HEAD 路径存在性临时推导。",
    "",
    "## 背景",
    "- 工作区和暂存区都不能代表决策已经进入正式历史。",
    "",
    "## 决策",
    "- 采用: 新决策在首次提交前保持可见并标记为 pending。",
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

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { readDecisionSourceRevision } from "../src/decision-state-index.ts";
import { validateDecisionRecords } from "../src/index.ts";
import {
  currentRelativePath,
  findIndexEntry,
  fixtureRoot,
  initializeGitRepository,
  readIndex,
  runBundledCli,
  runGit,
  runSourceCli,
  runSuccessfulCli,
  runSuccessfulSourceCli
} from "./support.ts";

const pendingRoot = await fs.mkdtemp(
  path.join(os.tmpdir(), "decision-records-head-")
);
try {
  await fs.cp(fixtureRoot, pendingRoot, { recursive: true });
  initializeGitRepository(pendingRoot);

  const decisionsDirectory = path.join(pendingRoot, "docs", "decisions");
  const indexPath = path.join(decisionsDirectory, "decision-index.json");
  const establishedDiscard = await runSourceCli([
    "discard",
    currentRelativePath,
    "--root",
    pendingRoot
  ]);
  assert.equal(establishedDiscard.exitCode, 1);
  assert.match(establishedDiscard.stderr, /already present in Git HEAD/);

  const candidateRelativePath = "candidate-only/use-unactivated-decision.md";
  const candidatePath = path.join(decisionsDirectory, candidateRelativePath);
  const indexBeforeCandidateDiscard = await fs.readFile(indexPath, "utf8");
  await fs.mkdir(path.dirname(candidatePath), { recursive: true });
  await fs.writeFile(candidatePath, pendingDecisionBody(), "utf8");
  const candidateDiscard = await runSuccessfulSourceCli([
    "discard",
    candidateRelativePath,
    "--root",
    pendingRoot
  ]);
  assert.match(candidateDiscard, /Discarded unactivated decision candidate/);
  assert.equal(await fileExists(candidatePath), false);
  assert.equal(await fileExists(path.dirname(candidatePath)), false);
  assert.equal(await fs.readFile(indexPath, "utf8"), indexBeforeCandidateDiscard);

  const invalidCandidateRelativePath = "candidate-only/use-invalid-decision.md";
  const invalidCandidatePath = path.join(
    decisionsDirectory,
    invalidCandidateRelativePath
  );
  const invalidCandidateBody = pendingDecisionBody().replace(
    "\n## 目的\n"
      + "- 验证待提交标记只由 Git HEAD 路径存在性临时推导。\n",
    "\n"
  );
  await fs.mkdir(path.dirname(invalidCandidatePath), { recursive: true });
  await fs.writeFile(invalidCandidatePath, invalidCandidateBody, "utf8");
  const invalidCandidateDiscard = await runSuccessfulSourceCli([
    "discard",
    invalidCandidateRelativePath,
    "--root",
    pendingRoot
  ]);
  assert.match(invalidCandidateDiscard, /Discarded unregistered decision file/);
  assert.equal(await fileExists(invalidCandidatePath), false);
  assert.equal(await fileExists(path.dirname(invalidCandidatePath)), false);
  assert.equal(await fs.readFile(indexPath, "utf8"), indexBeforeCandidateDiscard);

  const pendingRelativePath = "pending-only/use-pending-decision.md";
  const pendingPath = path.join(decisionsDirectory, pendingRelativePath);
  const pendingBody = pendingDecisionBody();
  await fs.mkdir(path.dirname(pendingPath), { recursive: true });
  await fs.writeFile(pendingPath, pendingBody, "utf8");

  const activation = await runSuccessfulCli([
    "activate",
    pendingRelativePath,
    "--alignment",
    "aligned",
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
    /active aligned \d{4}-\d{2}-\d{2} pending-only\/use-pending-decision\.md \[pending\]/
  );
  const pendingShow = await runSuccessfulCli([
    "show",
    pendingRelativePath,
    "--root",
    pendingRoot
  ]);
  assert.match(pendingShow, /^pending: true$/m);

  const establishedPath = path.join(decisionsDirectory, currentRelativePath);
  const establishedBody = await fs.readFile(establishedPath, "utf8");
  await fs.writeFile(
    establishedPath,
    establishedBody.replace(
      "- 修订: [使用源码 CLI](260710-use-source-cli.md)",
      "- 修订: [使用源码 CLI](260710-use-source-cli.md)\n"
        + "- 替代: [使用待提交决策](../pending-only/use-pending-decision.md)"
    ),
    "utf8"
  );
  assert.ok((await validateDecisionRecords({ workspaceRoot: pendingRoot })).errors.some(
    (error) => error.includes(
      "relationship 替代 target is not present in Git HEAD: "
      + pendingRelativePath
    )
  ));
  const referencedPendingBody = await fs.readFile(pendingPath, "utf8");
  const indexBeforeReferencedDiscard = await fs.readFile(indexPath, "utf8");
  const referencedDiscard = await runSourceCli([
    "discard",
    pendingRelativePath,
    "--root",
    pendingRoot
  ]);
  assert.equal(referencedDiscard.exitCode, 1);
  assert.match(referencedDiscard.stderr, /still referenced/);
  assert.match(referencedDiscard.stderr, new RegExp(currentRelativePath));
  assert.equal(await fs.readFile(pendingPath, "utf8"), referencedPendingBody);
  assert.equal(await fs.readFile(indexPath, "utf8"), indexBeforeReferencedDiscard);
  assert.equal(
    await fs.readFile(establishedPath, "utf8"),
    establishedBody.replace(
      "- 修订: [使用源码 CLI](260710-use-source-cli.md)",
      "- 修订: [使用源码 CLI](260710-use-source-cli.md)\n"
        + "- 替代: [使用待提交决策](../pending-only/use-pending-decision.md)"
    )
  );
  await fs.writeFile(establishedPath, establishedBody, "utf8");

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

  const invalidEstablishedBody = establishedBody.replace(
    "\n## 目的\n"
      + "- 确保生成后的 CLI 能在独立运行环境中读取并校验决策记录。\n",
    "\n"
  );
  const bodyBeforeFailedDiscard = await fs.readFile(pendingPath, "utf8");
  const indexBeforeFailedDiscard = await fs.readFile(indexPath, "utf8");
  await fs.writeFile(establishedPath, invalidEstablishedBody, "utf8");
  const failedDiscard = await runSourceCli([
    "discard",
    pendingRelativePath,
    "--root",
    pendingRoot
  ]);
  assert.equal(failedDiscard.exitCode, 1);
  assert.match(failedDiscard.stderr, /is missing section ## 目的/);
  assert.equal(await fs.readFile(pendingPath, "utf8"), bodyBeforeFailedDiscard);
  assert.equal(await fs.readFile(indexPath, "utf8"), indexBeforeFailedDiscard);
  assert.equal(await fileExists(path.dirname(pendingPath)), true);
  assert.equal(await fs.readFile(establishedPath, "utf8"), invalidEstablishedBody);
  await fs.writeFile(establishedPath, establishedBody, "utf8");

  const discard = await runSuccessfulSourceCli([
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
    (await readIndex(indexPath)).entries.some(
      (entry) => entry.id === pendingRelativePath
    ),
    false
  );
  assert.match(
    runGit(pendingRoot, ["diff", "--cached", "--name-only"]),
    /docs\/decisions\/pending-only\/use-pending-decision\.md/
  );

  const committedRelativePath = "tooling/use-committed-decision.md";
  const committedPath = path.join(decisionsDirectory, committedRelativePath);
  await fs.writeFile(
    committedPath,
    pendingDecisionBody("unaligned").replaceAll("待提交", "提交后"),
    "utf8"
  );
  assert.match(
    await runSuccessfulSourceCli([
      "activate",
      committedRelativePath,
      "--alignment",
      "unaligned",
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
  const unalignedMarkdown = await fs.readFile(committedPath, "utf8");
  const unalignedEntry = structuredClone(findIndexEntry(
    await readIndex(indexPath),
    committedRelativePath
  ));
  assert.equal(unalignedEntry.alignment, "unaligned");

  const committedShow = await runSuccessfulSourceCli([
    "show",
    committedRelativePath,
    "--root",
    pendingRoot
  ]);
  assert.match(committedShow, /^pending: false$/m);
  assert.match(committedShow, /^alignment: unaligned$/m);
  const unalignedList = await runSuccessfulSourceCli([
    "list",
    "--alignment",
    "unaligned",
    "--root",
    pendingRoot
  ]);
  assert.match(
    unalignedList,
    /active unaligned .*tooling\/use-committed-decision\.md/
  );
  const unalignedTrace = await runSuccessfulSourceCli([
    "trace",
    committedRelativePath,
    "--root",
    pendingRoot
  ]);
  assert.match(
    unalignedTrace,
    /- active unaligned tooling\/use-committed-decision\.md/
  );

  await runSuccessfulSourceCli([
    "mark-aligned",
    committedRelativePath,
    "--root",
    pendingRoot
  ]);
  const alignedMarkdown = await fs.readFile(committedPath, "utf8");
  assert.equal(
    alignedMarkdown,
    unalignedMarkdown.replace("alignment: unaligned", "alignment: aligned")
  );
  const alignedEntry = findIndexEntry(
    await readIndex(indexPath),
    committedRelativePath
  );
  assert.deepEqual(alignedEntry, {
    ...unalignedEntry,
    alignment: "aligned"
  });

  const alignedShow = await runSuccessfulSourceCli([
    "show",
    committedRelativePath,
    "--root",
    pendingRoot
  ]);
  assert.match(alignedShow, /^alignment: aligned$/m);
  await runSuccessfulSourceCli([
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
  const renamedEntry = renamedIndex.entries.find(
    (entry) => entry.id === currentRelativePath
  );
  assert.ok(renamedEntry);
  renamedEntry.id = renamedRelativePath;
  renamedEntry.state.path = renamedRelativePath;
  renamedIndex.entries.sort((left, right) => left.id.localeCompare(right.id));
  renamedIndex.sourceRevision = await readDecisionSourceRevision(
    decisionsDirectory,
    renamedIndex.entries.map((entry) => entry.id)
  );
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
    "--alignment",
    "aligned",
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

const onlyCandidateRoot = await fs.mkdtemp(
  path.join(os.tmpdir(), "decision-records-only-candidate-")
);
try {
  initializeGitRepository(onlyCandidateRoot, { commit: false });
  const decisionsDirectory = path.join(onlyCandidateRoot, "docs", "decisions");
  const relativePath = "only-topic/use-only-candidate.md";
  const decisionPath = path.join(decisionsDirectory, relativePath);
  await fs.mkdir(path.dirname(decisionPath), { recursive: true });
  await fs.writeFile(decisionPath, pendingDecisionBody(), "utf8");

  const discard = await runSuccessfulSourceCli([
    "discard",
    relativePath,
    "--root",
    onlyCandidateRoot
  ]);
  assert.match(discard, /Discarded unactivated decision candidate/);
  assert.equal(await fileExists(decisionsDirectory), false);
} finally {
  await fs.rm(onlyCandidateRoot, { force: true, recursive: true });
}

const committedCandidateRoot = await fs.mkdtemp(
  path.join(os.tmpdir(), "decision-records-committed-candidate-")
);
try {
  await fs.cp(fixtureRoot, committedCandidateRoot, { recursive: true });
  initializeGitRepository(committedCandidateRoot);
  const relativePath = "committed-candidate/use-invalid-candidate.md";
  const decisionPath = path.join(
    committedCandidateRoot,
    "docs",
    "decisions",
    relativePath
  );
  const candidateBody = pendingDecisionBody();
  await fs.mkdir(path.dirname(decisionPath), { recursive: true });
  await fs.writeFile(decisionPath, candidateBody, "utf8");
  runGit(committedCandidateRoot, [
    "add",
    "docs/decisions/" + relativePath
  ]);
  runGit(committedCandidateRoot, [
    "commit",
    "--quiet",
    "--no-gpg-sign",
    "-m",
    "Commit invalid activation candidate"
  ]);

  const check = await runSourceCli([
    "check",
    "--root",
    committedCandidateRoot
  ]);
  assert.equal(check.exitCode, 1);
  assert.match(
    check.stderr,
    /present in Git HEAD cannot remain an unactivated candidate/
  );

  const activation = await runSourceCli([
    "activate",
    relativePath,
    "--alignment",
    "aligned",
    "--root",
    committedCandidateRoot
  ]);
  assert.equal(activation.exitCode, 1);
  assert.match(
    activation.stderr,
    /present in Git HEAD cannot be activated as a new decision candidate/
  );
  assert.equal(await fs.readFile(decisionPath, "utf8"), candidateBody);
} finally {
  await fs.rm(committedCandidateRoot, { force: true, recursive: true });
}

const onlyPendingRoot = await fs.mkdtemp(
  path.join(os.tmpdir(), "decision-records-only-pending-")
);
try {
  initializeGitRepository(onlyPendingRoot, { commit: false });
  const decisionsDirectory = path.join(onlyPendingRoot, "docs", "decisions");
  const relativePath = "only-topic/use-only-pending.md";
  const decisionPath = path.join(decisionsDirectory, relativePath);
  const indexPath = path.join(decisionsDirectory, "decision-index.json");
  await fs.mkdir(path.dirname(decisionPath), { recursive: true });
  await fs.writeFile(decisionPath, pendingDecisionBody(), "utf8");
  await runSuccessfulCli([
    "activate",
    relativePath,
    "--alignment",
    "aligned",
    "--root",
    onlyPendingRoot
  ]);
  assert.equal(await fileExists(indexPath), true);

  const discard = await runSuccessfulSourceCli([
    "discard",
    relativePath,
    "--root",
    onlyPendingRoot
  ]);
  assert.match(discard, /Discarded pending decision/);
  assert.equal(await fileExists(decisionsDirectory), false);
} finally {
  await fs.rm(onlyPendingRoot, { force: true, recursive: true });
}

const invalidIdentityRoot = await fs.mkdtemp(
  path.join(os.tmpdir(), "decision-records-invalid-identity-")
);
try {
  initializeGitRepository(invalidIdentityRoot, { commit: false });
  const decisionsDirectory = path.join(invalidIdentityRoot, "docs", "decisions");
  const relativePath = "only-topic/260722-use-invalid-identity.md";
  const decisionPath = path.join(decisionsDirectory, relativePath);
  const indexPath = path.join(decisionsDirectory, "decision-index.json");
  const candidateBody = pendingDecisionBody();
  await fs.mkdir(path.dirname(decisionPath), { recursive: true });
  await fs.writeFile(decisionPath, candidateBody, "utf8");

  const activation = await runSourceCli([
    "activate",
    relativePath,
    "--alignment",
    "aligned",
    "--root",
    invalidIdentityRoot
  ]);
  assert.equal(activation.exitCode, 1);
  assert.match(
    activation.stderr,
    /New decision identity path must use kebab-case semantic slugs without date tokens/
  );
  assert.equal(await fs.readFile(decisionPath, "utf8"), candidateBody);
  assert.equal(await fileExists(indexPath), false);
} finally {
  await fs.rm(invalidIdentityRoot, { force: true, recursive: true });
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

  const brokenHeadDiscard = await runSourceCli([
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

function pendingDecisionBody(
  alignment: "aligned" | "unaligned" = "aligned"
): string {
  return [
    "---",
    "status: active",
    "alignment: " + alignment,
    "createdAt: null",
    "---",
    "",
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

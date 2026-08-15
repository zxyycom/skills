import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  candidateDecisionBody,
  currentRelativePath,
  decisionFilePath,
  fileExists,
  findIndexEntry,
  readIndex,
  runBundledCli,
  runSourceCli,
  withFixtureWorkspace
} from "./support.ts";

test("activation and archive transitions preserve content and index atomicity", () => (
  withFixtureWorkspace("activation-archive", async (workspaceRoot) => {
  assert.equal(await fileExists(path.join(workspaceRoot, ".git")), false);

  const decisionsDirectory = path.join(workspaceRoot, "docs", "decisions");
  const indexPath = path.join(decisionsDirectory, "decision-index.json");
  const establishedPath = decisionFilePath(workspaceRoot, currentRelativePath);
  const establishedText = await fs.readFile(establishedPath, "utf8");
  const originalIndexText = await fs.readFile(indexPath, "utf8");

  const rejectedAlignmentRollback = await runBundledCli([
    "activate",
    currentRelativePath,
    "--alignment",
    "unaligned",
    "--root",
    workspaceRoot
  ]);
  assert.equal(rejectedAlignmentRollback.exitCode, 1);
  assert.match(
    rejectedAlignmentRollback.stderr,
    /cannot be changed back to unaligned/
  );
  assert.equal(await fs.readFile(establishedPath, "utf8"), establishedText);
  assert.equal(await fs.readFile(indexPath, "utf8"), originalIndexText);

  const lifecycleRelativePath =
    "use-markdown-establishment.md";
  const lifecyclePath = decisionFilePath(
    workspaceRoot,
    lifecycleRelativePath
  );
  await fs.mkdir(path.dirname(lifecyclePath), { recursive: true });
  await fs.writeFile(
    lifecyclePath,
    candidateDecisionBody(),
    "utf8"
  );

  const activation = await runSourceCli([
    "activate",
    lifecycleRelativePath,
    "--alignment",
    "unaligned",
    "--root",
    workspaceRoot
  ]);
  assert.equal(activation.exitCode, 0, activation.stderr);
  assert.doesNotMatch(activation.stdout, /pending/i);
  assert.doesNotMatch(activation.stderr, /pending/i);
  const activatedText = await fs.readFile(lifecyclePath, "utf8");
  const createdAt = activatedText.match(/^createdAt: (.+)$/m)?.[1];
  assert.match(
    createdAt ?? "",
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/
  );
  findIndexEntry(await readIndex(indexPath), lifecycleRelativePath);

  const repeatedActivation = await runSourceCli([
    "activate",
    lifecycleRelativePath,
    "--alignment",
    "unaligned",
    "--root",
    workspaceRoot
  ]);
  assert.equal(repeatedActivation.exitCode, 0, repeatedActivation.stderr);
  assert.match(repeatedActivation.stdout, /already active and unaligned/);
  assert.equal(await fs.readFile(lifecyclePath, "utf8"), activatedText);

  await fs.rm(indexPath);
  const markedAligned = await runSourceCli([
    "mark-aligned",
    lifecycleRelativePath,
    "--root",
    workspaceRoot
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
    workspaceRoot
  ]);
  assert.equal(archived.exitCode, 0, archived.stderr);
  const archivedState = findIndexEntry(
    await readIndex(indexPath),
    lifecycleRelativePath
  );
  assert.equal(archivedState.status, "archived");
  assert.equal(archivedState.alignment, "aligned");
  assert.equal(archivedState.createdAt, createdAt);

  const archivedDiscard = await runSourceCli([
    "discard",
    lifecycleRelativePath,
    "--root",
    workspaceRoot
  ]);
  assert.equal(archivedDiscard.exitCode, 1);
  assert.match(archivedDiscard.stderr, /Cannot discard established decision/);

  const reactivated = await runSourceCli([
    "activate",
    lifecycleRelativePath,
    "--alignment",
    "aligned",
    "--root",
    workspaceRoot
  ]);
  assert.equal(reactivated.exitCode, 0, reactivated.stderr);
  assert.equal(
    findIndexEntry(await readIndex(indexPath), lifecycleRelativePath).createdAt,
    createdAt
  );

  for (const args of [
    ["check", "--root", workspaceRoot],
    ["list", "--root", workspaceRoot],
    ["show", lifecycleRelativePath, "--root", workspaceRoot],
    ["trace", lifecycleRelativePath, "--root", workspaceRoot],
    ["sync-index", "--write", "--root", workspaceRoot]
  ]) {
    const result = await runBundledCli(args);
    assert.equal(result.exitCode, 0, `${args[0]} failed: ${result.stderr}`);
    assert.doesNotMatch(result.stdout, /pending/i);
    assert.doesNotMatch(result.stderr, /Git HEAD|pending/i);
  }

  })
));

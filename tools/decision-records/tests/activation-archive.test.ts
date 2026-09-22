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

test("publication and archive transitions preserve content and index atomicity", () =>
  withFixtureWorkspace("activation-archive", async (workspaceRoot) => {
    assert.equal(await fileExists(path.join(workspaceRoot, ".git")), false);

    const decisionsDirectory = path.join(workspaceRoot, "docs", "decisions");
    const indexPath = path.join(decisionsDirectory, "decision-index.json");
    const establishedPath = decisionFilePath(
      workspaceRoot,
      currentRelativePath
    );
    const establishedText = await fs.readFile(establishedPath, "utf8");
    const originalIndexText = await fs.readFile(indexPath, "utf8");

    const rejectedActiveReactivation = await runBundledCli([
      "reactivate",
      currentRelativePath,
      "--alignment",
      "unaligned",
      "--root",
      workspaceRoot
    ]);
    assert.equal(rejectedActiveReactivation.exitCode, 1);
    assert.match(
      rejectedActiveReactivation.stderr,
      /reactivate requires an archived decision/
    );
    const rejectedEstablishedPublish = await runBundledCli([
      "publish",
      currentRelativePath,
      "--alignment",
      "unaligned",
      "--root",
      workspaceRoot
    ]);
    assert.equal(rejectedEstablishedPublish.exitCode, 1);
    assert.match(
      rejectedEstablishedPublish.stderr,
      /publish establishes a decision candidate; this decision is already an active formal record/
    );
    assert.equal(await fs.readFile(establishedPath, "utf8"), establishedText);
    assert.equal(await fs.readFile(indexPath, "utf8"), originalIndexText);

    const lifecycleRelativePath = "use-markdown-establishment.md";
    const lifecyclePath = decisionFilePath(
      workspaceRoot,
      lifecycleRelativePath
    );
    await fs.mkdir(path.dirname(lifecyclePath), { recursive: true });
    await fs.writeFile(lifecyclePath, candidateDecisionBody(), "utf8");

    const publication = await runSourceCli([
      "publish",
      lifecycleRelativePath,
      "--alignment",
      "unaligned",
      "--root",
      workspaceRoot
    ]);
    assert.equal(publication.exitCode, 0, publication.stderr);
    assert.doesNotMatch(publication.stdout, /pending/i);
    assert.doesNotMatch(publication.stderr, /pending/i);
    const activatedText = await fs.readFile(lifecyclePath, "utf8");
    const createdAt = activatedText.match(/^createdAt: (.+)$/m)?.[1];
    assert.match(createdAt ?? "", /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    findIndexEntry(await readIndex(indexPath), lifecycleRelativePath);

    const repeatedPublication = await runSourceCli([
      "publish",
      lifecycleRelativePath,
      "--alignment",
      "unaligned",
      "--root",
      workspaceRoot
    ]);
    assert.equal(repeatedPublication.exitCode, 1, repeatedPublication.stderr);
    assert.match(
      repeatedPublication.stderr,
      /publish establishes a decision candidate/
    );
    assert.equal(await fs.readFile(lifecyclePath, "utf8"), activatedText);

    await fs.rm(indexPath);
    const blockedWithoutIndex = await runSourceCli([
      "mark-aligned",
      lifecycleRelativePath,
      "--root",
      workspaceRoot
    ]);
    assert.equal(blockedWithoutIndex.exitCode, 1);
    assert.match(
      blockedWithoutIndex.stderr,
      /decision-index\.json is required/
    );
    assert.match(blockedWithoutIndex.stderr, /run sync-index/);
    assert.equal(await fs.readFile(lifecyclePath, "utf8"), activatedText);
    assert.equal(await fileExists(indexPath), false);

    const republished = await runSourceCli([
      "sync-index",
      "--root",
      workspaceRoot
    ]);
    assert.equal(republished.exitCode, 0, republished.stderr);
    assert.equal(
      findIndexEntry(await readIndex(indexPath), lifecycleRelativePath)
        .alignment,
      "unaligned"
    );

    const markedAligned = await runSourceCli([
      "mark-aligned",
      lifecycleRelativePath,
      "--root",
      workspaceRoot
    ]);
    assert.equal(markedAligned.exitCode, 0, markedAligned.stderr);
    assert.equal(
      findIndexEntry(await readIndex(indexPath), lifecycleRelativePath)
        .alignment,
      "aligned"
    );

    await fs.writeFile(indexPath, "{ invalid json\n", "utf8");
    const blockedWithInvalidIndex = await runSourceCli([
      "archive",
      lifecycleRelativePath,
      "--keep-unrecorded-history",
      "--root",
      workspaceRoot
    ]);
    assert.equal(blockedWithInvalidIndex.exitCode, 1);
    assert.match(blockedWithInvalidIndex.stderr, /decision-index\.json/);
    assert.match(blockedWithInvalidIndex.stderr, /run sync-index/);
    assert.match(await fs.readFile(lifecyclePath, "utf8"), /status: active/);
    assert.equal(
      await fileExists(
        path.join(decisionsDirectory, "archive", lifecycleRelativePath)
      ),
      false
    );
    assert.equal(await fs.readFile(indexPath, "utf8"), "{ invalid json\n");

    const republishedForArchive = await runSourceCli([
      "sync-index",
      "--root",
      workspaceRoot
    ]);
    assert.equal(
      republishedForArchive.exitCode,
      0,
      republishedForArchive.stderr
    );

    const archived = await runSourceCli([
      "archive",
      lifecycleRelativePath,
      "--keep-unrecorded-history",
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

    const archivedSource = await fs.readFile(
      path.join(decisionsDirectory, "archive", lifecycleRelativePath),
      "utf8"
    );
    const archivedIndex = await fs.readFile(indexPath, "utf8");
    const missingReactivationConfirmation = await runSourceCli([
      "reactivate",
      lifecycleRelativePath,
      "--root",
      workspaceRoot
    ]);
    assert.equal(missingReactivationConfirmation.exitCode, 2);
    assert.equal(missingReactivationConfirmation.stdout, "");
    assert.equal(
      await fs.readFile(
        path.join(decisionsDirectory, "archive", lifecycleRelativePath),
        "utf8"
      ),
      archivedSource
    );
    assert.equal(await fs.readFile(indexPath, "utf8"), archivedIndex);

    const reactivated = await runSourceCli([
      "reactivate",
      lifecycleRelativePath,
      "--alignment",
      "aligned",
      "--root",
      workspaceRoot
    ]);
    assert.equal(reactivated.exitCode, 0, reactivated.stderr);
    assert.equal(
      findIndexEntry(await readIndex(indexPath), lifecycleRelativePath)
        .createdAt,
      createdAt
    );

    for (const args of [
      ["check", "--root", workspaceRoot],
      ["list", "--root", workspaceRoot],
      ["show", lifecycleRelativePath, "--root", workspaceRoot],
      ["trace", lifecycleRelativePath, "--root", workspaceRoot],
      ["sync-index", "--root", workspaceRoot]
    ]) {
      const result = await runBundledCli(args);
      assert.equal(result.exitCode, 0, `${args[0]} failed: ${result.stderr}`);
      assert.doesNotMatch(result.stdout, /pending/i);
      assert.doesNotMatch(result.stderr, /Git HEAD|pending/i);
    }

    const archivedAgain = await runSourceCli([
      "archive",
      lifecycleRelativePath,
      "--keep-unrecorded-history",
      "--root",
      workspaceRoot
    ]);
    assert.equal(archivedAgain.exitCode, 0, archivedAgain.stderr);
    const discardedArchived = await runSourceCli([
      "discard",
      lifecycleRelativePath,
      "--delete-recorded",
      "--root",
      workspaceRoot
    ]);
    assert.equal(discardedArchived.exitCode, 0, discardedArchived.stderr);
    assert.equal(
      await fileExists(
        path.join(decisionsDirectory, "archive", lifecycleRelativePath)
      ),
      false
    );
    assert.equal(
      Object.hasOwn(
        (await readIndex(indexPath)).entries,
        lifecycleRelativePath
      ),
      false
    );
  }));

import { executeDecisionQuery } from "../src/decision-query-service.ts";
import { syncDecisionIndex } from "../src/decision-state-index.ts";
import { prepareDecisionLifecycle } from "../src/decision-lifecycle-service.ts";
import { scanDecisionRecords } from "../src/scan.ts";
import { validateDecisionRecords } from "../src/index.ts";
import { decisionIdForTest } from "./support-record-fixture.ts";
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

    const initialScan = await scanDecisionRecords({ workspaceRoot });
    const rejectedActiveReactivation = prepareDecisionLifecycle(
      initialScan,
      {
        action: "reactivate",
        decisionId: currentRelativePath,
        alignment: "unaligned"
      },
      { historyBaseline: null }
    );
    assert.equal(rejectedActiveReactivation.status, "error");
    if (rejectedActiveReactivation.status === "error")
      assert.match(
        rejectedActiveReactivation.errors.join("\n"),
        /reactivate requires an archived decision/
      );
    const rejectedEstablishedPublish = prepareDecisionLifecycle(
      initialScan,
      {
        action: "publish",
        decisionId: currentRelativePath,
        alignment: "unaligned",
        keepUnrecordedHistory: true
      },
      { historyBaseline: null }
    );
    assert.equal(rejectedEstablishedPublish.status, "error");
    if (rejectedEstablishedPublish.status === "error")
      assert.match(
        rejectedEstablishedPublish.errors.join("\n"),
        /already an active formal record/
      );
    assert.equal(await fs.readFile(establishedPath, "utf8"), establishedText);
    assert.equal(await fs.readFile(indexPath, "utf8"), originalIndexText);

    const lifecycleRelativePath = "use-markdown-establishment.md";
    const lifecyclePath = decisionFilePath(
      workspaceRoot,
      lifecycleRelativePath
    );
    const archivedPath = path.join(
      decisionsDirectory,
      "archive",
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
    assert.equal(await fileExists(archivedPath), false);
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

    const archivedSource = await fs.readFile(archivedPath, "utf8");
    const archivedIndex = await fs.readFile(indexPath, "utf8");
    const missingReactivationConfirmation = await runSourceCli([
      "reactivate",
      lifecycleRelativePath,
      "--root",
      workspaceRoot
    ]);
    assert.equal(missingReactivationConfirmation.exitCode, 2);
    assert.equal(missingReactivationConfirmation.stdout, "");
    assert.equal(await fs.readFile(archivedPath, "utf8"), archivedSource);
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

    assert.deepEqual(
      (await validateDecisionRecords({ workspaceRoot })).errors,
      []
    );
    const location = { workspaceRoot, decisionsDir: "docs/decisions" };
    const list = await executeDecisionQuery({
      command: "list",
      location,
      alignment: "all",
      status: "active",
      tags: [],
      limit: 10,
      offset: 0
    });
    assert.equal(list.status, "ok");
    for (const command of ["show", "trace"] as const) {
      const result = await executeDecisionQuery({
        command,
        location,
        decisionId: decisionIdForTest(lifecycleRelativePath)
      });
      assert.equal(result.status, "ok");
    }
    assert.equal(
      (await syncDecisionIndex({ decisionsDirectory, mode: "write" })).status,
      "ok"
    );

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
    assert.equal(await fileExists(archivedPath), false);
    assert.equal(
      Object.hasOwn(
        (await readIndex(indexPath)).entries,
        lifecycleRelativePath
      ),
      false
    );
  }));

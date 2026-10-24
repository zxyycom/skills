import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createGitRepositoryFixture } from "../../shared/tests/git-fixture.ts";
import { renameInvestigationRecordWithHooks } from "../src/rename.ts";
import { setInvestigationRelationsWithWriter } from "../src/relation-transaction.ts";
import {
  parseJsonObject,
  jsonObjectMember,
  investigationRoot,
  reportMarkdown,
  withTempRoot
} from "./fixture-support.ts";
import { writeCollection, writeResource } from "./collection-support.ts";
import { synchronizeInvestigationIndex } from "../src/validation.ts";

test("Investigation same identity and path rename preserves noncanonical recorded bytes mode and index without unrelated health", async () => {
  await withTempRoot("rename-true-noop", async (parentDirectory) => {
    const fixture = await createGitRepositoryFixture({
      fixtureRoot: fileURLToPath(
        new URL("./fixtures/rename-noop", import.meta.url)
      ),
      parentDirectory,
      repositoryName: "repository",
      userEmail: "test@example.invalid",
      userName: "Test",
      prepareRepository: async (workspaceRoot) => {
        const synchronized = await synchronizeInvestigationIndex({
          workspaceRoot
        });
        assert.deepEqual(synchronized.errors, []);
        const root = investigationRoot(workspaceRoot);
        const source = path.join(root, "same.md");
        await fs.appendFile(source, "\n");
        await fs.chmod(source, 0o640);
        assert.deepEqual(
          (await synchronizeInvestigationIndex({ workspaceRoot })).errors,
          []
        );
        await fs.writeFile(
          path.join(root, "unrelated.md"),
          "malformed unrelated body\n"
        );
      }
    });
    const workspaceRoot = fixture.repositoryRoot;
    const root = investigationRoot(workspaceRoot);
    const source = path.join(root, "same.md");
    const index = path.join(root, "investigation-index.json");
    const text = await fs.readFile(source, "utf8");
    const indexBefore = await fs.readFile(index);
    const before = await fs.stat(source);
    const result = await renameInvestigationRecordWithHooks({
      source: "260828-same",
      target: "same",
      workspaceRoot
    });
    assert.equal(result.status, "ok", result.errors.join("; "));
    assert.equal(result.changed, false);
    assert.equal(await fs.readFile(source, "utf8"), text);
    assert.deepEqual(await fs.readFile(index), indexBefore);
    const after = await fs.stat(source);
    assert.equal(after.ino, before.ino);
    assert.equal(after.mode & 0o7777, 0o640);
  });
});

test("Investigation relation writer rejection after index publication preserves committed state without success review", async () => {
  await withTempRoot("relation-committed-rejection", async (workspaceRoot) => {
    await writeCollection(workspaceRoot, [{ id: "base" }, { id: "next" }]);
    const root = investigationRoot(workspaceRoot);
    const index = path.join(root, "investigation-index.json");
    const result = await setInvestigationRelationsWithWriter(
      {
        workspaceRoot,
        replacements: [
          { source: "next", relations: [{ type: "补充", target: "base" }] }
        ]
      },
      async (target, text) => {
        await fs.writeFile(target, text);
        if (target === index)
          throw new Error("index writer rejected after publication");
      }
    );
    assert.equal(result.changed, true);
    assert.equal(result.mutation?.outcome, "partial-or-unknown");
    assert.equal(result.relationReview, undefined);
    assert.match(result.errors.join("; "), /rejected after publication/);
    assert.match(
      await fs.readFile(path.join(root, "next.md"), "utf8"),
      /target: "base"/
    );
    const publishedIndex = parseJsonObject(await fs.readFile(index, "utf8"));
    assert.deepEqual(
      jsonObjectMember(jsonObjectMember(publishedIndex, "entries"), "next")
        .relations,
      [{ type: "补充", target: "base" }]
    );
  });
});

test("Investigation rename fresh proof rejects resource mode and inode drift without undoing the external winner", async () => {
  for (const drift of ["mode", "inode"] as const) {
    await withTempRoot(
      "rename-resource-fresh-" + drift,
      async (workspaceRoot) => {
        await writeCollection(
          workspaceRoot,
          [{ id: "legacy", resources: ["legacy/evidence.txt"] }],
          false
        );
        await writeResource(workspaceRoot, "legacy/evidence.txt", "evidence\n");
        assert.deepEqual(
          (await synchronizeInvestigationIndex({ workspaceRoot })).errors,
          []
        );
        const root = investigationRoot(workspaceRoot);
        const resource = path.join(
          root,
          "_resources",
          "legacy",
          "evidence.txt"
        );
        const source = await fs.readFile(path.join(root, "legacy.md"));
        const index = path.join(root, "investigation-index.json");
        const beforeIndex = await fs.readFile(index);
        let winnerInode = 0;
        const result = await renameInvestigationRecordWithHooks(
          { source: "legacy", target: "migrated", workspaceRoot },
          {
            beforePublish: async () => {
              if (drift === "mode") await fs.chmod(resource, 0o600);
              else {
                const next = resource + ".replacement";
                await fs.writeFile(next, "evidence\n");
                await fs.rename(next, resource);
              }
              winnerInode = (await fs.stat(resource)).ino;
            }
          }
        );
        assert.equal(result.status, "error");
        assert.equal(result.changed, false);
        assert.deepEqual(await fs.readFile(index), beforeIndex);
        assert.equal((await fs.stat(resource)).ino, winnerInode);
        if (drift === "mode")
          assert.equal((await fs.stat(resource)).mode & 0o7777, 0o600);
        assert.deepEqual(
          await fs.readFile(path.join(root, "legacy.md")),
          source
        );
        await assert.rejects(fs.access(path.join(root, "migrated.md")), {
          code: "ENOENT"
        });
      }
    );
  }
});

import { createInvestigationCandidate } from "../src/candidate-create.ts";
import { discardInvestigationRecord } from "../src/discard-entry.ts";

test("Investigation candidate rename and discard preserve formal index bytes identity and mode", async () => {
  await withTempRoot("candidate-index-preservation", async (workspaceRoot) => {
    await writeCollection(workspaceRoot, [{ id: "base" }]);
    const root = investigationRoot(workspaceRoot);
    const indexPath = path.join(root, "investigation-index.json");
    const created = await createInvestigationCandidate({
      workspaceRoot,
      id: "candidate-before",
      title: "candidate",
      question: "candidate question",
      tags: ["investigation-report"],
      relations: [],
      formedAt: "2026-08-28T12:00:00Z"
    });
    assert.ok(created.candidate !== null, created.errors.join("; "));
    await fs.writeFile(
      created.candidate.path,
      reportMarkdown({ id: created.candidate.id })
    );
    const index = (await fs.readFile(indexPath, "utf8")).replace(/\n/g, "\r\n");
    await fs.writeFile(indexPath, index);
    await fs.chmod(indexPath, 0o640);
    const before = await fs.stat(indexPath);
    const renamed = await renameInvestigationRecordWithHooks({
      source: created.candidate.id,
      target: "candidate-after",
      workspaceRoot
    });
    assert.equal(renamed.status, "ok", renamed.errors.join("; "));
    assert.equal(renamed.changed, true);
    assert.ok(renamed.plan !== null);
    await assert.rejects(fs.access(created.candidate.path), { code: "ENOENT" });
    const discarded = await discardInvestigationRecord({
      workspaceRoot,
      id: renamed.plan.newId
    });
    assert.deepEqual(discarded.errors, []);
    assert.equal(discarded.changed, true);
    await assert.rejects(
      fs.access(path.join(root, renamed.plan.newSourcePath)),
      { code: "ENOENT" }
    );
    assert.equal(await fs.readFile(indexPath, "utf8"), index);
    const after = await fs.stat(indexPath);
    assert.equal(after.ino, before.ino);
    assert.equal(after.dev, before.dev);
    assert.equal(after.mode, before.mode);
  });
});

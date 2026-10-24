import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import {
  discardInvestigationCandidate,
  discardInvestigationCandidateWithHook
} from "../src/candidate-discard.ts";
import { discardInvestigationRecord } from "../src/discard-entry.ts";
import { discardInvestigationReport } from "../src/discard.ts";

import {
  investigationRoot,
  reportMarkdown,
  withTempRoot
} from "./fixture-support.ts";
import { synchronizeInvestigationIndex } from "../src/validation.ts";
import { writeCollection } from "./collection-support.ts";
import { candidatePath, createReadyCandidate } from "./publish-support.ts";

test("candidate discard leaves unselected draft references untouched and protects recorded deletion", async () => {
  await withTempRoot("discard-candidate", async (root) => {
    await writeCollection(root, [{ id: "formal" }]);
    await createReadyCandidate(root, "candidate.md", {
      id: "candidate",
      resources: ["candidate/evidence.txt"]
    });
    await createReadyCandidate(root, "consumer.md", {
      id: "consumer",
      resources: ["candidate/evidence.txt"]
    });
    const resource = path.join(
      investigationRoot(root),
      "_resources",
      "candidate",
      "evidence.txt"
    );
    await fs.mkdir(path.dirname(resource), { recursive: true });
    await fs.writeFile(resource, "evidence", "utf8");
    const shared = await discardInvestigationRecord({
      deleteOwnedResources: true,
      id: "candidate",
      workspaceRoot: root
    });
    assert.deepEqual(shared.errors, []);
    await fs.access(candidatePath(root, "consumer.md"));
    await createReadyCandidate(root, "candidate.md", {
      id: "candidate",
      resources: ["candidate/evidence.txt"]
    });
    await fs.mkdir(path.dirname(resource), { recursive: true });
    await fs.writeFile(resource, "evidence");
    assert.equal(
      await fs.readFile(
        path.join(investigationRoot(root), "formal.md"),
        "utf8"
      ),
      reportMarkdown({ id: "formal" })
    );

    await fs.rm(candidatePath(root, "consumer.md"));
    initializeGit(root);
    const recorded = await discardInvestigationCandidate({
      deleteOwnedResources: true,
      id: "candidate",
      workspaceRoot: root
    });
    assert.equal(recorded.requiresRecordedDeletionConfirmation, true);
    const discarded = await discardInvestigationRecord({
      deleteOwnedResources: true,
      deleteRecorded: true,
      id: "candidate",
      workspaceRoot: root
    });
    assert.deepEqual(discarded.errors, []);
    await assert.rejects(fs.access(candidatePath(root, "candidate.md")));
    await assert.rejects(fs.access(resource));
    assert.equal(
      await fs.readFile(
        path.join(investigationRoot(root), "formal.md"),
        "utf8"
      ),
      reportMarkdown({ id: "formal" })
    );
  });
});

test("candidate discard detects drift before committing its tombstone", async () => {
  await withTempRoot("discard-candidate-drift", async (root) => {
    await createReadyCandidate(root, "candidate.md");
    const before = await fs.readFile(
      candidatePath(root, "candidate.md"),
      "utf8"
    );
    const discarded = await discardInvestigationCandidateWithHook(
      { id: "candidate", workspaceRoot: root },
      async () =>
        await fs.appendFile(candidatePath(root, "candidate.md"), "\n", "utf8")
    );
    assert.ok(
      discarded.errors.some((error) =>
        error.includes("changed after discard preparation")
      )
    );
    assert.equal(
      await fs.readFile(candidatePath(root, "candidate.md"), "utf8"),
      `${before}\n`
    );
  });
});

test("candidate discard reports pending cleanup after its tombstone commit", async () => {
  await withTempRoot("discard-candidate-cleanup", async (root) => {
    await createReadyCandidate(root, "candidate.md");
    const originalUnlink = fs.unlink;
    fs.unlink = (async (...args) => {
      if (String(args[0]).includes(".investigation-candidate-discard-")) {
        throw new Error("injected tombstone cleanup failure");
      }
      return await originalUnlink(...args);
    }) as typeof fs.unlink;
    let discarded;
    try {
      discarded = await discardInvestigationCandidate({
        id: "candidate",
        workspaceRoot: root
      });
    } finally {
      fs.unlink = originalUnlink;
    }
    assert.equal(discarded.changed, true);
    assert.ok(
      discarded.errors.some((error) => error.includes("cleanup is pending"))
    );
    assert.deepEqual(discarded.mutation, {
      outcome: "committed-cleanup-pending",
      scope: "investigation candidate discard collection"
    });
    await assert.rejects(fs.access(candidatePath(root, "candidate.md")));
    const tombstone = (await fs.readdir(path.join(root, "docs"))).find((name) =>
      name.startsWith(".investigation-candidate-discard-")
    );
    assert.notEqual(tombstone, undefined);
    await fs.rm(path.join(root, "docs", tombstone!), {
      force: true,
      recursive: true
    });
  });
});

test("formal discard ignores unselected authoring resource references", async () => {
  await withTempRoot("formal-discard-candidate-reference", async (root) => {
    await writeCollection(
      root,
      [{ id: "formal", resources: ["formal/evidence.txt"] }],
      false
    );
    const resource = path.join(
      investigationRoot(root),
      "_resources",
      "formal",
      "evidence.txt"
    );
    await fs.mkdir(path.dirname(resource), { recursive: true });
    await fs.writeFile(resource, "evidence", "utf8");
    const synchronized = await synchronizeInvestigationIndex({
      workspaceRoot: root
    });
    assert.deepEqual(synchronized.errors, []);
    await createReadyCandidate(root, "candidate.md", {
      id: "candidate",
      resources: ["formal/evidence.txt"]
    });
    const candidateDiscard = await discardInvestigationReport({
      id: "candidate",
      workspaceRoot: root
    });
    assert.equal(candidateDiscard.changed, false);
    assert.ok(
      candidateDiscard.errors.some((error) => error.includes("does not exist"))
    );
    await fs.access(candidatePath(root, "candidate.md"));
    const discarded = await discardInvestigationReport({
      deleteOwnedResources: true,
      id: "formal",
      workspaceRoot: root
    });
    assert.deepEqual(discarded.errors, []);
    assert.equal(discarded.changed, true);
    await assert.rejects(fs.access(resource));
  });
});

test("formal discard does not read malformed unselected candidate resource references", async () => {
  await withTempRoot("candidate-reference-read-failure", async (root) => {
    await writeCollection(
      root,
      [{ id: "formal", resources: ["formal/evidence.txt"] }],
      false
    );
    const resource = path.join(
      investigationRoot(root),
      "_resources",
      "formal",
      "evidence.txt"
    );
    await fs.mkdir(path.dirname(resource), { recursive: true });
    await fs.writeFile(resource, "evidence", "utf8");
    const synchronized = await synchronizeInvestigationIndex({
      workspaceRoot: root
    });
    assert.deepEqual(synchronized.errors, []);
    await createReadyCandidate(root, "candidate.md");
    await fs.writeFile(
      candidatePath(root, "candidate.md"),
      "invalid\n",
      "utf8"
    );

    const discarded = await discardInvestigationReport({
      deleteOwnedResources: true,
      id: "formal",
      workspaceRoot: root
    });
    assert.equal(discarded.changed, true);
    assert.deepEqual(discarded.errors, []);
    await assert.rejects(fs.access(resource));
    await assert.rejects(
      fs.access(path.join(investigationRoot(root), "formal.md"))
    );
    assert.equal(
      await fs.readFile(candidatePath(root, "candidate.md"), "utf8"),
      "invalid\n"
    );
  });
});

test("candidate discard uses published resource declarations instead of unselected formal edits", async () => {
  await withTempRoot(
    "candidate-discard-invalid-formal-reference",
    async (root) => {
      await writeCollection(root, [{ id: "formal" }]);
      await createReadyCandidate(root, "candidate.md", {
        id: "candidate",
        resources: ["candidate/evidence.txt"]
      });
      const resource = path.join(
        investigationRoot(root),
        "_resources",
        "candidate",
        "evidence.txt"
      );
      await fs.mkdir(path.dirname(resource), { recursive: true });
      await fs.writeFile(resource, "evidence", "utf8");
      await fs.writeFile(
        path.join(investigationRoot(root), "formal.md"),
        reportMarkdown({
          id: "formal",
          resources: ["candidate/evidence.txt"]
        }).replace("## 调查目的", "## 非法章节"),
        "utf8"
      );

      const discarded = await discardInvestigationCandidate({
        deleteOwnedResources: true,
        id: "candidate",
        workspaceRoot: root
      });
      assert.equal(discarded.changed, true);
      assert.deepEqual(discarded.errors, []);
      await assert.rejects(fs.access(candidatePath(root, "candidate.md")));
      await assert.rejects(fs.access(resource));
    }
  );
});

test("candidate discard rechecks Git HEAD immediately before deletion", async () => {
  await withTempRoot("candidate-discard-history-drift", async (root) => {
    await fs.mkdir(investigationRoot(root), { recursive: true });
    await fs.writeFile(path.join(root, "README.md"), "baseline\n", "utf8");
    initializeGit(root);
    await createReadyCandidate(root, "candidate.md");

    const discarded = await discardInvestigationCandidateWithHook(
      { id: "candidate", workspaceRoot: root },
      async () => {
        execFileSync(
          "git",
          [
            "-C",
            root,
            "add",
            path.join("docs", "investigations", "_candidate.candidate")
          ],
          { stdio: "ignore" }
        );
        execFileSync(
          "git",
          ["-C", root, "commit", "--quiet", "-m", "record candidate"],
          { stdio: "ignore" }
        );
      }
    );
    assert.equal(discarded.changed, false);
    assert.equal(discarded.requiresRecordedDeletionConfirmation, true);
    assert.ok(
      discarded.errors.some((error) => error.includes("entered Git HEAD"))
    );
    await fs.access(candidatePath(root, "candidate.md"));
  });
});

function initializeGit(root: string): void {
  for (const args of [
    ["init", "--quiet"],
    ["config", "user.email", "test@example.invalid"],
    ["config", "user.name", "Test"],
    ["add", "."],
    ["commit", "--quiet", "-m", "initial"]
  ]) {
    execFileSync("git", ["-C", root, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });
  }
}

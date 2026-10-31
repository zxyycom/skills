import assert from "node:assert/strict";

import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import {
  publishInvestigationCandidates,
  publishInvestigationCandidatesWithWriter
} from "../../src/publication/publish.ts";
import {
  parseJsonObject,
  jsonObjectMember,
  investigationRoot,
  reportMarkdown,
  withTempRoot
} from "../support/fixture-support.ts";
import { synchronizeInvestigationIndex } from "../../src/records/validation/validation.ts";
import { writeCollection } from "../support/collection-support.ts";
import { candidatePath, createReadyCandidate } from "./publish-support.ts";

test("publish requires selected relation closure without auditing current dependency bodies", async () => {
  await withTempRoot("publish-baseline", async (root) => {
    await writeCollection(root, [{ id: "base" }]);
    await createReadyCandidate(root, "successor.md", {
      id: "successor",
      relations: [{ target: "missing", type: "补充" }]
    });
    const missingTarget = await publishInvestigationCandidates({
      ids: ["successor.md"],
      preflight: true,
      workspaceRoot: root
    });
    assert.ok(missingTarget.errors.some((error) => error.includes("missing")));
    assert.equal(
      await fs.stat(candidatePath(root, "successor.md")).then(() => true),
      true
    );

    await fs.writeFile(
      candidatePath(root, "successor.md"),
      reportMarkdown({
        id: "successor",
        relations: [{ target: "base", type: "补充" }]
      }),
      "utf8"
    );
    await fs.appendFile(
      path.join(investigationRoot(root), "base.md"),
      "\n",
      "utf8"
    );
    const stale = await publishInvestigationCandidates({
      ids: ["successor.md"],
      preflight: true,
      workspaceRoot: root
    });
    assert.deepEqual(stale.errors, []);
    await fs.writeFile(
      path.join(investigationRoot(root), "base.md"),
      reportMarkdown({ id: "base" }),
      "utf8"
    );
    const synchronized = await synchronizeInvestigationIndex({
      workspaceRoot: root
    });
    assert.deepEqual(synchronized.errors, []);
    const ready = await publishInvestigationCandidates({
      ids: ["successor.md"],
      preflight: true,
      workspaceRoot: root
    });
    assert.deepEqual(ready.errors, []);
  });
});

test("publish preflight validates complete merge and split candidate batches", async () => {
  await withTempRoot("publish-merge-batch", async (root) => {
    await createReadyCandidate(root, "left.md");
    await createReadyCandidate(root, "right.md");
    await createReadyCandidate(root, "merged.md", {
      id: "merged",
      relations: [
        { target: "left", type: "归并" },
        { target: "right", type: "归并" }
      ]
    });
    const incomplete = await publishInvestigationCandidates({
      ids: ["merged.md"],
      preflight: true,
      workspaceRoot: root
    });
    assert.ok(incomplete.errors.some((error) => error.includes("left")));
    const complete = await publishInvestigationCandidates({
      ids: ["merged.md", "left.md", "right.md"],
      preflight: true,
      workspaceRoot: root
    });
    assert.deepEqual(complete.errors, []);
    await assert.rejects(
      fs.access(path.join(investigationRoot(root), "merged.md"))
    );
  });

  await withTempRoot("publish-split-batch", async (root) => {
    await createReadyCandidate(root, "base.md");
    await createReadyCandidate(root, "split-left.md", {
      id: "split-left",
      relations: [{ target: "base", type: "拆分" }]
    });
    await createReadyCandidate(root, "split-right.md", {
      id: "split-right",
      relations: [{ target: "base", type: "拆分" }]
    });
    const complete = await publishInvestigationCandidates({
      ids: ["base.md", "split-left.md", "split-right.md"],
      preflight: true,
      workspaceRoot: root
    });
    assert.deepEqual(complete.errors, []);
    await assert.rejects(
      fs.access(path.join(investigationRoot(root), "base.md"))
    );
  });
});

test("publish restores candidate text and preserves owner resource bytes when index publication fails", async () => {
  await withTempRoot("publish-resource-protocol", async (root) => {
    await createReadyCandidate(root, "resource-owner.md", {
      id: "resource-owner",
      resources: ["resource-owner/evidence.txt"]
    });
    const resource = path.join(
      investigationRoot(root),
      "_resources",
      "resource-owner",
      "evidence.txt"
    );
    await fs.mkdir(path.dirname(resource), { recursive: true });
    await fs.writeFile(resource, "first bytes", "utf8");
    const initialCandidate = await fs.readFile(
      candidatePath(root, "resource-owner.md"),
      "utf8"
    );
    const failed = await publishInvestigationCandidatesWithWriter(
      { ids: ["resource-owner.md"], workspaceRoot: root },
      async () => {
        throw new Error("injected index write failure");
      }
    );
    assert.deepEqual(failed.mutation, {
      outcome: "rolled-back",
      scope: "investigation candidate publish collection"
    });
    assert.equal(
      await fs.readFile(candidatePath(root, "resource-owner.md"), "utf8"),
      initialCandidate
    );
    assert.equal(await fs.readFile(resource, "utf8"), "first bytes");
    await assert.rejects(
      fs.access(path.join(investigationRoot(root), "resource-owner.md"))
    );
  });
});

test("publish rejects owner resource inode drift before index publication", async () => {
  await withTempRoot("publish-resource-protocol", async (root) => {
    await createReadyCandidate(root, "resource-owner.md", {
      id: "resource-owner",
      resources: ["resource-owner/evidence.txt"]
    });
    const resource = path.join(
      investigationRoot(root),
      "_resources",
      "resource-owner",
      "evidence.txt"
    );
    await fs.mkdir(path.dirname(resource), { recursive: true });
    await fs.writeFile(resource, "first bytes", "utf8");
    const initialCandidate = await fs.readFile(
      candidatePath(root, "resource-owner.md"),
      "utf8"
    );
    const replacement = path.join(
      path.dirname(resource),
      "replacement-evidence.txt"
    );
    let indexWrites = 0;
    const identityDrift = await publishInvestigationCandidatesWithWriter(
      { ids: ["resource-owner.md"], workspaceRoot: root },
      async () => {
        indexWrites += 1;
        throw new Error(
          "unexpected index publication after resource identity drift"
        );
      },
      async () => {
        await fs.writeFile(replacement, "same bytes", "utf8");
        await fs.rename(replacement, resource);
      }
    );
    assert.ok(
      identityDrift.errors.some((error) =>
        error.includes("resources changed identity")
      )
    );
    assert.equal(indexWrites, 0);
    assert.equal(
      await fs.readFile(candidatePath(root, "resource-owner.md"), "utf8"),
      initialCandidate
    );
    await assert.rejects(
      fs.access(path.join(investigationRoot(root), "resource-owner.md"))
    );
  });
});

test("publish accepts same-inode owner resource byte updates while preserving report text", async () => {
  await withTempRoot("publish-resource-protocol", async (root) => {
    await createReadyCandidate(root, "resource-owner.md", {
      id: "resource-owner",
      resources: ["resource-owner/evidence.txt"]
    });
    const resource = path.join(
      investigationRoot(root),
      "_resources",
      "resource-owner",
      "evidence.txt"
    );
    await fs.mkdir(path.dirname(resource), { recursive: true });
    await fs.writeFile(resource, "first bytes", "utf8");
    const initialCandidate = await fs.readFile(
      candidatePath(root, "resource-owner.md"),
      "utf8"
    );
    const published = await publishInvestigationCandidatesWithWriter(
      { ids: ["resource-owner.md"], workspaceRoot: root },
      async (target, text) =>
        await fs.writeFile(target, text, { encoding: "utf8", mode: 0o600 }),
      async () => await fs.writeFile(resource, "updated bytes", "utf8")
    );
    assert.deepEqual(published.errors, []);
    assert.equal(await fs.readFile(resource, "utf8"), "updated bytes");
    assert.equal(
      await fs.readFile(
        path.join(investigationRoot(root), "resource-owner.md"),
        "utf8"
      ),
      initialCandidate
    );
  });
});

test("publish rechecks selected candidate drift before changing files", async () => {
  await withTempRoot("publish-candidate-drift", async (root) => {
    await writeCollection(root, [{ id: "formal" }]);
    await createReadyCandidate(root, "candidate.md");
    const candidate = candidatePath(root, "candidate.md");
    const beforeFormal = await fs.readFile(
      path.join(investigationRoot(root), "formal.md"),
      "utf8"
    );
    const result = await publishInvestigationCandidatesWithWriter(
      { ids: ["candidate.md"], workspaceRoot: root },
      async () =>
        assert.fail("index writer must not run after candidate drift"),
      async () => await fs.appendFile(candidate, "\n", "utf8")
    );
    assert.equal(result.changed, false);
    assert.ok(
      result.errors.some((error) => error.includes("candidates changed"))
    );
    await fs.access(candidate);
    assert.equal(
      await fs.readFile(
        path.join(investigationRoot(root), "formal.md"),
        "utf8"
      ),
      beforeFormal
    );
  });
});

test("publish rechecks index drift before changing files", async () => {
  await withTempRoot("publish-formal-index-drift", async (root) => {
    await writeCollection(root, [{ id: "formal" }]);
    await createReadyCandidate(root, "candidate.md", {
      id: "candidate",
      relations: [{ type: "补充", target: "formal" }]
    });
    const candidate = candidatePath(root, "candidate.md");
    const index = path.join(
      investigationRoot(root),
      "investigation-index.json"
    );
    const beforeCandidate = await fs.readFile(candidate, "utf8");
    const beforeIndex = await fs.readFile(index, "utf8");
    const indexDrift = await publishInvestigationCandidatesWithWriter(
      { ids: ["candidate.md"], workspaceRoot: root },
      async () => assert.fail("index writer must not run after index drift"),
      async () => await fs.appendFile(index, "\n", "utf8")
    );
    assert.equal(indexDrift.changed, false);
    assert.ok(indexDrift.errors.length > 0);
    assert.equal(await fs.readFile(candidate, "utf8"), beforeCandidate);
    assert.equal(await fs.readFile(index, "utf8"), `${beforeIndex}\n`);
  });
});

test("publish accepts unselected dependency body drift while preserving its current bytes", async () => {
  await withTempRoot("publish-dependency-body-drift", async (root) => {
    await writeCollection(root, [{ id: "formal" }]);
    await createReadyCandidate(root, "candidate.md", {
      id: "candidate",
      relations: [{ type: "补充", target: "formal" }]
    });
    const formal = path.join(investigationRoot(root), "formal.md");
    const before = await fs.readFile(formal, "utf8");
    const published = await publishInvestigationCandidatesWithWriter(
      { ids: ["candidate.md"], workspaceRoot: root },
      async (target, text) => await fs.writeFile(target, text, "utf8"),
      async () => await fs.appendFile(formal, "\n", "utf8")
    );
    assert.deepEqual(published.errors, []);
    assert.equal(published.changed, true);
    assert.equal(await fs.readFile(formal, "utf8"), before + "\n");
    const index = parseJsonObject(
      await fs.readFile(
        path.join(investigationRoot(root), "investigation-index.json"),
        "utf8"
      )
    );
    assert.deepEqual(
      jsonObjectMember(jsonObjectMember(index, "entries"), "candidate")
        .relations,
      [{ type: "补充", target: "formal" }]
    );
    assert.match(
      await fs.readFile(
        path.join(investigationRoot(root), "candidate.md"),
        "utf8"
      ),
      /id: "candidate"/u
    );
    await assert.rejects(fs.access(candidatePath(root, "candidate.md")));
  });
});

test("publish preserves unrelated published projections without reading their current sources or resources", async (t) => {
  await withTempRoot("publish-local-baseline", async (root) => {
    const directory = investigationRoot(root);
    await fs.mkdir(path.join(directory, "_resources/unrelated"), {
      recursive: true
    });
    const unrelatedResource = path.join(
      directory,
      "_resources/unrelated/resource.txt"
    );
    await fs.writeFile(unrelatedResource, "original resource\n");
    await writeCollection(root, [
      { id: "base" },
      { id: "unrelated", resources: ["unrelated/resource.txt"] }
    ]);
    const indexPath = path.join(directory, "investigation-index.json");
    const before = parseJsonObject(await fs.readFile(indexPath, "utf8"));
    assert.equal(
      typeof jsonObjectMember(
        jsonObjectMember(before, "sourceRevision"),
        "entries"
      ).unrelated,
      "string"
    );
    const unrelatedSource = path.join(directory, "unrelated.md");
    await fs.writeFile(unrelatedSource, "unrelated invalid current document\n");
    await fs.rm(unrelatedResource);
    await createReadyCandidate(root, "next.md", {
      id: "next",
      relations: [{ type: "补充", target: "base" }]
    });
    const readFile = fs.readFile;
    const reads: string[] = [];
    const observedRead = t.mock.method(
      fs,
      "readFile",
      async (...args: Parameters<typeof fs.readFile>) => {
        if (args[0] === unrelatedSource || args[0] === unrelatedResource) {
          reads.push(String(args[0]));
          throw new Error("unrelated payload must not be read");
        }
        return await readFile(...args);
      }
    );
    let result;
    try {
      result = await publishInvestigationCandidates({
        ids: ["next"],
        workspaceRoot: root
      });
    } finally {
      observedRead.mock.restore();
    }
    assert.deepEqual(result.errors, []);
    assert.equal(result.changed, true);
    assert.deepEqual(reads, []);
    const after = parseJsonObject(await fs.readFile(indexPath, "utf8"));
    assert.deepEqual(
      jsonObjectMember(jsonObjectMember(after, "entries"), "unrelated"),
      jsonObjectMember(jsonObjectMember(before, "entries"), "unrelated")
    );
    assert.equal(
      jsonObjectMember(jsonObjectMember(after, "sourceRevision"), "entries")
        .unrelated,
      jsonObjectMember(jsonObjectMember(before, "sourceRevision"), "entries")
        .unrelated
    );
    assert.ok(jsonObjectMember(after, "entries").next);
    assert.equal(
      await fs.readFile(unrelatedSource, "utf8"),
      "unrelated invalid current document\n"
    );
    assert.ok(
      (await synchronizeInvestigationIndex({ workspaceRoot: root })).errors
        .length > 0
    );
  });
});

test("publish requires explicit recovery for missing or invalid existing baselines but accepts a published empty index", async () => {
  await withTempRoot("publish-baseline-recovery", async (root) => {
    await writeCollection(root, [{ id: "base" }]);
    await createReadyCandidate(root, "next.md");
    const indexPath = path.join(
      investigationRoot(root),
      "investigation-index.json"
    );
    const originalIndex = await fs.readFile(indexPath, "utf8");
    for (const text of [
      null,
      "{}",
      originalIndex.replace('"definitionVersion": 11', '"definitionVersion": 0')
    ]) {
      if (text === null) await fs.rm(indexPath, { force: true });
      else await fs.writeFile(indexPath, text);
      const beforeCandidate = await fs.readFile(
        candidatePath(root, "next.md"),
        "utf8"
      );
      const result = await publishInvestigationCandidates({
        ids: ["next"],
        workspaceRoot: root
      });
      assert.equal(result.changed, false);
      assert.ok(result.errors.some((error) => error.includes("sync-index")));
      assert.equal(
        await fs.readFile(candidatePath(root, "next.md"), "utf8"),
        beforeCandidate
      );
      await assert.rejects(
        fs.access(path.join(investigationRoot(root), "next.md"))
      );
    }
    await fs.writeFile(indexPath, originalIndex);
    await fs.rm(path.join(investigationRoot(root), "base.md"));
    const empty = await synchronizeInvestigationIndex({ workspaceRoot: root });
    assert.deepEqual(empty.errors, []);
    const published = await publishInvestigationCandidates({
      ids: ["next"],
      workspaceRoot: root
    });
    assert.deepEqual(published.errors, []);
    assert.equal(published.changed, true);
  });
});

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import {
  discardInvestigationCandidate,
  discardInvestigationCandidateWithHook
} from "../src/candidate-discard.ts";
import { discardInvestigationReport } from "../src/discard.ts";
import {
  publishInvestigationCandidates,
  publishInvestigationCandidatesWithWriter
} from "../src/publish.ts";
import {
  investigationRoot,
  reportMarkdown,
  runInvestigationCli,
  withTempRoot,
  writeCollection
} from "./v6-support.ts";

const candidatePath = (root: string, id: string): string =>
  path.join(investigationRoot(root), `_candidate.${id}`);

async function createReadyCandidate(
  root: string,
  id: string,
  options: Parameters<typeof reportMarkdown>[0] = { id }
): Promise<void> {
  const created = await runInvestigationCli(root, [
    "new",
    id,
    "--title",
    options.title ?? id.slice(0, -".md".length),
    "--formed-at",
    options.formedAt ?? "2026-08-28T12:00:00+00:00",
    "--question",
    options.question ?? "候选应如何建立？",
    "--tag",
    (options.tags ?? ["investigation-report"])[0]!
  ]);
  assert.equal(created.status, 0, created.stderr);
  await fs.writeFile(
    candidatePath(root, id),
    reportMarkdown({ ...options, id }),
    "utf8"
  );
}

test("publish preflight leaves candidates untouched and normal publish establishes only its explicit selection", async () => {
  await withTempRoot("publish-selection", async (root) => {
    await createReadyCandidate(root, "first.md");
    await createReadyCandidate(root, "second.md");
    const firstCandidate = await fs.readFile(
      candidatePath(root, "first.md"),
      "utf8"
    );
    const secondCandidate = await fs.readFile(
      candidatePath(root, "second.md"),
      "utf8"
    );
    const preflight = await runInvestigationCli(root, [
      "publish",
      "first.md",
      "--preflight"
    ]);
    assert.equal(preflight.status, 0, preflight.stderr);
    assert.match(
      preflight.stdout,
      /no candidate, formal report, resource, index, or pending state was changed/u
    );
    assert.equal(
      await fs.readFile(candidatePath(root, "first.md"), "utf8"),
      firstCandidate
    );
    await assert.rejects(
      fs.access(path.join(investigationRoot(root), "first.md"))
    );
    await assert.rejects(
      fs.access(path.join(investigationRoot(root), "investigation-index.json"))
    );

    const published = await runInvestigationCli(root, ["publish", "first.md"]);
    assert.equal(published.status, 0, published.stderr);
    assert.equal(
      await fs.readFile(path.join(investigationRoot(root), "first.md"), "utf8"),
      firstCandidate
    );
    await assert.rejects(fs.access(candidatePath(root, "first.md")));
    assert.equal(
      await fs.readFile(candidatePath(root, "second.md"), "utf8"),
      secondCandidate
    );
    const checked = await runInvestigationCli(root, ["check"]);
    assert.equal(checked.status, 0, checked.stderr);
  });
});

test("publish requires selected relation closure and a fresh formal index", async () => {
  await withTempRoot("publish-baseline", async (root) => {
    await writeCollection(root, [{ id: "base.md" }]);
    await createReadyCandidate(root, "successor.md", {
      id: "successor.md",
      relations: [{ target: "missing.md", type: "补充" }]
    });
    const missingTarget = await publishInvestigationCandidates({
      ids: ["successor.md"],
      preflight: true,
      workspaceRoot: root
    });
    assert.ok(
      missingTarget.errors.some((error) => error.includes("missing.md"))
    );
    assert.equal(
      await fs.stat(candidatePath(root, "successor.md")).then(() => true),
      true
    );

    await fs.writeFile(
      candidatePath(root, "successor.md"),
      reportMarkdown({
        id: "successor.md",
        relations: [{ target: "base.md", type: "补充" }]
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
    assert.ok(stale.errors.some((error) => error.includes("index")));
    await fs.writeFile(
      path.join(investigationRoot(root), "base.md"),
      reportMarkdown({ id: "base.md" }),
      "utf8"
    );
    const synchronized = await runInvestigationCli(root, ["sync-index"]);
    assert.equal(synchronized.status, 0, synchronized.stderr);
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
      id: "merged.md",
      relations: [
        { target: "left.md", type: "归并" },
        { target: "right.md", type: "归并" }
      ]
    });
    const incomplete = await publishInvestigationCandidates({
      ids: ["merged.md"],
      preflight: true,
      workspaceRoot: root
    });
    assert.ok(incomplete.errors.some((error) => error.includes("left.md")));
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
      id: "split-left.md",
      relations: [{ target: "base.md", type: "拆分" }]
    });
    await createReadyCandidate(root, "split-right.md", {
      id: "split-right.md",
      relations: [{ target: "base.md", type: "拆分" }]
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

test("publish preserves candidate resources and rolls renamed candidates back when index publication fails", async () => {
  await withTempRoot("publish-resource-rollback", async (root) => {
    await createReadyCandidate(root, "resource-owner.md", {
      id: "resource-owner.md",
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

    const replacement = path.join(
      path.dirname(resource),
      "replacement-evidence.txt"
    );
    const identityDrift = await publishInvestigationCandidatesWithWriter(
      { ids: ["resource-owner.md"], workspaceRoot: root },
      async () =>
        assert.fail("index writer must not run after resource identity drift"),
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
    await fs.access(candidatePath(root, "resource-owner.md"));
    await assert.rejects(
      fs.access(path.join(investigationRoot(root), "resource-owner.md"))
    );

    const published = await publishInvestigationCandidatesWithWriter(
      { ids: ["resource-owner.md"], workspaceRoot: root },
      async (target, text) => await fs.writeFile(target, text, "utf8"),
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

test("publish rechecks candidate, formal source, and index drift before changing files", async () => {
  await withTempRoot("publish-candidate-drift", async (root) => {
    await writeCollection(root, [{ id: "formal.md" }]);
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

  await withTempRoot("publish-formal-index-drift", async (root) => {
    await writeCollection(root, [{ id: "formal.md" }]);
    await createReadyCandidate(root, "candidate.md");
    const candidate = candidatePath(root, "candidate.md");
    const formal = path.join(investigationRoot(root), "formal.md");
    const index = path.join(
      investigationRoot(root),
      "investigation-index.json"
    );
    const beforeCandidate = await fs.readFile(candidate, "utf8");
    const formalDrift = await publishInvestigationCandidatesWithWriter(
      { ids: ["candidate.md"], workspaceRoot: root },
      async () =>
        assert.fail("index writer must not run after formal source drift"),
      async () => await fs.appendFile(formal, "\n", "utf8")
    );
    assert.equal(formalDrift.changed, false);
    assert.ok(formalDrift.errors.length > 0);
    assert.equal(await fs.readFile(candidate, "utf8"), beforeCandidate);
    await fs.writeFile(formal, reportMarkdown({ id: "formal.md" }), "utf8");

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

test("discard-candidate protects shared and recorded authoring resources without changing formal reports", async () => {
  await withTempRoot("discard-candidate", async (root) => {
    await writeCollection(root, [{ id: "formal.md" }]);
    await createReadyCandidate(root, "candidate.md", {
      id: "candidate.md",
      resources: ["candidate/evidence.txt"]
    });
    await createReadyCandidate(root, "consumer.md", {
      id: "consumer.md",
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
    const shared = await discardInvestigationCandidate({
      deleteOwnedResources: true,
      id: "candidate.md",
      workspaceRoot: root
    });
    assert.ok(shared.errors.some((error) => error.includes("consumer.md")));
    assert.equal(
      await fs.readFile(
        path.join(investigationRoot(root), "formal.md"),
        "utf8"
      ),
      reportMarkdown({ id: "formal.md" })
    );

    await fs.rm(candidatePath(root, "consumer.md"));
    initializeGit(root);
    const recorded = await discardInvestigationCandidate({
      deleteOwnedResources: true,
      id: "candidate.md",
      workspaceRoot: root
    });
    assert.equal(recorded.requiresRecordedDeletionConfirmation, true);
    const discarded = await discardInvestigationCandidate({
      deleteOwnedResources: true,
      deleteRecordedCandidate: true,
      id: "candidate.md",
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
      reportMarkdown({ id: "formal.md" })
    );
  });
});

test("discard-candidate detects candidate drift before committing its tombstone", async () => {
  await withTempRoot("discard-candidate-drift", async (root) => {
    await createReadyCandidate(root, "candidate.md");
    const before = await fs.readFile(
      candidatePath(root, "candidate.md"),
      "utf8"
    );
    const discarded = await discardInvestigationCandidateWithHook(
      { id: "candidate.md", workspaceRoot: root },
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

test("discard-candidate reports pending cleanup after its tombstone commit", async () => {
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
        id: "candidate.md",
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

test("formal discard refuses owner resources still referenced by an authoring candidate", async () => {
  await withTempRoot("formal-discard-candidate-reference", async (root) => {
    await writeCollection(
      root,
      [{ id: "formal.md", resources: ["formal/evidence.txt"] }],
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
    const synchronized = await runInvestigationCli(root, ["sync-index"]);
    assert.equal(synchronized.status, 0, synchronized.stderr);
    await createReadyCandidate(root, "candidate.md", {
      id: "candidate.md",
      resources: ["formal/evidence.txt"]
    });
    const candidateDiscard = await discardInvestigationReport({
      id: "candidate.md",
      workspaceRoot: root
    });
    assert.equal(candidateDiscard.changed, false);
    assert.ok(
      candidateDiscard.errors.some((error) => error.includes("does not exist"))
    );
    await fs.access(candidatePath(root, "candidate.md"));
    const discarded = await discardInvestigationReport({
      deleteOwnedResources: true,
      id: "formal.md",
      workspaceRoot: root
    });
    assert.ok(discarded.errors.some((error) => error.includes("candidate.md")));
    assert.equal(await fs.readFile(resource, "utf8"), "evidence");
  });
});

test("destructive discards fail closed when candidate resource references cannot be read", async () => {
  await withTempRoot("candidate-reference-read-failure", async (root) => {
    await writeCollection(
      root,
      [{ id: "formal.md", resources: ["formal/evidence.txt"] }],
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
    const synchronized = await runInvestigationCli(root, ["sync-index"]);
    assert.equal(synchronized.status, 0, synchronized.stderr);
    await createReadyCandidate(root, "candidate.md");
    await fs.writeFile(
      candidatePath(root, "candidate.md"),
      "invalid\n",
      "utf8"
    );

    const discarded = await discardInvestigationReport({
      deleteOwnedResources: true,
      id: "formal.md",
      workspaceRoot: root
    });
    assert.equal(discarded.changed, false);
    assert.ok(discarded.errors.some((error) => error.includes("candidate.md")));
    assert.equal(await fs.readFile(resource, "utf8"), "evidence");
    await fs.access(path.join(investigationRoot(root), "formal.md"));
  });
});

test("candidate discard fails closed when formal resource references are invalid", async () => {
  await withTempRoot(
    "candidate-discard-invalid-formal-reference",
    async (root) => {
      await writeCollection(root, [{ id: "formal.md" }]);
      await createReadyCandidate(root, "candidate.md", {
        id: "candidate.md",
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
          id: "formal.md",
          resources: ["candidate/evidence.txt"]
        }).replace("## 调查目的", "## 非法章节"),
        "utf8"
      );

      const discarded = await discardInvestigationCandidate({
        deleteOwnedResources: true,
        id: "candidate.md",
        workspaceRoot: root
      });
      assert.equal(discarded.changed, false);
      assert.ok(discarded.errors.length > 0);
      await fs.access(candidatePath(root, "candidate.md"));
      assert.equal(await fs.readFile(resource, "utf8"), "evidence");
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
      { id: "candidate.md", workspaceRoot: root },
      async () => {
        execFileSync(
          "git",
          [
            "-C",
            root,
            "add",
            path.join("docs", "investigations", "_candidate.candidate.md")
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

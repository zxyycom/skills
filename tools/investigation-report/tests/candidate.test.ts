import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import {
  createInvestigationCandidate,
  listInvestigationCandidates,
  showInvestigationCandidate
} from "../src/candidate.ts";
import { candidatePathForInvestigationId } from "../src/candidate-path.ts";
import {
  runInvestigationCli,
  reportMarkdown,
  withTempRoot,
  writeCollection
} from "./v6-support.ts";
import {
  inspectInvestigationCollectionLayout,
  readInvestigationSourceRevision
} from "../src/investigation-index-source.ts";
import { validateInvestigationReports } from "../src/validation.ts";

const candidateInput = {
  formedAt: "2026-09-02T12:00:00+00:00",
  id: "candidate-topic.md",
  question: "候选是否在建立前保持集合外？",
  relations: [],
  tags: ["candidate", "investigation-report"],
  title: "候选调查"
} as const;

test("new atomically creates a canonical candidate scaffold without establishing a formal report", async () => {
  await withTempRoot("candidate-new", async (root) => {
    await fs.mkdir(path.join(root, "docs", "investigations"), {
      recursive: true
    });
    const result = await createInvestigationCandidate({
      ...candidateInput,
      workspaceRoot: root
    });

    assert.equal(result.status, "ok");
    assert.equal(result.changed, true);
    assert.equal(result.candidate.readiness.scaffoldValid, true);
    assert.equal(result.candidate.readiness.bodyReady, false);
    assert.equal(result.candidate.readiness.resourceReady, true);
    assert.equal(result.errors.length, 0);
    assert.match(
      await fs.readFile(result.candidate.path, "utf8"),
      /^---\ntitle: "候选调查"\nformedAt: "2026-09-02T12:00:00\+00:00"/u
    );

    const layout = await inspectInvestigationCollectionLayout(
      path.join(root, "docs", "investigations")
    );
    assert.deepEqual(layout.errors, []);
    assert.deepEqual(layout.reportIds, []);
    assert.deepEqual(layout.candidateIds, [candidateInput.id]);
  });
});

test("new rejects invalid, duplicate, and formal-conflicting candidate identities without overwriting files", async () => {
  await withTempRoot("candidate-identities", async (root) => {
    await writeCollection(root, [{ id: "formal-topic.md" }], false);
    const invalid = await createInvestigationCandidate({
      ...candidateInput,
      id: "not a report",
      workspaceRoot: root
    });
    assert.equal(invalid.status, "invalid-options");
    assert.equal(invalid.changed, false);
    const duplicateTags = await createInvestigationCandidate({
      ...candidateInput,
      tags: ["candidate", "candidate"],
      workspaceRoot: root
    });
    assert.equal(duplicateTags.status, "invalid-options");
    const duplicateRelations = await createInvestigationCandidate({
      ...candidateInput,
      relations: [
        { target: "formal-topic.md", type: "补充" },
        { target: "formal-topic.md", type: "修正" }
      ],
      workspaceRoot: root
    });
    assert.equal(duplicateRelations.status, "invalid-options");
    const malformedFormedAt = await createInvestigationCandidate({
      ...candidateInput,
      formedAt: "2026-09-02",
      workspaceRoot: root
    });
    assert.equal(malformedFormedAt.status, "invalid-options");
    const selfRelation = await createInvestigationCandidate({
      ...candidateInput,
      relations: [{ target: candidateInput.id, type: "补充" }],
      workspaceRoot: root
    });
    assert.equal(selfRelation.status, "invalid-options");

    const conflict = await createInvestigationCandidate({
      ...candidateInput,
      id: "formal-topic.md",
      workspaceRoot: root
    });
    assert.equal(conflict.status, "error");
    assert.equal(conflict.changed, false);
    assert.ok(conflict.errors.some((error) => error.includes("formal")));

    const created = await createInvestigationCandidate({
      ...candidateInput,
      workspaceRoot: root
    });
    assert.equal(created.status, "ok");
    const original = await fs.readFile(created.candidate.path, "utf8");
    const repeated = await createInvestigationCandidate({
      ...candidateInput,
      workspaceRoot: root
    });
    assert.equal(repeated.status, "error");
    assert.equal(repeated.changed, false);
    assert.equal(await fs.readFile(created.candidate.path, "utf8"), original);

    const lockPath = path.join(
      root,
      "docs",
      ".investigation-index.json.mutation.lock"
    );
    await fs.writeFile(lockPath, "held\n", "utf8");
    try {
      const locked = await createInvestigationCandidate({
        ...candidateInput,
        id: "locked.md",
        workspaceRoot: root
      });
      assert.equal(locked.status, "error");
      assert.equal(locked.changed, false);
      assert.ok(
        locked.diagnostics.some(
          (diagnostic) =>
            diagnostic.code === "investigation-report.collection-lock-busy"
        )
      );
      await assert.rejects(
        fs.access(
          candidatePathForInvestigationId(
            path.join(root, "docs", "investigations"),
            "locked.md"
          )
        )
      );
    } finally {
      await fs.rm(lockPath, { force: true });
    }

    const linkedId = "linked.md";
    const linkedPath = candidatePathForInvestigationId(
      path.join(root, "docs", "investigations"),
      linkedId
    );
    await fs.symlink(path.join(root, "outside-candidate.md"), linkedPath);
    const linked = await createInvestigationCandidate({
      ...candidateInput,
      id: linkedId,
      workspaceRoot: root
    });
    assert.equal(linked.status, "error");
    assert.equal(linked.changed, false);
    assert.ok(linked.errors.some((error) => error.includes("symbolic link")));
    assert.equal((await fs.lstat(linkedPath)).isSymbolicLink(), true);
    await fs.rm(linkedPath, { force: true });

    const concurrentId = "concurrent.md";
    const concurrent = await Promise.all(
      [0, 1].map(
        async () =>
          await createInvestigationCandidate({
            ...candidateInput,
            id: concurrentId,
            workspaceRoot: root
          })
      )
    );
    assert.equal(
      concurrent.filter((result) => result.status === "ok").length,
      1
    );
    assert.equal(
      concurrent.filter((result) => result.status === "error").length,
      1
    );
    await fs.access(
      candidatePathForInvestigationId(
        path.join(root, "docs", "investigations"),
        concurrentId
      )
    );
  });
});

test("candidate queries report readiness while formal sources and default checks ignore a candidate-owned resource", async () => {
  await withTempRoot("candidate-readiness", async (root) => {
    await writeCollection(root, [{ id: "formal.md" }]);
    const created = await createInvestigationCandidate({
      ...candidateInput,
      workspaceRoot: root
    });
    assert.equal(created.status, "ok");
    const candidatePath = candidatePathForInvestigationId(
      path.join(root, "docs", "investigations"),
      candidateInput.id
    );
    await fs.writeFile(
      candidatePath,
      (await fs.readFile(candidatePath, "utf8"))
        .replace("## 形成时背景\n", "## 形成时背景\n候选背景。\n")
        .replace("## 调查目的\n", "## 调查目的\n候选目的。\n")
        .replace("## 调查范围与依据\n", "## 调查范围与依据\n候选依据。\n")
        .replace(
          "## 调查结果与边界\n",
          "## 调查结果与边界\n候选边界。\n\n## 随附资源\n- [证据](./_resources/candidate-topic/evidence.txt)\n"
        ),
      "utf8"
    );
    await fs.mkdir(
      path.join(
        root,
        "docs",
        "investigations",
        "_resources",
        "candidate-topic"
      ),
      { recursive: true }
    );
    await fs.writeFile(
      path.join(
        root,
        "docs",
        "investigations",
        "_resources",
        "candidate-topic",
        "evidence.txt"
      ),
      "evidence\n",
      "utf8"
    );

    const candidates = await listInvestigationCandidates({
      workspaceRoot: root
    });
    assert.equal(candidates.status, "ok");
    assert.equal(candidates.candidates.length, 1);
    assert.deepEqual(candidates.candidates[0]?.readiness, {
      bodyReady: true,
      resourceReady: true,
      scaffoldValid: true
    });
    const shown = await showInvestigationCandidate({
      id: candidateInput.id,
      workspaceRoot: root
    });
    assert.equal(shown.status, "ok");
    assert.match(shown.candidate.markdown ?? "", /候选边界/u);

    const indexRevision = await readInvestigationSourceRevision(
      path.join(root, "docs", "investigations")
    );
    assert.deepEqual(Object.keys(indexRevision.entries), ["formal.md"]);
    const synchronized = await runInvestigationCli(root, ["sync-index"]);
    assert.equal(synchronized.status, 0, synchronized.stderr);
    const listed = await runInvestigationCli(root, ["list"]);
    assert.equal(listed.status, 0, listed.stderr);
    assert.match(listed.stdout, /formal\.md/u);
    assert.doesNotMatch(listed.stdout, /candidate-topic\.md/u);
    const formal = await runInvestigationCli(root, ["show", "formal.md"]);
    assert.equal(formal.status, 0, formal.stderr);
    assert.doesNotMatch(formal.stdout, /候选边界/u);
    const traced = await runInvestigationCli(root, ["trace", "formal.md"]);
    assert.equal(traced.status, 0, traced.stderr);
    assert.match(traced.stdout, /Reports: formal\.md/u);
    const checked = await validateInvestigationReports({ workspaceRoot: root });
    assert.deepEqual(checked.errors, []);
    assert.ok(
      !checked.warnings.some((warning) =>
        warning.includes("candidate-topic.md does not exist")
      )
    );

    initializeGit(root);
    await fs.writeFile(
      path.join(root, "docs", "investigations", "formal.md"),
      reportMarkdown({ id: "formal.md", title: "更新后的正式报告" }),
      "utf8"
    );
    const resynchronized = await runInvestigationCli(root, ["sync-index"]);
    assert.equal(resynchronized.status, 0, resynchronized.stderr);
    const staged = await runInvestigationCli(root, [
      "stage-index",
      "formal.md"
    ]);
    assert.equal(staged.status, 0, staged.stderr);
    assert.deepEqual(
      git(root, ["diff", "--cached", "--name-only"]).trim(),
      "docs/investigations/investigation-index.json"
    );
    assert.equal(
      git(root, [
        "diff",
        "--cached",
        "--",
        "docs/investigations/_candidate.candidate-topic.md"
      ]),
      ""
    );
  });
});

test("candidate readiness requires every visible candidate-owned resource to have a direct owner reference", async () => {
  await withTempRoot("candidate-owner-resources", async (root) => {
    await writeCollection(root, [{ id: "formal.md" }]);
    const created = await createInvestigationCandidate({
      ...candidateInput,
      workspaceRoot: root
    });
    assert.equal(created.status, "ok");
    const rootPath = path.join(root, "docs", "investigations");
    await fs.writeFile(
      candidatePathForInvestigationId(rootPath, candidateInput.id),
      reportMarkdown({
        id: candidateInput.id,
        resources: ["candidate-topic/referenced.txt"]
      }),
      "utf8"
    );
    const resources = path.join(rootPath, "_resources", "candidate-topic");
    await fs.mkdir(resources, { recursive: true });
    await fs.writeFile(
      path.join(resources, "referenced.txt"),
      "used\n",
      "utf8"
    );
    await fs.writeFile(
      path.join(resources, "unreferenced.txt"),
      "unused\n",
      "utf8"
    );

    const candidate = await showInvestigationCandidate({
      id: candidateInput.id,
      workspaceRoot: root
    });
    assert.equal(candidate.status, "ok");
    assert.equal(candidate.candidate.readiness.scaffoldValid, true);
    assert.equal(candidate.candidate.readiness.bodyReady, true);
    assert.equal(candidate.candidate.readiness.resourceReady, false);
    assert.ok(
      candidate.candidate.errors.some((error) =>
        error.includes("candidate owner resources must be directly referenced")
      )
    );
    const checked = await validateInvestigationReports({ workspaceRoot: root });
    assert.deepEqual(checked.errors, []);
  });
});

test("candidate root safety failures block formal checks and candidate CLI keeps creation success separate from readiness", async () => {
  await withTempRoot("candidate-cli-and-safety", async (root) => {
    await writeCollection(root, [{ id: "formal.md" }], false);
    const created = await runInvestigationCli(root, [
      "new",
      candidateInput.id,
      "--title",
      candidateInput.title,
      "--formed-at",
      candidateInput.formedAt,
      "--question",
      candidateInput.question,
      "--tag",
      "candidate",
      "--tag",
      "investigation-report"
    ]);
    assert.equal(created.status, 0);
    assert.match(created.stdout, /Investigation candidate created:/u);
    assert.match(created.stderr, /body: incomplete/u);
    assert.match(created.stderr, /publish --preflight/u);

    const show = await runInvestigationCli(root, [
      "show-candidate",
      candidateInput.id
    ]);
    assert.equal(show.status, 0);
    assert.match(show.stdout, /## 调查目的/u);

    await fs.writeFile(
      path.join(root, "docs", "investigations", "_candidate.bad-id"),
      "bad\n",
      "utf8"
    );
    const checked = await validateInvestigationReports({ workspaceRoot: root });
    assert.ok(
      checked.errors.some((error) => error.includes("reserved _candidate"))
    );
    const scoped = await validateInvestigationReports({
      ids: ["formal.md"],
      workspaceRoot: root
    });
    assert.ok(
      scoped.errors.some((error) => error.includes("reserved _candidate"))
    );
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
    git(root, args);
  }
}

function git(root: string, args: readonly string[]): string {
  return execFileSync("git", ["-C", root, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
}

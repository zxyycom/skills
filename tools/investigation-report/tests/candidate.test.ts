import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import {
  createInvestigationCandidate,
  showInvestigationCandidate
} from "../src/candidate.ts";
import os from "node:os";
import { prepareCandidateCreate } from "../src/candidate-creation-input.ts";
import { serializeInvestigationCandidate } from "../src/candidate-format.ts";
import { candidatePathForInvestigationId } from "../src/candidate-path.ts";
import { reportMarkdown, withTempRoot } from "./fixture-support.ts";
import { writeCollection } from "./collection-support.ts";
import { inspectInvestigationCollectionLayout } from "../src/investigation-index-source.ts";
import { validateInvestigationReports } from "../src/validation.ts";

const candidateInput = {
  formedAt: "2026-09-02T12:00:00+00:00",
  id: "candidate-topic",
  question: "候选是否在建立前保持集合外？",
  relations: [],
  tags: ["candidate", "investigation-report"],
  title: "候选调查"
} as const;
const candidateId = "260902-candidate-topic";

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
      /^---\ntitle: "候选调查"\nid: "260902-candidate-topic"\nformedAt: "2026-09-02T12:00:00\+00:00"/u
    );

    const layout = await inspectInvestigationCollectionLayout(
      path.join(root, "docs", "investigations")
    );
    assert.deepEqual(layout.errors, []);
    assert.deepEqual(layout.reportIds, []);
    assert.deepEqual(layout.candidateIds, [candidateId]);
  });
});

test("new rejects invalid, duplicate, and formal-conflicting candidate identities without overwriting files", async () => {
  await withTempRoot("candidate-identities", async (root) => {
    await writeCollection(root, [
      { id: "260902-formal-topic", formedAt: candidateInput.formedAt }
    ]);
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
        { target: "formal-topic", type: "补充" },
        { target: "formal-topic", type: "修正" }
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
      id: "formal-topic",
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
        id: "locked",
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
            "locked"
          )
        )
      );
    } finally {
      await fs.rm(lockPath, { force: true });
    }

    const linkedId = "linked";
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

    const concurrentId = "260902-concurrent";
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

test("new allows legacy and cross-day same-name records while rejecting a complete ID collision", async () => {
  await withTempRoot("candidate-legacy-migration", async (root) => {
    const migratedCandidateId = "260902-legacy-topic";
    await writeCollection(root, [
      {
        formedAt: "2026-09-01T12:00:00+00:00",
        id: "legacy-topic"
      }
    ]);
    const created = await createInvestigationCandidate({
      ...candidateInput,
      id: "legacy-topic",
      workspaceRoot: root
    });
    assert.equal(created.status, "ok");
    assert.equal(created.candidate.id, migratedCandidateId);
    assert.match(created.candidate.path, /_candidate\.260902-legacy-topic$/);
    assert.equal(
      (
        await fs.readFile(
          path.join(root, "docs/investigations/legacy-topic.md"),
          "utf8"
        )
      ).includes('id: "legacy-topic"'),
      true
    );
    const repeated = await createInvestigationCandidate({
      ...candidateInput,
      id: "legacy-topic",
      workspaceRoot: root
    });
    assert.equal(repeated.status, "error");
    const nextDay = await createInvestigationCandidate({
      ...candidateInput,
      formedAt: "2026-09-03T12:00:00Z",
      id: "legacy-topic",
      workspaceRoot: root
    });
    assert.equal(nextDay.status, "ok");
    assert.match(nextDay.candidate.path, /_candidate\.260903-legacy-topic$/);
  });
});

test("candidate API normalizes optional relation summaries and rejects invalid values", () => {
  const boundarySummary = "😀".repeat(40);
  const accepted = prepareCandidateCreate({
    ...candidateInput,
    id: "summary-boundary",
    relations: [
      { type: "补充", target: "260828-base", summary: `  ${boundarySummary}  ` }
    ],
    workspaceRoot: os.tmpdir()
  });
  if (accepted.isErr()) assert.fail(accepted.error.join("\n"));
  assert.deepEqual(accepted.value.candidate.relations, [
    { type: "补充", target: "260828-base", summary: boundarySummary }
  ]);
  assert.match(
    serializeInvestigationCandidate(accepted.value.candidate),
    new RegExp(`summary: ${JSON.stringify(boundarySummary)}`, "u")
  );
  const omitted = prepareCandidateCreate({
    ...candidateInput,
    id: "summary-omitted",
    relations: [{ type: "补充", target: "260828-base", summary: "   " }],
    workspaceRoot: os.tmpdir()
  });
  if (omitted.isErr()) assert.fail(omitted.error.join("\n"));
  assert.deepEqual(omitted.value.candidate.relations, [
    { type: "补充", target: "260828-base" }
  ]);
  assert.doesNotMatch(
    serializeInvestigationCandidate(omitted.value.candidate),
    /summary:/u
  );
  for (const summary of ["first\nsecond", "😀".repeat(41)]) {
    const rejected = prepareCandidateCreate({
      ...candidateInput,
      relations: [{ type: "补充", target: "260828-base", summary }],
      workspaceRoot: os.tmpdir()
    });
    assert.ok(rejected.isErr());
  }
});

test("candidate readiness requires every visible candidate-owned resource to have a direct owner reference", async () => {
  await withTempRoot("candidate-owner-resources", async (root) => {
    await writeCollection(root, [{ id: "formal" }]);
    const created = await createInvestigationCandidate({
      ...candidateInput,
      workspaceRoot: root
    });
    assert.equal(created.status, "ok");
    const rootPath = path.join(root, "docs", "investigations");
    await fs.writeFile(
      candidatePathForInvestigationId(rootPath, candidateId),
      reportMarkdown({
        id: candidateId,
        formedAt: candidateInput.formedAt,
        resources: ["260902-candidate-topic/referenced.txt"]
      }),
      "utf8"
    );
    const resources = path.join(rootPath, "_resources", candidateId);
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
      id: candidateId,
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

test("new and candidate show reject missing published indexes without reading existing formal headers", async () => {
  await withTempRoot("candidate-local-draft", async (root) => {
    await writeCollection(root, [{ id: "unrelated" }], false);
    const formalPath = path.join(root, "docs/investigations/unrelated.md");
    await fs.writeFile(
      formalPath,
      reportMarkdown({ id: "unrelated" }).replace(
        /\n##[\s\S]*/u,
        "\nmalformed unrelated formal body\n"
      )
    );
    const open = fs.open;
    let formalReads = 0;
    fs.open = (async (...args: Parameters<typeof fs.open>) => {
      if (args[0] === formalPath) {
        formalReads += 1;
      }
      return await open(...args);
    }) as typeof fs.open;
    try {
      const created = await createInvestigationCandidate({
        ...candidateInput,
        workspaceRoot: root
      });
      assert.equal(created.status, "error");
      assert.equal(created.changed, false);
      const shown = await showInvestigationCandidate({
        workspaceRoot: root,
        id: candidateId
      });
      assert.equal(shown.status, "error");
      assert.equal(formalReads, 0);
    } finally {
      fs.open = open;
    }
  });
});

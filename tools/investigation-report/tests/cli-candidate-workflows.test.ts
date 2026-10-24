import assert from "node:assert/strict";

import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import {
  createInvestigationCandidate,
  listInvestigationCandidates,
  showInvestigationCandidate
} from "../src/candidate.ts";

import { candidatePathForInvestigationId } from "../src/candidate-path.ts";
import { runInvestigationCli } from "./cli-support.ts";
import { withTempRoot } from "./fixture-support.ts";
import { writeCollection } from "./collection-support.ts";
import { readInvestigationSourceRevision } from "../src/investigation-index-source.ts";
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

test("candidate queries report readiness while formal sources and default checks ignore a candidate-owned resource", async () => {
  await withTempRoot("candidate-readiness", async (root) => {
    await writeCollection(root, [{ id: "formal" }]);
    const created = await createInvestigationCandidate({
      ...candidateInput,
      workspaceRoot: root
    });
    assert.equal(created.status, "ok");
    const candidatePath = candidatePathForInvestigationId(
      path.join(root, "docs", "investigations"),
      candidateId
    );
    await fs.writeFile(
      candidatePath,
      (await fs.readFile(candidatePath, "utf8"))
        .replace("## 形成时背景\n", "## 形成时背景\n候选背景。\n")
        .replace("## 调查目的\n", "## 调查目的\n候选目的。\n")
        .replace("## 调查范围与依据\n", "## 调查范围与依据\n候选依据。\n")
        .replace(
          "## 调查结果与边界\n",
          "## 调查结果与边界\n候选边界。\n\n## 随附资源\n- [证据](./_resources/260902-candidate-topic/evidence.txt)\n"
        ),
      "utf8"
    );
    await fs.mkdir(
      path.join(root, "docs", "investigations", "_resources", candidateId),
      { recursive: true }
    );
    await fs.writeFile(
      path.join(
        root,
        "docs",
        "investigations",
        "_resources",
        candidateId,
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
    assert.deepEqual(Object.keys(indexRevision.entries), ["formal"]);
    const synchronized = await runInvestigationCli(root, ["sync-index"]);
    assert.equal(synchronized.status, 0, synchronized.stderr);
    const listed = await runInvestigationCli(root, ["list"]);
    assert.equal(listed.status, 0, listed.stderr);
    assert.match(listed.stdout, /formal/u);
    assert.doesNotMatch(listed.stdout, /candidate-topic/u);
    const formal = await runInvestigationCli(root, ["show", "formal.md"]);
    assert.equal(formal.status, 0, formal.stderr);
    assert.doesNotMatch(formal.stdout, /候选边界/u);
    const traced = await runInvestigationCli(root, [
      "trace",
      "formal.md",
      "--json"
    ]);
    assert.equal(traced.status, 0, traced.stderr);
    assert.deepEqual(JSON.parse(traced.stdout).traceIds, ["formal"]);
    const checked = await validateInvestigationReports({ workspaceRoot: root });
    assert.deepEqual(checked.errors, []);
    assert.ok(
      !checked.warnings.some((warning) =>
        warning.includes("candidate-topic does not exist")
      )
    );
  });
});

test("candidate root safety failures block formal checks and candidate CLI keeps creation success separate from readiness", async () => {
  await withTempRoot("candidate-cli-and-safety", async (root) => {
    await writeCollection(root, [{ id: "formal" }]);
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
    assert.match(created.stdout, /260902-candidate-topic/u);
    assert.match(created.stdout, /title: 候选调查/u);
    assert.match(created.stdout, /path: .*_candidate\.260902-candidate-topic/u);
    assert.match(created.stdout, /scaffoldValid: true/u);
    assert.match(created.stdout, /bodyReady: false/u);
    assert.match(created.stdout, /resourceReady: true/u);
    assert.doesNotMatch(created.stdout, /preflight/u);
    assert.doesNotMatch(created.stderr + created.stdout, /next:/u);
    assert.doesNotMatch(created.stdout, /## 调查目的/u);

    const show = await runInvestigationCli(root, [
      "show-candidate",
      candidateInput.id
    ]);
    assert.equal(show.status, 0);
    assert.match(show.stdout, /## 调查目的/u);

    await fs.writeFile(
      path.join(root, "docs", "investigations", "_candidate.bad-id.md"),
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
    assert.deepEqual(scoped.errors, []);
    assert.equal(scoped.indexChecked, false);
  });
});

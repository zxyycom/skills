import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  loadCandidateIdentityContext,
  readCandidateSelection
} from "../../../src/candidates/decision-candidate-context.ts";
import { createDecisionCandidate } from "../../../src/candidates/decision-candidate-service.ts";
import { isDecisionTag } from "../../../src/collection/decision-path.ts";
import { executeDecisionQuery } from "../../../src/query/decision-query-service.ts";
import {
  candidateDecisionBody,
  decisionIdForTest
} from "../../support/support-record-fixture.ts";
import {
  observeCandidateReads,
  withPublishedCandidateFixture
} from "./published-support.ts";

test("Decision candidate operations reuse published identities without reading unrelated formal headers", async (context) => {
  await withPublishedCandidateFixture(async (fixture) => {
    const location = {
      workspaceRoot: fixture.root,
      decisionsDir: "docs/decisions"
    };
    for (const command of [
      "readiness",
      "candidates",
      "show-candidate"
    ] as const) {
      const observed = await observeCandidateReads(fixture, async () => {
        if (command === "readiness") {
          const selected = await readCandidateSelection(
            { workspaceRoot: fixture.root },
            "ready-one"
          );
          assert.equal(selected.records.length, 1);
        } else {
          const result =
            command === "candidates"
              ? await executeDecisionQuery({ command, location })
              : await executeDecisionQuery({
                  command,
                  location,
                  decisionId: "ready-one"
                });
          assert.equal(result.status, "ok");
        }
      });
      assert.deepEqual(observed.counts.formal, {
        opens: 0,
        handleReads: 0,
        reads: 0
      });
      assert.deepEqual(observed.counts.other, {
        opens: 2,
        handleReads: 2,
        reads: 0
      });
      context.diagnostic(`${command}: ${JSON.stringify(observed.counts)}`);
    }
    const tag = "candidate";
    assert.ok(isDecisionTag(tag));
    const created = await observeCandidateReads(fixture, () =>
      createDecisionCandidate({
        workspaceRoot: fixture.root,
        decisionId: decisionIdForTest("bounded-new"),
        title: "有界起草",
        purpose: "只读取候选",
        background: "正式身份由已验基线提供",
        decision: "保持发布门禁",
        tags: [tag],
        relations: []
      })
    );
    assert.equal(created.value.status, "ok");
    assert.deepEqual(created.counts.formal, {
      opens: 0,
      handleReads: 0,
      reads: 0
    });
    assert.ok(
      created.counts.other.opens <= 16,
      "new reads only the small candidate set and its own write verification"
    );
    assert.ok(created.counts.other.handleReads <= 16);
    context.diagnostic(`new: ${JSON.stringify(created.counts)}`);
  });
});

test("Decision published candidate discovery still reads unknown locations and rejects unsafe or conflicting members", async () => {
  await withPublishedCandidateFixture(async (fixture) => {
    const unknown = path.join(fixture.directory, "unindexed-location.md");
    await fs.writeFile(unknown, "unclassifiable member\n");
    await assert.rejects(
      loadCandidateIdentityContext(fixture.directory),
      /cannot be safely classified/
    );
    const extra = candidateDecisionBody({ id: "261021-extra" })
      .replace("status: candidate", "status: active")
      .replace("alignment: null", "alignment: aligned")
      .replace("createdAt: null", "createdAt: 2026-10-21T00:00:00+00:00");
    await fs.writeFile(unknown, extra);
    const discovered = await observeCandidateReads(fixture, () =>
      loadCandidateIdentityContext(fixture.directory)
    );
    assert.equal(
      discovered.value.collection.identityById.has("261021-extra"),
      false
    );
    assert.equal(discovered.counts.formal.handleReads, 0);
    assert.equal(discovered.counts.other.handleReads, 3);
    await fs.rm(unknown);
    const selectedPath = path.join(fixture.directory, "candidate-one.md");
    const selectedText = await fs.readFile(selectedPath, "utf8");
    await fs.writeFile(
      selectedPath,
      candidateDecisionBody({
        id: "261022-ready-one",
        relations: [{ type: "修订", target: fixture.formal[0]!.id }]
      })
    );
    const dependency = await observeCandidateReads(fixture, async () => {
      const selected = await readCandidateSelection(
        { workspaceRoot: fixture.root },
        "ready-one"
      );
      assert.equal(selected.records[0]?.decisionId, "261022-ready-one");
    });
    assert.equal(dependency.counts.formal.opens, 0);
    assert.equal(dependency.counts.formal.handleReads, 0);
    await fs.writeFile(selectedPath, selectedText);
    const duplicate = path.join(fixture.directory, "duplicate.md");
    await fs.writeFile(
      duplicate,
      candidateDecisionBody({ id: fixture.formal[0]!.id })
    );
    await assert.rejects(
      loadCandidateIdentityContext(fixture.directory),
      /more than one source path|both candidate and formal/
    );
    await fs.rm(duplicate);
    const known = path.join(fixture.directory, fixture.formal[0]!.sourcePath);
    await fs.rm(known);
    await fs.mkdir(known);
    await assert.rejects(
      loadCandidateIdentityContext(fixture.directory),
      /allowed regular Decision member/
    );
    await fs.rmdir(known);
    await fs.symlink(path.join(fixture.directory, "candidate-one.md"), known);
    await assert.rejects(
      loadCandidateIdentityContext(fixture.directory),
      /allowed regular Decision member/
    );
    await fs.rm(known);
    await fs.writeFile(known, "malformed unrelated formal content\n");
    const baseline = await fs.readFile(fixture.indexPath, "utf8");
    const invalid = JSON.parse(baseline);
    invalid.definitionVersion += 100;
    for (const text of ["invalid JSON", JSON.stringify(invalid)]) {
      await fs.writeFile(fixture.indexPath, text);
      const observed = await observeCandidateReads(fixture, async () => {
        await assert.rejects(
          loadCandidateIdentityContext(fixture.directory),
          /explicitly sync-index/
        );
      });
      assert.equal(observed.counts.formal.opens, 0);
    }
    await fs.rm(fixture.indexPath);
    await assert.rejects(
      loadCandidateIdentityContext(fixture.directory),
      /cannot be safely classified/
    );
    for (const source of fixture.formal)
      await fs.writeFile(
        path.join(fixture.directory, source.sourcePath),
        source.text.replace(/\n##[\s\S]*/u, "\nmalformed formal body\n")
      );
    const missing = await observeCandidateReads(fixture, async () => {
      await assert.rejects(
        loadCandidateIdentityContext(fixture.directory),
        /formal index is missing.*explicitly recover/
      );
    });
    assert.equal(missing.counts.formal.handleReads, 1);
  });
});

test("Decision published candidate discovery rejects archive parent replacement during directory reads", async () => {
  for (const replacement of ["symlink", "directory"] as const) {
    await withPublishedCandidateFixture(async (fixture) => {
      const archive = path.join(fixture.directory, "archive");
      const outside = path.join(fixture.root, "outside-archive");
      const saved = path.join(fixture.root, "saved-archive");
      await fs.mkdir(outside);
      for (const source of fixture.formal.filter(({ sourcePath }) =>
        sourcePath.startsWith("archive/")
      ))
        await fs.writeFile(
          path.join(outside, path.basename(source.sourcePath)),
          "unrelated external contents\n"
        );
      const original = fs.readdir;
      let replaced = false;
      fs.readdir = (async (...args: Parameters<typeof fs.readdir>) => {
        if (args[0] === archive && !replaced) {
          replaced = true;
          await fs.rename(archive, saved);
          if (replacement === "symlink") await fs.symlink(outside, archive);
          else await fs.rename(outside, archive);
        }
        return await original(...args);
      }) as typeof fs.readdir;
      try {
        const observed = await observeCandidateReads(fixture, async () => {
          await assert.rejects(
            loadCandidateIdentityContext(fixture.directory),
            /identity changed|canonical directory/
          );
        });
        assert.equal(
          replaced,
          true,
          "replacement occurs after the root Dirent and archive identity were acquired"
        );
        assert.deepEqual(observed.counts.formal, {
          opens: 0,
          handleReads: 0,
          reads: 0
        });
      } finally {
        fs.readdir = original;
      }
    });
  }
});

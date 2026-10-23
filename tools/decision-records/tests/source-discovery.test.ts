import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { decisionSourceIdentityFromMarkdown } from "../src/decision-metadata.ts";
import { validateSourceMembership } from "../src/scan-collection.ts";
import type { SourceFile } from "../src/scan-contracts.ts";
import { scanSourceFiles } from "../src/scan-records.ts";
import {
  readDecisionSourceRevision,
  readDecisionStateSnapshot
} from "../src/decision-index-source.ts";
import { syncDecisionIndex } from "../src/decision-state-index.ts";
import { candidateDecisionBody, withTemporaryWorkspace } from "./support.ts";

test("Decision discovery parses YAML identity and candidate status together without full body validation", () => {
  const candidate = candidateDecisionBody({ id: "261020-source-identity" });
  for (const markdown of [
    candidate,
    "\uFEFF" + candidate.replaceAll("\n", "\r\n"),
    candidate.replace(
      "id: 261020-source-identity",
      'id: "261020-source-identity"'
    )
  ]) {
    assert.deepEqual(decisionSourceIdentityFromMarkdown(markdown), {
      decisionId: "261020-source-identity",
      isCandidate: true
    });
  }
  assert.deepEqual(
    decisionSourceIdentityFromMarkdown(
      candidate.replace("## 目的", "## 未完成")
    ),
    { decisionId: "261020-source-identity", isCandidate: true }
  );
  assert.deepEqual(
    decisionSourceIdentityFromMarkdown(
      candidate.replace("status: candidate", "status: active")
    ),
    { decisionId: "261020-source-identity", isCandidate: false }
  );
  for (const markdown of [
    "no frontmatter",
    "---\nid: [broken\nstatus: candidate\n---\n"
  ]) {
    assert.deepEqual(decisionSourceIdentityFromMarkdown(markdown), {
      decisionId: null,
      isCandidate: false
    });
  }
  assert.deepEqual(
    decisionSourceIdentityFromMarkdown(
      candidate.replace("id: 261020-source-identity", "id: invalid_name")
    ),
    { decisionId: null, isCandidate: true }
  );
});

test("Decision membership carries source bytes and parsed identity into scanning while later discovery stays fresh", async () => {
  await withTemporaryWorkspace("membership-source-identity", async (root) => {
    const decisionPath = path.join(root, "source.md");
    const original = candidateDecisionBody({ id: "261020-original" });
    await fs.writeFile(decisionPath, original);
    const source: SourceFile = { decisionPath, sourcePath: "source.md" };
    const collectionErrors: string[] = [];
    const sourceErrors: string[] = [];
    const availableDecisionIds = await validateSourceMembership(
      [source],
      collectionErrors,
      sourceErrors
    );
    assert.deepEqual([...availableDecisionIds], ["261020-original"]);
    assert.equal(source.decisionId, "261020-original");
    assert.equal(source.sourceText, original);
    await fs.writeFile(
      decisionPath,
      candidateDecisionBody({ id: "261020-next" })
    );
    const records = await scanSourceFiles({
      availableDecisionIds,
      index: null,
      indexErrors: [],
      indexRelativePath: "decision-index.json",
      sourceErrors,
      sourceFiles: [source]
    });
    assert.equal(records[0]?.decisionId, "261020-original");
    assert.equal(records[0]?.source.kind, "candidate");
    assert.deepEqual(collectionErrors, []);
    assert.deepEqual(sourceErrors, []);
    const fresh: SourceFile = { decisionPath, sourcePath: "source.md" };
    assert.deepEqual(
      [...(await validateSourceMembership([fresh], [], []))],
      ["261020-next"]
    );
    assert.equal(fresh.decisionId, "261020-next");
  });
});

test("Decision membership retains failed identity parsing and scanning reports malformed YAML", async () => {
  await withTemporaryWorkspace("membership-invalid-identity", async (root) => {
    const decisionPath = path.join(root, "invalid.md");
    const text = "---\nid: [broken\nstatus: candidate\n---\n";
    await fs.writeFile(decisionPath, text);
    const source: SourceFile = { decisionPath, sourcePath: "invalid.md" };
    const collectionErrors: string[] = [];
    const sourceErrors: string[] = [];
    const availableDecisionIds = await validateSourceMembership(
      [source],
      collectionErrors,
      sourceErrors
    );
    assert.equal(availableDecisionIds.size, 0);
    assert.equal(source.decisionId, null);
    assert.equal(source.sourceText, text);
    const records = await scanSourceFiles({
      availableDecisionIds,
      index: null,
      indexErrors: [],
      indexRelativePath: "decision-index.json",
      sourceErrors,
      sourceFiles: [source]
    });
    assert.equal(records[0]?.decisionId, "invalid.md");
    assert.equal(records[0]?.source.kind, "invalid");
    assert.deepEqual(collectionErrors, []);
    assert.match(sourceErrors[0] ?? "", /invalid\.md frontmatter/u);
  });
});

test("Decision source discovery excludes candidates only after checking every declared identity", async () => {
  await withTemporaryWorkspace(
    "source-discovery-candidates",
    async (directory) => {
      const active = candidateDecisionBody({ id: "261020-formal" })
        .replace("status: candidate", "status: active")
        .replace("alignment: null", "alignment: aligned")
        .replace("createdAt: null", "createdAt: 2026-10-20T00:00:00Z");
      const candidate = candidateDecisionBody({ id: "261020-candidate" });
      await fs.writeFile(path.join(directory, "formal.md"), active);
      await fs.writeFile(path.join(directory, "candidate.md"), candidate);
      assert.deepEqual(
        Object.keys(
          (await readDecisionSourceRevision(directory, undefined)).entries
        ),
        ["261020-formal"]
      );
      assert.deepEqual(
        Object.keys(
          (await readDecisionStateSnapshot(directory, undefined)).states
        ),
        ["261020-formal"]
      );
      assert.deepEqual(
        Object.keys(
          (await readDecisionSourceRevision(directory, ["261020-candidate"]))
            .entries
        ),
        ["261020-candidate"]
      );
      await fs.writeFile(
        path.join(directory, "candidate.md"),
        candidateDecisionBody({ id: "261020-formal" })
      );
      await assert.rejects(
        readDecisionSourceRevision(directory, undefined),
        /Decision ID resolves to more than one source path: 261020-formal/u
      );
      await fs.writeFile(
        path.join(directory, "candidate.md"),
        "---\nid: [broken\nstatus: candidate\n---\n"
      );
      await assert.rejects(
        readDecisionSourceRevision(directory, undefined),
        /candidate\.md must declare a valid frontmatter Decision ID/u
      );
    }
  );
});

test("Decision source revision discovery independently observes changed bytes and candidate lifecycle", async () => {
  await withTemporaryWorkspace("source-revision-fresh", async (directory) => {
    const file = path.join(directory, "source.md");
    const candidate = candidateDecisionBody({ id: "261020-source" });
    const active = candidate
      .replace("status: candidate", "status: active")
      .replace("alignment: null", "alignment: aligned")
      .replace("createdAt: null", "createdAt: 2026-10-20T00:00:00Z");
    await fs.writeFile(file, active);
    const first = await readDecisionSourceRevision(directory, undefined);
    await fs.writeFile(file, active + "\n");
    const changed = await readDecisionSourceRevision(directory, undefined);
    assert.notEqual(
      changed.entries["261020-source"],
      first.entries["261020-source"]
    );
    await fs.writeFile(file, candidate);
    assert.deepEqual(
      (await readDecisionSourceRevision(directory, undefined)).entries,
      {}
    );
    await fs.writeFile(
      file,
      active.replace("261020-source", "261020-new-source")
    );
    assert.deepEqual(
      Object.keys(
        (await readDecisionSourceRevision(directory, undefined)).entries
      ),
      ["261020-new-source"]
    );
  });
});

test("Decision index sync retains an independent final source revision guard", async () => {
  await withTemporaryWorkspace("source-revision-guard", async (directory) => {
    const file = path.join(directory, "source.md");
    const active = candidateDecisionBody({ id: "261020-source" })
      .replace("status: candidate", "status: active")
      .replace("alignment: null", "alignment: aligned")
      .replace("createdAt: null", "createdAt: 2026-10-20T00:00:00Z");
    await fs.writeFile(file, active);
    const open = fs.open;
    let sourceReads = 0;
    Object.defineProperty(fs, "open", {
      configurable: true,
      value: async (...args: Parameters<typeof fs.open>) => {
        const handle = await open(...args);
        if (args[0] === file && ++sourceReads === 1) {
          const close = handle.close.bind(handle);
          handle.close = async () => {
            await close();
            await fs.writeFile(file, active + "\n");
          };
        }
        return handle;
      }
    });
    try {
      const result = await syncDecisionIndex({
        decisionsDirectory: directory,
        mode: "write"
      });
      assert.equal(result.status, "error");
      assert.ok(
        result.diagnostics.some(
          ({ code }) => code === "state-index.source-changed"
        )
      );
      assert.equal(result.changed, false);
      assert.equal(sourceReads, 2);
      await assert.rejects(
        fs.access(path.join(directory, "decision-index.json")),
        { code: "ENOENT" }
      );
    } finally {
      fs.open = open;
    }
  });
});

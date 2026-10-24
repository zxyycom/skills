import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { createDecisionCandidate } from "../../src/decision-candidate-service.ts";
import { readCandidateSelection } from "../../src/decision-candidate-context.ts";
import { utcDecisionDate } from "../../src/decision-path.ts";
import { renameDecisionRecord } from "../../src/decision-rename.ts";
import { a, b, fixture, parseIndex, sync } from "../support-local-contracts.ts";
import {
  candidateDecisionBody,
  decisionFilePath,
  runSourceCli,
  withTemporaryWorkspace,
  writeDecision
} from "../support.ts";
import type { DecisionId, DecisionTag } from "../../src/types.ts";

const indexPath = (root: string) =>
  path.join(root, "docs/decisions/decision-index.json");

test("Decision canonical creation allows legacy and cross-date names while preserving exact identity through publication", async () => {
  await withTemporaryWorkspace("canonical-identity", async (root) => {
    await fixture(root);
    for (const id of ["reusable-name", "250101-reusable-name"])
      await writeDecision(root, id, candidateDecisionBody({ id }));
    const legacy = await fs.readFile(decisionFilePath(root, "reusable-name"));
    const request = {
      workspaceRoot: root,
      decisionId: "reusable-name" as DecisionId,
      title: "可重复语义名称",
      purpose: "以完整日期身份区分候选。",
      background: "旧同名不要求迁移或覆盖。",
      decision: "完整日期 ID 决定新建路径。",
      relations: [],
      tags: ["decision-records" as DecisionTag]
    };
    const created = await createDecisionCandidate(request);
    assert.equal(created.status, "ok", JSON.stringify(created));
    if (created.status !== "ok" || !created.created)
      assert.fail("Expected candidate creation");
    const expectedId = utcDecisionDate() + "-reusable-name";
    assert.equal(created.decisionId, expectedId);
    assert.equal(created.sourcePath, expectedId + ".md");
    const createdPath = path.join(root, "docs/decisions", created.sourcePath);
    const before = await fs.readFile(createdPath);
    const duplicate = await createDecisionCandidate(request);
    assert.equal(duplicate.status, "error");
    assert.deepEqual(await fs.readFile(createdPath), before);
    await assert.rejects(
      readCandidateSelection({ workspaceRoot: root }, "reusable-name"),
      /ambiguous/
    );
    assert.equal(
      (await readCandidateSelection({ workspaceRoot: root }, expectedId))
        .records[0]?.decisionId,
      expectedId
    );
    await writeDecision(
      root,
      expectedId,
      candidateDecisionBody({ id: expectedId })
    );
    const published = await runSourceCli([
      "publish",
      expectedId,
      "--alignment",
      "aligned",
      "--root",
      root
    ]);
    assert.equal(published.exitCode, 0, published.stderr);
    assert.equal(
      parseIndex(await fs.readFile(indexPath(root), "utf8")).entries[
        created.decisionId
      ]?.sourcePath,
      created.sourcePath
    );
    assert.deepEqual(
      await fs.readFile(decisionFilePath(root, "reusable-name")),
      legacy
    );
  });
});
test("Decision exact canonical candidate selection reads neither unrelated candidates nor published dependency bodies", async () => {
  await withTemporaryWorkspace("canonical-selected", async (root) => {
    await fixture(root);
    const archive = decisionFilePath(root, "archive/" + a);
    await fs.mkdir(path.dirname(archive), { recursive: true });
    await fs.rename(decisionFilePath(root, a), archive);
    await fs.writeFile(
      archive,
      (await fs.readFile(archive, "utf8")).replace(
        "status: active",
        "status: archived"
      )
    );
    await sync(root);
    const id = "261024-canonical-selected";
    await writeDecision(
      root,
      id,
      candidateDecisionBody({ id, relations: [{ type: "修订", target: a }] })
    );
    const other = decisionFilePath(root, "261024-other-candidate");
    await fs.writeFile(other, "unreadable unrelated candidate text\n");
    const blocked = new Set([archive, decisionFilePath(root, b), other]);
    const originalOpen = fs.open;
    const forbidden: string[] = [];
    fs.open = (async (...args) => {
      if (typeof args[0] === "string" && blocked.has(args[0])) {
        forbidden.push(args[0]);
        throw new Error("Unrelated body must not be read");
      }
      return originalOpen(...args);
    }) as typeof fs.open;
    try {
      const selected = await readCandidateSelection(
        { workspaceRoot: root },
        id
      );
      assert.equal(selected.records[0]?.decisionId, id);
      const result = await runSourceCli([
        "publish",
        id,
        "--alignment",
        "aligned",
        "--keep-unrecorded-history",
        "--root",
        root
      ]);
      assert.equal(result.exitCode, 0, result.stderr);
      assert.deepEqual(forbidden, []);
    } finally {
      fs.open = originalOpen;
    }
    assert.match(
      await fs.readFile(decisionFilePath(root, id), "utf8"),
      /status: active/
    );
    assert.equal(
      await fs.readFile(other, "utf8"),
      "unreadable unrelated candidate text\n"
    );
  });
});
test("Decision legacy name ambiguity is recoverable by explicitly renaming the dated candidate", async () => {
  await withTemporaryWorkspace("legacy-selector-recovery", async (root) => {
    for (const id of ["shared-legacy-name", "250101-shared-legacy-name"])
      await writeDecision(root, id, candidateDecisionBody({ id }));
    const legacyPath = decisionFilePath(root, "shared-legacy-name");
    const before = await fs.readFile(legacyPath);
    await assert.rejects(
      readCandidateSelection({ workspaceRoot: root }, "shared-legacy-name"),
      /ambiguous/
    );
    const renamed = await renameDecisionRecord({
      workspaceRoot: root,
      source: "250101-shared-legacy-name",
      target: "distinct-dated-name"
    });
    assert.equal(renamed.status, "ok", JSON.stringify(renamed));
    const legacy = await readCandidateSelection(
      { workspaceRoot: root },
      "shared-legacy-name"
    );
    assert.equal(legacy.records[0]?.decisionId, "shared-legacy-name");
    assert.deepEqual(await fs.readFile(legacyPath), before);
  });
});

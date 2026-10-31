import { syncDecisionIndex } from "../../src/index/decision-state-index.ts";
import { buildDecisionIndexFromSnapshot } from "../../src/index/decision-state-index.ts";
import { listStateSnapshot } from "../queries/snapshot-fixture.ts";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { validateDecisionRecords } from "../../src/index.ts";
import {
  archivedDecisionId,
  archivedSourcePath,
  candidateDecisionBody,
  currentDecisionId,
  currentSourcePath,
  decisionFilePath,
  findIndexEntry,
  readIndex,
  withFixtureWorkspace,
  writeDecision
} from "../support/support.ts";

test("scanner accepts root active records and archive archived records with unique IDs", () =>
  withFixtureWorkspace("layout-valid", async (workspaceRoot) => {
    const validation = await validateDecisionRecords({ workspaceRoot });
    assert.deepEqual(validation.errors, []);
    assert.equal(validation.decisionCount, 2);
    assert.equal(validation.activeCount, 1);
    assert.equal(validation.archivedCount, 1);
    assert.deepEqual(
      validation.scan.records.map((record) => [
        record.decisionId,
        record.sourcePath
      ]),
      [
        [archivedDecisionId, archivedSourcePath],
        [currentDecisionId, currentSourcePath]
      ]
    );
  }));

test("scanner rejects status-position mismatches nested paths and duplicate decision IDs", () =>
  withFixtureWorkspace("layout-invalid", async (workspaceRoot) => {
    const archivedPath = decisionFilePath(workspaceRoot, archivedSourcePath);
    await fs.writeFile(
      archivedPath,
      (await fs.readFile(archivedPath, "utf8")).replace(
        "status: archived",
        "status: active"
      ),
      "utf8"
    );
    await writeDecision(
      workspaceRoot,
      `nested/${currentDecisionId}.md`,
      candidateDecisionBody({ id: currentDecisionId })
    );
    await writeDecision(
      workspaceRoot,
      `${archivedDecisionId}.md`,
      candidateDecisionBody({ id: archivedDecisionId })
    );
    const validation = await validateDecisionRecords({ workspaceRoot });
    assert.ok(
      validation.errors.some((error) =>
        error.includes("status must match its physical sourcePath")
      )
    );
    assert.ok(
      validation.errors.some((error) =>
        error.includes("root contains unsupported directory nested")
      )
    );
    assert.ok(
      validation.errors.some((error) =>
        error.includes("Decision ID occurs in more than one source path")
      )
    );
  }));

test("decision index is state-only and ID-keyed with empty metadata", async () => {
  const built = await buildDecisionIndexFromSnapshot(await listStateSnapshot());
  assert.equal(built.status, "ok");
  if (built.status !== "ok")
    throw new Error("Expected in-memory index projection");
  const index = built.value;
  assert.equal(index.schemaVersion, 4);
  assert.equal(index.namespace, "decisions");
  assert.equal(index.definitionVersion, 11);
  assert.deepEqual(index.metadata, {});
  assert.deepEqual(Object.keys(index.entries), [
    archivedDecisionId,
    currentDecisionId
  ]);
  assert.equal(
    findIndexEntry(index, currentDecisionId).sourcePath,
    currentSourcePath
  );
  assert.deepEqual(findIndexEntry(index, currentDecisionId).tags, [
    "project-tooling"
  ]);
  assert.deepEqual(Object.keys(index.sourceRevision.entries), [
    archivedDecisionId,
    currentDecisionId
  ]);
});

test("index revision detects tag and sourcePath changes before accepting a rebuilt snapshot", () =>
  withFixtureWorkspace("index-revision", async (workspaceRoot) => {
    const currentPath = decisionFilePath(workspaceRoot, currentSourcePath);
    await fs.writeFile(
      currentPath,
      (await fs.readFile(currentPath, "utf8")).replace(
        "  - project-tooling",
        "  - decision-records\n  - project-tooling"
      ),
      "utf8"
    );
    const stale = await validateDecisionRecords({ workspaceRoot });
    assert.notEqual(stale.errors.length, 0);

    const synced = await syncDecisionIndex({
      decisionsDirectory: path.join(workspaceRoot, "docs/decisions"),
      mode: "write"
    });
    assert.equal(synced.status, "ok", JSON.stringify(synced));
    const rebuilt = await readIndex(workspaceRoot);
    assert.deepEqual(findIndexEntry(rebuilt, currentDecisionId).tags, [
      "decision-records",
      "project-tooling"
    ]);
    const semanticPath = decisionFilePath(workspaceRoot, "semantic-current.md");
    await fs.rename(currentPath, semanticPath);
    assert.ok(
      (await validateDecisionRecords({ workspaceRoot })).errors.some((e) =>
        /out of sync/.test(e)
      )
    );
    const resynced = await syncDecisionIndex({
      decisionsDirectory: path.join(workspaceRoot, "docs/decisions"),
      mode: "write"
    });
    assert.equal(resynced.status, "ok", JSON.stringify(resynced));
    assert.equal(
      findIndexEntry(await readIndex(workspaceRoot), currentDecisionId)
        .sourcePath,
      "semantic-current.md"
    );
  }));

test("decision index parser and check reject obsolete definition version", () =>
  withFixtureWorkspace("index-obsolete-definition", async (workspaceRoot) => {
    const establishedIndex = await readIndex(workspaceRoot);
    const index = { ...establishedIndex, definitionVersion: 5 };
    const indexPath = path.join(
      workspaceRoot,
      "docs",
      "decisions",
      "decision-index.json"
    );
    const { parseDecisionIndex } =
      await import("../../src/index/decision-state-index.ts");
    const parsed = parseDecisionIndex(
      JSON.stringify(index),
      "decision-index.json"
    );
    assert.equal(parsed.status, "error");
    await fs.writeFile(
      indexPath,
      JSON.stringify(index, null, 2) + "\n",
      "utf8"
    );
    const checked = await validateDecisionRecords({ workspaceRoot });
    assert.ok(
      checked.errors.some((error) =>
        /definitionVersion|definition version/i.test(error)
      )
    );
  }));

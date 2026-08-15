import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { validateDecisionRecords } from "../src/index.ts";
import {
  archivedDecisionId,
  archivedSourcePath,
  candidateDecisionBody,
  currentDecisionId,
  currentSourcePath,
  decisionFilePath,
  findIndexEntry,
  readIndex,
  runSourceCli,
  withFixtureWorkspace,
  writeDecision,
} from "./support.ts";

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
        record.sourcePath,
      ]),
      [
        [archivedDecisionId, archivedSourcePath],
        [currentDecisionId, currentSourcePath],
      ],
    );
  }));

test("scanner rejects status-position mismatches nested paths and duplicate decision IDs", () =>
  withFixtureWorkspace("layout-invalid", async (workspaceRoot) => {
    const archivedPath = decisionFilePath(workspaceRoot, archivedSourcePath);
    await fs.writeFile(
      archivedPath,
      (await fs.readFile(archivedPath, "utf8")).replace(
        "status: archived",
        "status: active",
      ),
      "utf8",
    );
    await writeDecision(
      workspaceRoot,
      `nested/${currentDecisionId}`,
      candidateDecisionBody(),
    );
    await writeDecision(
      workspaceRoot,
      archivedDecisionId,
      candidateDecisionBody(),
    );
    const validation = await validateDecisionRecords({ workspaceRoot });
    assert.ok(
      validation.errors.some((error) =>
        error.includes("status must match its physical sourcePath"),
      ),
    );
    assert.ok(
      validation.errors.some((error) =>
        error.includes("root contains unsupported directory nested"),
      ),
    );
    assert.ok(
      validation.errors.some((error) =>
        error.includes("Decision ID occurs in more than one source path"),
      ),
    );
  }));

test("decision index is ID-keyed with empty metadata and deterministic tag keys", () =>
  withFixtureWorkspace("index-shape", async (workspaceRoot) => {
    const index = await readIndex(workspaceRoot);
    assert.equal(index.schemaVersion, 3);
    assert.equal(index.namespace, "decisions");
    assert.equal(index.definitionVersion, 6);
    assert.deepEqual(index.metadata, {});
    assert.deepEqual(index.keyDefinitions, [
      { name: "tag", mode: "exact" },
      { name: "status", mode: "exact" },
      { name: "alignment", mode: "exact" },
    ]);
    assert.deepEqual(Object.keys(index.entries), [
      archivedDecisionId,
      currentDecisionId,
    ]);
    assert.equal(
      findIndexEntry(index, currentDecisionId).sourcePath,
      currentSourcePath,
    );
    assert.deepEqual(findIndexEntry(index, currentDecisionId).tags, [
      "project-tooling",
    ]);
    assert.deepEqual(Object.keys(index.sourceRevision.entries), [
      archivedDecisionId,
      currentDecisionId,
    ]);
  }));

test("index revision detects tag and sourcePath changes before accepting a rebuilt snapshot", () =>
  withFixtureWorkspace("index-revision", async (workspaceRoot) => {
    const currentPath = decisionFilePath(workspaceRoot, currentSourcePath);
    await fs.writeFile(
      currentPath,
      (await fs.readFile(currentPath, "utf8")).replace(
        "  - project-tooling",
        "  - decision-records\n  - project-tooling",
      ),
      "utf8",
    );
    const stale = await validateDecisionRecords({ workspaceRoot });
    assert.notEqual(stale.errors.length, 0);

    const synced = await runSourceCli([
      "sync-index",
      "--write",
      "--root",
      workspaceRoot,
    ]);
    assert.equal(synced.exitCode, 0, synced.stderr);
    const rebuilt = await readIndex(workspaceRoot);
    assert.deepEqual(findIndexEntry(rebuilt, currentDecisionId).tags, [
      "decision-records",
      "project-tooling",
    ]);
  }));

test("decision index parser and check reject obsolete definition version", () =>
  withFixtureWorkspace("index-obsolete-definition", async (workspaceRoot) => {
    const establishedIndex = await readIndex(workspaceRoot);
    const index = { ...establishedIndex, definitionVersion: 5 };
    const indexPath = path.join(
      workspaceRoot,
      "docs",
      "decisions",
      "decision-index.json",
    );
    const { parseDecisionIndex } =
      await import("../src/decision-state-index.ts");
    const parsed = parseDecisionIndex(
      JSON.stringify(index),
      "decision-index.json",
    );
    assert.equal(parsed.status, "error");
    await fs.writeFile(
      indexPath,
      JSON.stringify(index, null, 2) + "\n",
      "utf8",
    );
    const checked = await runSourceCli(["check", "--root", workspaceRoot]);
    assert.notEqual(checked.exitCode, 0);
    assert.match(checked.stderr, /definitionVersion|definition version/i);
  }));

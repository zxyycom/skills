/* oxlint-disable no-unused-vars -- Split test modules retain shared fixture imports for their focused scenario files. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  openVersionControl,
  VersionControlError,
  type ReplacePendingFilesOptions,
  type VersionControlFile
} from "../../shared/src/version-control/index.ts";
import {
  buildStateIndex,
  createStateIndexRuntime,
  defineStateIndexDefinition,
  parseStateIndex,
  serializeStateIndex,
  stageSelectedIndexEntries,
  type ReadonlyStateIndex,
  type StateIndexDefinition,
  type StateSnapshot
} from "../src/index.ts";
import { stageSelectedIndexEntriesWithRepository } from "../src/staging.ts";
import { resultValue } from "./support.ts";

import {
  buildText,
  createControl,
  createDefinition,
  createGitRepositoryFixture,
  createStagingFixture,
  entryLabels,
  indexPath,
  isSelectedMixedTarget,
  pendingChangedPaths,
  pendingConflictDiagnostic,
  pendingIndexText,
  readPendingIndex,
  readPendingText,
  readStagedIndex,
  resetControl,
  runGit,
  snapshot,
  stageFixture,
  testOptions,
  withTempRoot,
  writeFile,
  type TestSource
} from "./staging-fixture.ts";

test(
  "uses workspace collection data for a missing baseline and permits an empty target",
  testOptions,
  async () => {
    await withTempRoot(async (tempRoot) => {
      const control = createControl();
      const source: TestSource = { snapshot: snapshot({}, "empty") };
      const definition = createDefinition(source, control);
      const first = await createStagingFixture({
        definition,
        name: "first-index",
        revision: null,
        source,
        tempRoot,
        workspace: snapshot(
          { A: "A1", B: "B1" },
          "workspace",
          "first",
          "metadata:first"
        )
      });
      resetControl(control);
      const firstResult = await stageFixture(first, definition, ["B"]);
      assert.equal(firstResult.status, "ok");
      const firstPending = await readStagedIndex(first, definition);
      assert.deepEqual(entryLabels(firstPending), { B: "B1" });
      assert.deepEqual(firstPending.metadata, { catalog: "first" });
      assert.equal(firstPending.sourceRevision.metadata, "metadata:first");

      const empty = await createStagingFixture({
        definition,
        name: "empty-target",
        revision: snapshot({ A: "A0" }, "revision"),
        source,
        tempRoot,
        workspace: snapshot({}, "workspace")
      });
      resetControl(control);
      const emptyResult = await stageFixture(empty, definition, ["A"]);
      assert.equal(emptyResult.status, "ok");
      const emptyPending = await readStagedIndex(empty, definition);
      assert.deepEqual(emptyPending.entries, {});
      assert.deepEqual(emptyPending.sourceRevision.entries, {});
    });
  }
);

test(
  "rejects invalid staging inputs without changing pending content",
  testOptions,
  async () => {
    await withTempRoot(async (tempRoot) => {
      const control = createControl();
      const source: TestSource = { snapshot: snapshot({}, "empty") };
      const definition = createDefinition(source, control);
      const fixture = await createStagingFixture({
        definition,
        name: "invalid-selection",
        revision: snapshot({ A: "A0" }, "revision"),
        source,
        tempRoot,
        workspace: snapshot({ A: "A1" }, "workspace")
      });
      resetControl(control);
      const selections: unknown[] = [
        [],
        ["A", "A"],
        [" invalid "],
        ["missing"],
        [null]
      ];
      for (const selectedIds of selections) {
        const result = await stageFixture(
          fixture,
          definition,
          selectedIds as readonly string[]
        );
        assert.equal(result.status, "error");
        assert.equal(result.state, "selection-invalid");
      }
      const invalidPath = await stageFixture(
        fixture,
        definition,
        ["A"],
        "../states.json"
      );
      assert.equal(invalidPath.state, "index-path-invalid");
      assert.equal(
        invalidPath.diagnostics[0]?.code,
        "state-index.index-path-invalid"
      );
      assert.equal(fixture.replacements.length, 0);
    });
  }
);

test(
  "reports an actionable repository discovery failure before staging",
  testOptions,
  async () => {
    await withTempRoot(async (tempRoot) => {
      const workspaceRoot = path.join(tempRoot, "plain-workspace");
      const control = createControl();
      const source: TestSource = { snapshot: snapshot({}, "empty") };
      const definition = createDefinition(source, control);
      await writeFile(
        workspaceRoot,
        indexPath,
        await buildText(source, definition, snapshot({ A: "A1" }, "workspace"))
      );
      resetControl(control);

      const result = await stageSelectedIndexEntries({
        context: { root: workspaceRoot },
        definition,
        indexPath,
        selectedIds: ["A"]
      });
      assert.equal(result.state, "revision-read-failed");
      assert.equal(
        result.diagnostics[0]?.code,
        "state-index.repository-unavailable"
      );
      assert.match(
        result.diagnostics[0]?.message ?? "",
        /repository-backed root.*retry/u
      );
      assert.deepEqual(result.diagnostics[0]?.versionControl, {
        causeCategory: "not-repository",
        detail: null,
        operation: "discover a version-control worktree",
        target: "configured root"
      });
      assert.equal(result.pending, undefined);
    });
  }
);

test(
  "reports an unavailable version-control tool before staging without a pending outcome",
  testOptions,
  async () => {
    await withTempRoot(async (tempRoot) => {
      const control = createControl();
      const source: TestSource = { snapshot: snapshot({}, "empty") };
      const definition = createDefinition(source, control);
      const fixture = await createStagingFixture({
        definition,
        name: "tool-unavailable",
        revision: snapshot({ A: "A0" }, "revision"),
        source,
        tempRoot,
        workspace: snapshot({ A: "A1" }, "workspace")
      });

      const result = await stageSelectedIndexEntriesWithRepository(
        {
          context: { root: fixture.repositoryRoot },
          definition,
          indexPath,
          selectedIds: ["A"]
        },
        async () => {
          throw new VersionControlError({
            causeCategory: "tool-unavailable",
            code: "operation-failed",
            detail: "the configured executable was not found",
            operation: "discover a version-control worktree",
            target: "configured root"
          });
        }
      );
      assert.equal(result.state, "revision-read-failed");
      assert.equal(
        result.diagnostics[0]?.code,
        "state-index.repository-tool-unavailable"
      );
      assert.deepEqual(result.diagnostics[0]?.versionControl, {
        causeCategory: "tool-unavailable",
        detail: "the configured executable was not found",
        operation: "discover a version-control worktree",
        target: "configured root"
      });
      assert.equal(result.pending, undefined);
      assert.equal(fixture.replacements.length, 0);
    });
  }
);

test(
  "reports an actionable pending replacement failure without changing workspace",
  testOptions,
  async () => {
    await withTempRoot(async (tempRoot) => {
      const control = createControl();
      const source: TestSource = { snapshot: snapshot({}, "empty") };
      const definition = createDefinition(source, control);
      const fixture = await createStagingFixture({
        definition,
        name: "pending-write-failure",
        revision: snapshot({ A: "A0" }, "revision"),
        source,
        tempRoot,
        workspace: snapshot({ A: "A1" }, "workspace")
      });
      fixture.onReplace = () => {
        throw new VersionControlError({
          causeCategory: "access-denied",
          code: "pending-replacement-failed",
          detail: "permission denied",
          operation: "replace a pending range",
          target: indexPath
        });
      };
      resetControl(control);

      const result = await stageFixture(fixture, definition, ["A"]);
      assert.equal(result.state, "pending-write-failed");
      assert.equal(
        result.diagnostics[0]?.code,
        "state-index.pending-access-denied"
      );
      assert.match(
        result.diagnostics[0]?.message ?? "",
        /grant this process the required repository write access, then retry/u
      );
      assert.deepEqual(result.pending, {
        outcome: "no-change",
        scope: indexPath
      });
      assert.equal(fixture.replacements.length, 0);
      assert.equal(
        await fs.readFile(path.join(fixture.repositoryRoot, indexPath), "utf8"),
        fixture.workspaceText
      );
    });
  }
);

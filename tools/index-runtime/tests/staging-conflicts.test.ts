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
  "maps a competing pending replacement conflict without overwriting a winner",
  testOptions,
  async () => {
    await withTempRoot(async (tempRoot) => {
      const control = createControl();
      const source: TestSource = { snapshot: snapshot({}, "empty") };
      const definition = createDefinition(source, control);
      const fixture = await createStagingFixture({
        definition,
        name: "concurrent",
        revision: snapshot({ A: "A0", B: "B0" }, "revision"),
        source,
        tempRoot,
        workspace: snapshot({ A: "A1", B: "B1" }, "workspace")
      });
      resetControl(control);
      let replacementCount = 0;
      fixture.onReplace = () => {
        if (replacementCount > 0) {
          throw new VersionControlError({
            causeCategory: "busy",
            code: "pending-conflict",
            detail: "already replaced",
            operation: "replace pending files",
            target: indexPath
          });
        }
        replacementCount += 1;
      };

      const results = await Promise.all([
        stageFixture(fixture, definition, ["A"]),
        stageFixture(fixture, definition, ["B"])
      ]);
      assert.equal(
        results.filter((result) => result.status === "ok").length,
        1
      );
      assert.equal(
        results.filter((result) => result.state === "pending-conflict").length,
        1
      );
      const pending = entryLabels(await readStagedIndex(fixture, definition));
      assert.ok(
        JSON.stringify(pending) === JSON.stringify({ A: "A1", B: "B0" }) ||
          JSON.stringify(pending) === JSON.stringify({ A: "A0", B: "B1" })
      );
    });
  }
);

test(
  "rejects a revision that changes before the locked pending replacement",
  testOptions,
  async () => {
    await withTempRoot(async (tempRoot) => {
      const control = createControl();
      const source: TestSource = { snapshot: snapshot({}, "empty") };
      const definition = createDefinition(source, control);
      const fixture = await createGitRepositoryFixture({
        definition,
        name: "revision-change",
        revision: snapshot({ A: "A0", B: "B0" }, "revision"),
        source,
        tempRoot,
        workspace: snapshot({ A: "A1", B: "B1" }, "workspace")
      });
      resetControl(control);
      control.onValidation = (index) => {
        if (isSelectedMixedTarget(index)) {
          runGit(fixture.repositoryRoot, [
            "commit",
            "--quiet",
            "--allow-empty",
            "--message",
            "concurrent revision"
          ]);
        }
      };

      const result = await stageSelectedIndexEntries({
        context: { root: fixture.repositoryRoot },
        definition,
        indexPath,
        selectedIds: ["A"]
      });
      assert.equal(result.state, "pending-conflict");
      assert.deepEqual(result.pending, {
        outcome: "no-change",
        scope: indexPath
      });
      assert.deepEqual(result.diagnostics, [
        pendingConflictDiagnostic(
          "the current revision differs from the expected revision"
        )
      ]);
      assert.deepEqual(await pendingChangedPaths(fixture.repositoryRoot), []);
      assert.equal(
        await fs.readFile(path.join(fixture.repositoryRoot, indexPath), "utf8"),
        fixture.workspaceText
      );
    });
  }
);

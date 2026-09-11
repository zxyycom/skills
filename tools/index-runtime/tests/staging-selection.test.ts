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
  "stages selected additions modifications deletions and renames while preserving workspace and outside pending files",
  testOptions,
  async () => {
    await withTempRoot(async (tempRoot) => {
      const control = createControl();
      const source: TestSource = { snapshot: snapshot({}, "empty") };
      const definition = createDefinition(source, control);
      const fixture = await createGitRepositoryFixture({
        definition,
        name: "selected",
        revision: snapshot(
          Object.fromEntries([
            ["A", "A0"],
            ["B", "B0"],
            ["C", "C0"],
            ["__proto__", "old"]
          ]),
          "revision"
        ),
        source,
        stageOutside: true,
        tempRoot,
        workspace: snapshot(
          Object.fromEntries([
            ["A", "A1"],
            ["C", "C0"],
            ["constructor", "new"]
          ]),
          "workspace"
        )
      });
      resetControl(control);
      const runtime = createStateIndexRuntime({
        definition,
        indexPath,
        root: fixture.repositoryRoot
      });

      const staged = await runtime.stageSelectedEntries([
        "constructor",
        "B",
        "A",
        "__proto__"
      ]);
      assert.deepEqual(staged, {
        changed: true,
        diagnostics: [],
        indexPath,
        namespace: "staging-test",
        selectedIds: ["A", "B", "__proto__", "constructor"],
        state: "staged",
        status: "ok"
      });
      const firstPending = await readPendingIndex(
        fixture.repositoryRoot,
        definition
      );
      assert.deepEqual(entryLabels(firstPending), {
        A: "A1",
        C: "C0",
        constructor: "new"
      });
      assert.deepEqual(firstPending.sourceRevision.entries, {
        A: "workspace:A",
        C: "revision:C",
        constructor: "workspace:constructor"
      });
      assert.equal(
        await fs.readFile(path.join(fixture.repositoryRoot, indexPath), "utf8"),
        fixture.workspaceText
      );
      assert.equal(
        await fs.readFile(
          path.join(fixture.repositoryRoot, "domain/source.md"),
          "utf8"
        ),
        "workspace domain\n"
      );
      assert.deepEqual(
        await readPendingText(fixture.repositoryRoot, "outside/keep.md"),
        [{ data: "pending outside\n", path: "outside/keep.md" }]
      );

      runGit(fixture.repositoryRoot, [
        "reset",
        "--quiet",
        "HEAD",
        "--",
        indexPath
      ]);
      const reordered = await runtime.stageSelectedEntries([
        "__proto__",
        "A",
        "constructor",
        "B"
      ]);
      assert.equal(reordered.status, "ok");
      assert.equal(
        await pendingIndexText(fixture.repositoryRoot),
        serializeStateIndex(firstPending, definition)
      );
      assert.equal(control.reads, 0);
      assert.equal(control.revisionReads, 0);
    });
  }
);

test(
  "applies one id-existence rule to additions deletions no-ops and explicit renames",
  testOptions,
  async () => {
    await withTempRoot(async (tempRoot) => {
      const scenarios = [
        {
          expected: { A: "A0", N: "N1" },
          name: "addition",
          revision: snapshot({ A: "A0" }, "revision"),
          selectedIds: ["N"],
          workspace: snapshot({ A: "A0", N: "N1" }, "workspace")
        },
        {
          expected: { A: "A0" },
          name: "deletion",
          revision: snapshot({ A: "A0", B: "B0" }, "revision"),
          selectedIds: ["B"],
          workspace: snapshot({ A: "A0" }, "workspace")
        },
        {
          expected: { A: "A0" },
          name: "no-op",
          revision: snapshot({ A: "A0" }, "same"),
          selectedIds: ["A"],
          workspace: snapshot({ A: "A0" }, "same")
        },
        {
          expected: { A: "A0", constructor: "new" },
          name: "rename",
          revision: snapshot(
            Object.fromEntries([
              ["A", "A0"],
              ["__proto__", "old"]
            ]),
            "revision"
          ),
          selectedIds: ["constructor", "__proto__"],
          workspace: snapshot(
            Object.fromEntries([
              ["A", "A0"],
              ["constructor", "new"]
            ]),
            "workspace"
          )
        }
      ] as const;

      for (const scenario of scenarios) {
        const control = createControl();
        const source: TestSource = { snapshot: snapshot({}, "empty") };
        const definition = createDefinition(source, control);
        const fixture = await createStagingFixture({
          definition,
          name: scenario.name,
          revision: scenario.revision,
          source,
          tempRoot,
          workspace: scenario.workspace
        });
        resetControl(control);
        const result = await stageFixture(
          fixture,
          definition,
          scenario.selectedIds
        );
        assert.equal(result.status, "ok", scenario.name);
        assert.deepEqual(
          entryLabels(await readStagedIndex(fixture, definition)),
          scenario.expected,
          scenario.name
        );
        if (scenario.name === "no-op") {
          assert.deepEqual(result, {
            changed: false,
            diagnostics: [],
            indexPath,
            namespace: "staging-test",
            selectedIds: ["A"],
            state: "unchanged",
            status: "ok"
          });
        }
      }
    });
  }
);

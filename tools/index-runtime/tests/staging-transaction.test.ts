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
  "reports incomplete pending recovery with an explicit partial outcome",
  testOptions,
  async () => {
    await withTempRoot(async (tempRoot) => {
      const control = createControl();
      const source: TestSource = { snapshot: snapshot({}, "empty") };
      const definition = createDefinition(source, control);
      const fixture = await createStagingFixture({
        definition,
        name: "pending-recovery-failure",
        revision: snapshot({ A: "A0" }, "revision"),
        source,
        tempRoot,
        workspace: snapshot({ A: "A1" }, "workspace")
      });
      fixture.onReplace = () => {
        throw new VersionControlError({
          causeCategory: "access-denied",
          code: "pending-recovery-failed",
          detail: "permission denied while removing the recovery file",
          operation: "recover a pending range",
          target: indexPath
        });
      };

      const result = await stageFixture(fixture, definition, ["A"]);
      assert.equal(result.state, "pending-recovery-failed");
      assert.equal(result.changed, null);
      assert.deepEqual(result.pending, {
        outcome: "partial-or-unknown",
        scope: indexPath
      });
      assert.equal(
        result.diagnostics[0]?.code,
        "state-index.pending-recovery-failed"
      );
      assert.deepEqual(result.diagnostics[0]?.versionControl, {
        causeCategory: "access-denied",
        detail: "permission denied while removing the recovery file",
        operation: "recover a pending range",
        target: indexPath
      });
      assert.equal(fixture.replacements.length, 0);
    });
  }
);

test(
  "rejects invalid revision and workspace indexes before pending replacement",
  testOptions,
  async () => {
    await withTempRoot(async (tempRoot) => {
      const control = createControl();
      const source: TestSource = { snapshot: snapshot({}, "empty") };
      const definition = createDefinition(source, control);
      const invalidRevision = await createStagingFixture({
        definition,
        name: "invalid-revision",
        revision: snapshot({ A: "A0" }, "revision"),
        source,
        tempRoot,
        workspace: snapshot({ A: "A1" }, "workspace")
      });
      invalidRevision.revisionFile = {
        data: Buffer.from([0xff, 0xfe, 0xfd]),
        path: indexPath
      };
      resetControl(control);
      const revisionResult = await stageFixture(invalidRevision, definition, [
        "A"
      ]);
      assert.equal(revisionResult.state, "revision-index-invalid");
      assert.equal(
        revisionResult.diagnostics[0]?.code,
        "state-index.revision-index-encoding-invalid"
      );

      const invalidWorkspace = await createStagingFixture({
        definition,
        name: "invalid-workspace",
        revision: snapshot({ A: "A0" }, "revision"),
        source,
        tempRoot,
        workspace: snapshot({ A: "A1" }, "workspace")
      });
      const incompatible = JSON.parse(invalidWorkspace.workspaceText) as {
        namespace: string;
      };
      incompatible.namespace = "another-namespace";
      await writeFile(
        invalidWorkspace.repositoryRoot,
        indexPath,
        `${JSON.stringify(incompatible, null, 2)}\n`
      );
      resetControl(control);
      const workspaceResult = await stageFixture(invalidWorkspace, definition, [
        "A"
      ]);
      assert.equal(workspaceResult.state, "workspace-index-invalid");
      assert.ok(
        workspaceResult.diagnostics.some(
          (entry) => entry.code === "state-index.namespace-mismatch"
        )
      );
      assert.equal(invalidWorkspace.replacements.length, 0);

      const invalidWorkspaceEncoding = await createStagingFixture({
        definition,
        name: "invalid-workspace-encoding",
        revision: snapshot({ A: "A0" }, "revision"),
        source,
        tempRoot,
        workspace: snapshot({ A: "A1" }, "workspace")
      });
      await fs.writeFile(
        path.join(invalidWorkspaceEncoding.repositoryRoot, indexPath),
        Buffer.from([0xff, 0xfe, 0xfd])
      );
      resetControl(control);
      const workspaceEncodingResult = await stageFixture(
        invalidWorkspaceEncoding,
        definition,
        ["A"]
      );
      assert.equal(workspaceEncodingResult.state, "workspace-index-invalid");
      assert.equal(
        workspaceEncodingResult.diagnostics[0]?.code,
        "state-index.index-encoding-invalid"
      );
      assert.equal(invalidWorkspaceEncoding.replacements.length, 0);
    });
  }
);

test(
  "rejects collection changes without source reads",
  testOptions,
  async () => {
    await withTempRoot(async (tempRoot) => {
      const collectionKinds = [
        {
          name: "metadata-state",
          workspace: snapshot(
            { A: "A1" },
            "workspace",
            "changed",
            "metadata:main"
          )
        },
        {
          name: "metadata-revision",
          workspace: snapshot(
            { A: "A1" },
            "workspace",
            "main",
            "metadata:changed"
          )
        }
      ];
      for (const collection of collectionKinds) {
        const control = createControl();
        const source: TestSource = { snapshot: snapshot({}, "empty") };
        const definition = createDefinition(source, control);
        const fixture = await createStagingFixture({
          definition,
          name: collection.name,
          revision: snapshot({ A: "A0" }, "revision"),
          source,
          tempRoot,
          workspace: collection.workspace
        });
        resetControl(control);
        const result = await stageFixture(fixture, definition, ["A"]);
        assert.equal(result.state, "collection-changed");
        assert.equal(control.reads, 0);
        assert.equal(control.revisionReads, 0);
        assert.equal(fixture.replacements.length, 0);
      }
    });
  }
);

test(
  "rejects an invalid selected target after complete reprojection without source reads",
  testOptions,
  async () => {
    await withTempRoot(async (tempRoot) => {
      const control = createControl();
      const source: TestSource = { snapshot: snapshot({}, "empty") };
      const definition = createDefinition(source, control);
      const projection = await createStagingFixture({
        definition,
        name: "invalid-projection",
        revision: snapshot({ A: "A0", B: "B0" }, "revision"),
        source,
        tempRoot,
        workspace: snapshot({ A: "A1", B: "B1" }, "workspace")
      });
      resetControl(control);
      let observedSelectedTarget = false;
      control.onValidation = (index) => {
        if (isSelectedMixedTarget(index)) {
          observedSelectedTarget = true;
          throw new TypeError(
            "selected entries violate the complete-index rule"
          );
        }
      };
      const rejected = await stageFixture(projection, definition, ["A"]);
      assert.equal(rejected.state, "target-invalid");
      assert.ok(
        rejected.diagnostics.some(
          (entry) => entry.code === "state-index.index-validation-failed"
        )
      );
      assert.equal(observedSelectedTarget, true);
      assert.equal(control.reads, 0);
      assert.equal(control.revisionReads, 0);
      assert.equal(projection.replacements.length, 0);
    });
  }
);

test(
  "rejects dirty same-index pending content even when selected entries are unchanged",
  testOptions,
  async () => {
    await withTempRoot(async (tempRoot) => {
      const control = createControl();
      const source: TestSource = { snapshot: snapshot({}, "empty") };
      const definition = createDefinition(source, control);
      const fixture = await createGitRepositoryFixture({
        definition,
        name: "dirty-pending",
        revision: snapshot({ A: "A0" }, "same"),
        source,
        stageOutside: true,
        tempRoot,
        workspace: snapshot({ A: "A0" }, "same")
      });
      const dirty = fixture.revisionText!.replace("A0", "pending-only");
      await writeFile(fixture.repositoryRoot, indexPath, dirty);
      runGit(fixture.repositoryRoot, ["add", indexPath]);
      await writeFile(fixture.repositoryRoot, indexPath, fixture.workspaceText);
      resetControl(control);

      const result = await stageSelectedIndexEntries({
        context: { root: fixture.repositoryRoot },
        definition,
        indexPath,
        selectedIds: ["A"]
      });
      assert.equal(result.state, "pending-conflict");
      assert.equal(result.changed, false);
      assert.deepEqual(result.pending, {
        outcome: "no-change",
        scope: indexPath
      });
      assert.deepEqual(result.diagnostics, [
        pendingConflictDiagnostic(
          "the pending range bytes differ from the expected file set"
        )
      ]);
      assert.equal(await pendingIndexText(fixture.repositoryRoot), dirty);
      assert.deepEqual(
        await readPendingText(fixture.repositoryRoot, "outside/keep.md"),
        [{ data: "pending outside\n", path: "outside/keep.md" }]
      );
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
    });
  }
);

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

const indexPath = "indexes/states.json";
const testOptions = { timeout: 15_000 };
type TestMetadata = {
  catalog: string;
};

type TestState = {
  id: string;
  label: string;
};

type TestControl = {
  onValidation:
    | ((index: ReadonlyStateIndex<TestState, TestMetadata>) => void)
    | null;
  reads: number;
  revisionReads: number;
};

type TestSource = {
  snapshot: StateSnapshot<TestState, TestMetadata>;
};

type RepositoryFixture = {
  repositoryRoot: string;
  revisionText: string | null;
  workspaceText: string;
};

type StagingFixture = RepositoryFixture & {
  onReplace:
    | ((options: ReplacePendingFilesOptions) => void | Promise<void>)
    | null;
  replacements: ReplacePendingFilesOptions[];
  repository: {
    getCurrentRevision: () => Promise<string | null>;
    readRevisionFile: (
      revision: string,
      filePath: string
    ) => Promise<VersionControlFile | null>;
    replacePendingFiles: (options: ReplacePendingFilesOptions) => Promise<{
      pathScope: string;
      pendingPaths: string[];
      previousPaths: string[];
    }>;
    rootDirectory: string;
  };
  revisionFile: VersionControlFile | null;
};

async function withTempRoot(
  run: (tempRoot: string) => Promise<void>
): Promise<void> {
  const tempRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "index-staging-test-")
  );
  try {
    await run(tempRoot);
  } finally {
    await fs.rm(tempRoot, { force: true, recursive: true });
  }
}

function createControl(): TestControl {
  return {
    onValidation: null,
    reads: 0,
    revisionReads: 0
  };
}

function resetControl(control: TestControl): void {
  control.reads = 0;
  control.revisionReads = 0;
}

function createDefinition(
  source: TestSource,
  control: TestControl
): StateIndexDefinition<TestState, TestMetadata> {
  return defineStateIndexDefinition<TestState, TestMetadata>({
    definitionVersion: 1,
    keyStrategies: [
      {
        derive: (state) => state.label,
        mode: "exact",
        name: "label"
      }
    ],
    namespace: "staging-test",
    parseMetadata: (input) => {
      if (typeof input.catalog !== "string") {
        throw new TypeError("catalog must be text");
      }
      return { catalog: input.catalog };
    },
    parseState: (input, context) => {
      if (
        typeof input.id !== "string" ||
        typeof input.label !== "string" ||
        input.id !== context.id
      ) {
        throw new TypeError(
          "state id and label must match the record identity"
        );
      }
      return { id: input.id, label: input.label };
    },
    read: async () => {
      control.reads += 1;
      return source.snapshot;
    },
    readRevision: async () => {
      control.revisionReads += 1;
      return source.snapshot.sourceRevision;
    },
    validateIndex: (index) => {
      control.onValidation?.(index);
    }
  });
}

function snapshot(
  labels: Readonly<Record<string, string>>,
  revisionPrefix: string,
  catalog = "main",
  metadataRevision = "metadata:main"
): StateSnapshot<TestState, TestMetadata> {
  const ids = Object.keys(labels);
  return {
    metadata: { catalog },
    sourceRevision: {
      entries: Object.fromEntries(
        ids.map((id) => [id, `${revisionPrefix}:${id}`])
      ),
      metadata: metadataRevision
    },
    states: Object.fromEntries(
      ids.map((id) => [id, { id, label: labels[id]! }])
    )
  };
}

function isSelectedMixedTarget(
  index: ReadonlyStateIndex<TestState, TestMetadata>
): boolean {
  return (
    index.entries.A?.state.label === "A1" &&
    index.entries.B?.state.label === "B0"
  );
}

async function buildText(
  source: TestSource,
  definition: StateIndexDefinition<TestState, TestMetadata>,
  value: StateSnapshot<TestState, TestMetadata>
): Promise<string> {
  source.snapshot = value;
  return serializeStateIndex(
    resultValue(await buildStateIndex(definition, { root: "." })),
    definition
  );
}

async function createGitRepositoryFixture(options: {
  definition: StateIndexDefinition<TestState, TestMetadata>;
  name: string;
  revision: StateSnapshot<TestState, TestMetadata> | null;
  source: TestSource;
  stageOutside?: boolean;
  tempRoot: string;
  workspace: StateSnapshot<TestState, TestMetadata>;
}): Promise<RepositoryFixture> {
  const repositoryRoot = path.join(options.tempRoot, options.name);
  await fs.mkdir(repositoryRoot, { recursive: true });
  initializeRepository(repositoryRoot);
  const revisionText =
    options.revision === null
      ? null
      : await buildText(options.source, options.definition, options.revision);
  if (revisionText !== null) {
    await writeFile(repositoryRoot, indexPath, revisionText);
  }
  await writeFile(repositoryRoot, "domain/source.md", "revision domain\n");
  await writeFile(repositoryRoot, "outside/keep.md", "revision outside\n");
  runGit(repositoryRoot, ["add", "."]);
  runGit(repositoryRoot, ["commit", "--quiet", "--message", "base"]);

  const workspaceText = await buildText(
    options.source,
    options.definition,
    options.workspace
  );
  await writeFile(repositoryRoot, indexPath, workspaceText);
  await writeFile(repositoryRoot, "domain/source.md", "workspace domain\n");
  if (options.stageOutside === true) {
    await writeFile(repositoryRoot, "outside/keep.md", "pending outside\n");
    runGit(repositoryRoot, ["add", "outside/keep.md"]);
  }
  return { repositoryRoot, revisionText, workspaceText };
}

async function createStagingFixture(options: {
  definition: StateIndexDefinition<TestState, TestMetadata>;
  name: string;
  revision: StateSnapshot<TestState, TestMetadata> | null;
  source: TestSource;
  tempRoot: string;
  workspace: StateSnapshot<TestState, TestMetadata>;
}): Promise<StagingFixture> {
  const repositoryRoot = path.join(options.tempRoot, options.name);
  await fs.mkdir(repositoryRoot, { recursive: true });
  const revisionText =
    options.revision === null
      ? null
      : await buildText(options.source, options.definition, options.revision);
  const workspaceText = await buildText(
    options.source,
    options.definition,
    options.workspace
  );
  await writeFile(repositoryRoot, indexPath, workspaceText);

  let fixture: StagingFixture;
  fixture = {
    onReplace: null,
    replacements: [],
    repository: {
      getCurrentRevision: async () =>
        fixture.revisionFile === null ? null : "revision",
      readRevisionFile: async (revision, filePath) => {
        assert.equal(revision, "revision");
        assert.equal(filePath, indexPath);
        return fixture.revisionFile;
      },
      replacePendingFiles: async (replacement) => {
        await fixture.onReplace?.(replacement);
        fixture.replacements.push(replacement);
        return {
          pathScope: replacement.pathScope,
          pendingPaths: replacement.files.map((file) => file.path),
          previousPaths:
            replacement.expectedFiles?.map((file) => file.path) ?? []
        };
      },
      rootDirectory: repositoryRoot
    },
    repositoryRoot,
    revisionFile:
      revisionText === null
        ? null
        : { data: Buffer.from(revisionText, "utf8"), path: indexPath },
    revisionText,
    workspaceText
  };
  return fixture;
}

async function stageFixture(
  fixture: StagingFixture,
  definition: StateIndexDefinition<TestState, TestMetadata>,
  selectedIds: readonly string[],
  targetIndexPath = indexPath
) {
  return await stageSelectedIndexEntriesWithRepository(
    {
      context: { root: fixture.repositoryRoot },
      definition,
      indexPath: targetIndexPath,
      selectedIds
    },
    async () => fixture.repository
  );
}

async function readStagedIndex(
  fixture: StagingFixture,
  definition: StateIndexDefinition<TestState, TestMetadata>
) {
  const replacement = fixture.replacements.at(-1);
  if (replacement === undefined) {
    assert.fail("staging must record a successful pending replacement");
  }
  const file = replacement.files[0];
  if (file === undefined) {
    assert.fail("staging replacement must contain the index file");
  }
  return resultValue(
    parseStateIndex({
      definition,
      expectation: { definitionVersion: 1, namespace: "staging-test" },
      sourcePath: indexPath,
      text: Buffer.from(file.data).toString("utf8")
    })
  );
}

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

function initializeRepository(repositoryRoot: string): void {
  runGit(repositoryRoot, ["init", "--quiet"]);
  runGit(repositoryRoot, ["config", "core.autocrlf", "false"]);
  runGit(repositoryRoot, ["config", "user.email", "staging@example.invalid"]);
  runGit(repositoryRoot, ["config", "user.name", "Index Staging Test"]);
}

function pendingConflictDiagnostic(detail: string) {
  return {
    code: "state-index.pending-conflict",
    message:
      "the current revision or target pending content changed; reread the current " +
      "revision and target pending content, resolve any existing pending change for " +
      "this index, then retry",
    path: indexPath,
    stateId: null,
    versionControl: {
      causeCategory: "unknown",
      detail,
      operation: "verify a pending replacement",
      target: indexPath
    }
  };
}

function runGit(workingDirectory: string, args: readonly string[]): string {
  return execFileSync("git", ["-C", workingDirectory, ...args], {
    encoding: "utf8",
    windowsHide: true
  });
}

async function writeFile(
  rootDirectory: string,
  relativePath: string,
  content: string
): Promise<void> {
  const targetPath = path.join(rootDirectory, relativePath);
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, content, "utf8");
}

async function readPendingIndex(
  repositoryRoot: string,
  definition: StateIndexDefinition<TestState, TestMetadata>
) {
  return resultValue(
    parseStateIndex({
      definition,
      expectation: { definitionVersion: 1, namespace: "staging-test" },
      sourcePath: indexPath,
      text: await pendingIndexText(repositoryRoot)
    })
  );
}

async function pendingIndexText(repositoryRoot: string): Promise<string> {
  const files = await (
    await openVersionControl(repositoryRoot)
  ).readPendingFiles({
    pathScopes: [indexPath]
  });
  assert.equal(files.length, 1);
  return Buffer.from(files[0]!.data).toString("utf8");
}

async function readPendingText(
  repositoryRoot: string,
  pathScope: string
): Promise<Array<{ data: string; path: string }>> {
  const files = await (
    await openVersionControl(repositoryRoot)
  ).readPendingFiles({
    pathScopes: [pathScope]
  });
  return files.map((file) => ({
    data: Buffer.from(file.data).toString("utf8"),
    path: file.path
  }));
}

async function pendingChangedPaths(repositoryRoot: string): Promise<string[]> {
  const repository = await openVersionControl(repositoryRoot);
  const revision = await repository.getCurrentRevision();
  assert.notEqual(revision, null);
  return await repository.listPendingChangedPaths({ from: revision! });
}

function entryLabels(
  index: ReadonlyStateIndex<TestState, TestMetadata>
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(index.entries).map(([id, entry]) => [id, entry.state.label])
  );
}

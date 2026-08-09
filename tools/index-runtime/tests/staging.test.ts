import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { openVersionControl } from "../../shared/src/version-control/index.ts";
import {
  buildStateIndex,
  createStateIndexRuntime,
  defineStateIndexDefinition,
  parseStateIndex,
  serializeStateIndex,
  stageSelectedIndexEntries,
  type ReadonlyStateIndex,
  type StateIndexDefinition,
  type StateIndexEntryStageResult,
  type StateSnapshot
} from "../src/index.ts";
import { resultValue } from "./support.ts";

const indexPath = "indexes/states.json";
const testOptions = { timeout: 15_000 };
const expectedPendingConflictDiagnostic = {
  code: "state-index.pending-conflict",
  message: "the current revision or target pending content may have changed, or the pending "
    + "write boundary may be busy; reread the current revision and target pending content, "
    + "resolve any existing pending change for this index, then retry",
  path: indexPath,
  stateId: null
} as const;

type TestMetadata = {
  catalog: string;
};

type TestState = {
  id: string;
  label: string;
};

type TestControl = {
  onValidation: ((
    index: ReadonlyStateIndex<TestState, TestMetadata>
  ) => void) | null;
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

async function withTempRoot(
  run: (tempRoot: string) => Promise<void>
): Promise<void> {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "index-staging-test-"));
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
    keyStrategies: [{
      derive: (state) => state.label,
      mode: "exact",
      name: "label"
    }],
    namespace: "staging-test",
    parseMetadata: (input) => {
      if (typeof input.catalog !== "string") {
        throw new TypeError("catalog must be text");
      }
      return { catalog: input.catalog };
    },
    parseState: (input, context) => {
      if (
        typeof input.id !== "string"
        || typeof input.label !== "string"
        || input.id !== context.id
      ) {
        throw new TypeError("state id and label must match the record identity");
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
      entries: Object.fromEntries(ids.map((id) => [
        id,
        `${revisionPrefix}:${id}`
      ])),
      metadata: metadataRevision
    },
    states: Object.fromEntries(ids.map((id) => [
      id,
      { id, label: labels[id]! }
    ]))
  };
}

function isSelectedMixedTarget(
  index: ReadonlyStateIndex<TestState, TestMetadata>
): boolean {
  return index.entries.A?.state.label === "A1"
    && index.entries.B?.state.label === "B0";
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

async function createRepositoryFixture(options: {
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
  const revisionText = options.revision === null
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

test("stages selected states and revisions while preserving workspace and outside pending files", testOptions, async () => {
  await withTempRoot(async (tempRoot) => {
    const control = createControl();
    const source: TestSource = { snapshot: snapshot({}, "empty") };
    const definition = createDefinition(source, control);
    const fixture = await createRepositoryFixture({
      definition,
      name: "selected",
      revision: snapshot({ A: "A0", B: "B0", C: "C0" }, "revision"),
      source,
      stageOutside: true,
      tempRoot,
      workspace: snapshot({ A: "A1", B: "B1", C: "C1" }, "workspace")
    });
    resetControl(control);
    const runtime = createStateIndexRuntime({
      definition,
      indexPath,
      root: fixture.repositoryRoot
    });

    const staged = await runtime.stageSelectedEntries(["C", "A"]);
    assert.deepEqual(staged, {
      changed: true,
      diagnostics: [],
      indexPath,
      namespace: "staging-test",
      selectedIds: ["A", "C"],
      state: "staged",
      status: "ok"
    });
    const firstPending = await readPendingIndex(fixture.repositoryRoot, definition);
    assert.deepEqual(entryLabels(firstPending), { A: "A1", B: "B0", C: "C1" });
    assert.deepEqual(firstPending.sourceRevision.entries, {
      A: "workspace:A",
      B: "revision:B",
      C: "workspace:C"
    });
    assert.equal(
      await fs.readFile(path.join(fixture.repositoryRoot, indexPath), "utf8"),
      fixture.workspaceText
    );
    assert.equal(
      await fs.readFile(path.join(fixture.repositoryRoot, "domain/source.md"), "utf8"),
      "workspace domain\n"
    );
    assert.deepEqual(
      await readPendingText(fixture.repositoryRoot, "outside/keep.md"),
      [{ data: "pending outside\n", path: "outside/keep.md" }]
    );

    runGit(fixture.repositoryRoot, ["reset", "--quiet", "HEAD", "--", indexPath]);
    const reordered = await runtime.stageSelectedEntries(["A", "C"]);
    assert.equal(reordered.status, "ok");
    assert.equal(
      await pendingIndexText(fixture.repositoryRoot),
      serializeStateIndex(firstPending, definition)
    );
    assert.equal(control.reads, 0);
    assert.equal(control.revisionReads, 0);
  });
});

test("applies one id-existence rule to additions deletions no-ops and explicit renames", testOptions, async () => {
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
        revision: snapshot(Object.fromEntries([
          ["A", "A0"],
          ["__proto__", "old"]
        ]), "revision"),
        selectedIds: ["constructor", "__proto__"],
        workspace: snapshot(Object.fromEntries([
          ["A", "A0"],
          ["constructor", "new"]
        ]), "workspace")
      }
    ] as const;

    for (const scenario of scenarios) {
      const control = createControl();
      const source: TestSource = { snapshot: snapshot({}, "empty") };
      const definition = createDefinition(source, control);
      const fixture = await createRepositoryFixture({
        definition,
        name: scenario.name,
        revision: scenario.revision,
        source,
        tempRoot,
        workspace: scenario.workspace
      });
      resetControl(control);
      const result = await stageSelectedIndexEntries({
        context: { root: fixture.repositoryRoot },
        definition,
        indexPath,
        selectedIds: scenario.selectedIds
      });
      assert.equal(result.status, "ok", scenario.name);
      assert.deepEqual(
        entryLabels(await readPendingIndex(fixture.repositoryRoot, definition)),
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
});

test("uses workspace collection data for a missing baseline and permits an empty target", testOptions, async () => {
  await withTempRoot(async (tempRoot) => {
    const control = createControl();
    const source: TestSource = { snapshot: snapshot({}, "empty") };
    const definition = createDefinition(source, control);
    const first = await createRepositoryFixture({
      definition,
      name: "first-index",
      revision: null,
      source,
      tempRoot,
      workspace: snapshot({ A: "A1", B: "B1" }, "workspace", "first", "metadata:first")
    });
    resetControl(control);
    const firstResult = await stageSelectedIndexEntries({
      context: { root: first.repositoryRoot },
      definition,
      indexPath,
      selectedIds: ["B"]
    });
    assert.equal(firstResult.status, "ok");
    const firstPending = await readPendingIndex(first.repositoryRoot, definition);
    assert.deepEqual(entryLabels(firstPending), { B: "B1" });
    assert.deepEqual(firstPending.metadata, { catalog: "first" });
    assert.equal(firstPending.sourceRevision.metadata, "metadata:first");

    const empty = await createRepositoryFixture({
      definition,
      name: "empty-target",
      revision: snapshot({ A: "A0" }, "revision"),
      source,
      tempRoot,
      workspace: snapshot({}, "workspace")
    });
    resetControl(control);
    const emptyResult = await stageSelectedIndexEntries({
      context: { root: empty.repositoryRoot },
      definition,
      indexPath,
      selectedIds: ["A"]
    });
    assert.equal(emptyResult.status, "ok");
    const emptyPending = await readPendingIndex(empty.repositoryRoot, definition);
    assert.deepEqual(emptyPending.entries, {});
    assert.deepEqual(emptyPending.sourceRevision.entries, {});
  });
});

test("rejects invalid staging inputs without changing pending content", testOptions, async () => {
  await withTempRoot(async (tempRoot) => {
    const control = createControl();
    const source: TestSource = { snapshot: snapshot({}, "empty") };
    const definition = createDefinition(source, control);
    const fixture = await createRepositoryFixture({
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
      const result = await stageSelectedIndexEntries({
        context: { root: fixture.repositoryRoot },
        definition,
        indexPath,
        selectedIds: selectedIds as readonly string[]
      });
      assert.equal(result.status, "error");
      assert.equal(result.state, "selection-invalid");
    }
    const invalidPath = await stageSelectedIndexEntries({
      context: { root: fixture.repositoryRoot },
      definition,
      indexPath: "../states.json",
      selectedIds: ["A"]
    });
    assert.equal(invalidPath.state, "index-path-invalid");
    assert.equal(
      invalidPath.diagnostics[0]?.code,
      "state-index.index-path-invalid"
    );
    assert.deepEqual(
      await pendingChangedPaths(fixture.repositoryRoot),
      []
    );
  });
});

test("reports an actionable repository discovery failure before staging", testOptions, async () => {
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
    assert.equal(result.diagnostics[0]?.code, "state-index.repository-unavailable");
    assert.match(result.diagnostics[0]?.message ?? "", /repository-backed root.*retry/u);
  });
});

test("reports an actionable pending replacement failure and preserves the index", testOptions, async () => {
  await withTempRoot(async (tempRoot) => {
    const control = createControl();
    const source: TestSource = { snapshot: snapshot({}, "empty") };
    const definition = createDefinition(source, control);
    const fixture = await createRepositoryFixture({
      definition,
      name: "pending-write-failure",
      revision: snapshot({ A: "A0" }, "revision"),
      source,
      tempRoot,
      workspace: snapshot({ A: "A1" }, "workspace")
    });
    const pendingIndexPath = path.join(fixture.repositoryRoot, ".git", "index");
    const corruptPending = Buffer.from("corrupt pending snapshot", "utf8");
    await fs.writeFile(pendingIndexPath, corruptPending);
    resetControl(control);

    const result = await stageSelectedIndexEntries({
      context: { root: fixture.repositoryRoot },
      definition,
      indexPath,
      selectedIds: ["A"]
    });
    assert.equal(result.state, "pending-write-failed");
    assert.equal(result.diagnostics[0]?.code, "state-index.pending-write-failed");
    assert.match(
      result.diagnostics[0]?.message ?? "",
      /inspect the target pending content and repository access, then retry/u
    );
    assert.deepEqual(await fs.readFile(pendingIndexPath), corruptPending);
    assert.equal(
      await fs.readFile(path.join(fixture.repositoryRoot, indexPath), "utf8"),
      fixture.workspaceText
    );
  });
});

test("rejects invalid revision and workspace indexes before pending replacement", testOptions, async () => {
  await withTempRoot(async (tempRoot) => {
    const control = createControl();
    const source: TestSource = { snapshot: snapshot({}, "empty") };
    const definition = createDefinition(source, control);
    const invalidRevision = await createRepositoryFixture({
      definition,
      name: "invalid-revision",
      revision: snapshot({ A: "A0" }, "revision"),
      source,
      tempRoot,
      workspace: snapshot({ A: "A1" }, "workspace")
    });
    await fs.writeFile(
      path.join(invalidRevision.repositoryRoot, indexPath),
      Buffer.from([0xff, 0xfe, 0xfd])
    );
    runGit(invalidRevision.repositoryRoot, ["add", indexPath]);
    runGit(invalidRevision.repositoryRoot, [
      "commit",
      "--quiet",
      "--amend",
      "--no-edit"
    ]);
    await writeFile(
      invalidRevision.repositoryRoot,
      indexPath,
      invalidRevision.workspaceText
    );
    resetControl(control);
    const revisionResult = await stageSelectedIndexEntries({
      context: { root: invalidRevision.repositoryRoot },
      definition,
      indexPath,
      selectedIds: ["A"]
    });
    assert.equal(revisionResult.state, "revision-index-invalid");
    assert.equal(
      revisionResult.diagnostics[0]?.code,
      "state-index.revision-index-encoding-invalid"
    );

    const invalidWorkspace = await createRepositoryFixture({
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
    const workspaceResult = await stageSelectedIndexEntries({
      context: { root: invalidWorkspace.repositoryRoot },
      definition,
      indexPath,
      selectedIds: ["A"]
    });
    assert.equal(workspaceResult.state, "workspace-index-invalid");
    assert.ok(workspaceResult.diagnostics.some((entry) => (
      entry.code === "state-index.namespace-mismatch"
    )));
    assert.deepEqual(await pendingChangedPaths(invalidWorkspace.repositoryRoot), []);

    const invalidWorkspaceEncoding = await createRepositoryFixture({
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
    const workspaceEncodingResult = await stageSelectedIndexEntries({
      context: { root: invalidWorkspaceEncoding.repositoryRoot },
      definition,
      indexPath,
      selectedIds: ["A"]
    });
    assert.equal(workspaceEncodingResult.state, "workspace-index-invalid");
    assert.equal(
      workspaceEncodingResult.diagnostics[0]?.code,
      "state-index.index-encoding-invalid"
    );
    assert.deepEqual(
      await pendingChangedPaths(invalidWorkspaceEncoding.repositoryRoot),
      []
    );
  });
});

test("rejects collection changes without source reads", testOptions, async () => {
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
      const fixture = await createRepositoryFixture({
        definition,
        name: collection.name,
        revision: snapshot({ A: "A0" }, "revision"),
        source,
        tempRoot,
        workspace: collection.workspace
      });
      resetControl(control);
      const result = await stageSelectedIndexEntries({
        context: { root: fixture.repositoryRoot },
        definition,
        indexPath,
        selectedIds: ["A"]
      });
      assert.equal(result.state, "collection-changed");
      assert.equal(control.reads, 0);
      assert.equal(control.revisionReads, 0);
      assert.deepEqual(await pendingChangedPaths(fixture.repositoryRoot), []);
    }
  });
});

test("rejects an invalid selected target after complete reprojection without source reads", testOptions, async () => {
  await withTempRoot(async (tempRoot) => {
    const control = createControl();
    const source: TestSource = { snapshot: snapshot({}, "empty") };
    const definition = createDefinition(source, control);
    const projection = await createRepositoryFixture({
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
        throw new TypeError("selected entries violate the complete-index rule");
      }
    };
    const rejected = await stageSelectedIndexEntries({
      context: { root: projection.repositoryRoot },
      definition,
      indexPath,
      selectedIds: ["A"]
    });
    assert.equal(rejected.state, "target-invalid");
    assert.ok(rejected.diagnostics.some((entry) => (
      entry.code === "state-index.index-validation-failed"
    )));
    assert.equal(observedSelectedTarget, true);
    assert.equal(control.reads, 0);
    assert.equal(control.revisionReads, 0);
    assert.deepEqual(await pendingChangedPaths(projection.repositoryRoot), []);
  });
});

test("rejects dirty same-index pending content even when selected entries are unchanged", testOptions, async () => {
  await withTempRoot(async (tempRoot) => {
    const control = createControl();
    const source: TestSource = { snapshot: snapshot({}, "empty") };
    const definition = createDefinition(source, control);
    const fixture = await createRepositoryFixture({
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
    assert.deepEqual(result.diagnostics, [expectedPendingConflictDiagnostic]);
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
      await fs.readFile(path.join(fixture.repositoryRoot, "domain/source.md"), "utf8"),
      "workspace domain\n"
    );
  });
});

test("serializes concurrent selected-entry staging without overwriting a winner", testOptions, async () => {
  await withTempRoot(async (tempRoot) => {
    const control = createControl();
    const source: TestSource = { snapshot: snapshot({}, "empty") };
    const definition = createDefinition(source, control);
    const fixture = await createRepositoryFixture({
      definition,
      name: "concurrent",
      revision: snapshot({ A: "A0", B: "B0" }, "revision"),
      source,
      tempRoot,
      workspace: snapshot({ A: "A1", B: "B1" }, "workspace")
    });
    resetControl(control);

    const results = await Promise.all([
      stageSelectedIndexEntries({
        context: { root: fixture.repositoryRoot },
        definition,
        indexPath,
        selectedIds: ["A"]
      }),
      stageSelectedIndexEntries({
        context: { root: fixture.repositoryRoot },
        definition,
        indexPath,
        selectedIds: ["B"]
      })
    ]);
    assert.equal(results.filter((result) => result.status === "ok").length, 1);
    assert.equal(
      results.filter((result) => result.state === "pending-conflict").length,
      1
    );
    const pending = entryLabels(
      await readPendingIndex(fixture.repositoryRoot, definition)
    );
    assert.ok(
      JSON.stringify(pending) === JSON.stringify({ A: "A1", B: "B0" })
      || JSON.stringify(pending) === JSON.stringify({ A: "A0", B: "B1" })
    );
  });
});

test("rejects a revision that changes before the locked pending replacement", testOptions, async () => {
  await withTempRoot(async (tempRoot) => {
    const control = createControl();
    const source: TestSource = { snapshot: snapshot({}, "empty") };
    const definition = createDefinition(source, control);
    const fixture = await createRepositoryFixture({
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
    assert.deepEqual(result.diagnostics, [expectedPendingConflictDiagnostic]);
    assert.deepEqual(await pendingChangedPaths(fixture.repositoryRoot), []);
    assert.equal(
      await fs.readFile(path.join(fixture.repositoryRoot, indexPath), "utf8"),
      fixture.workspaceText
    );
  });
});

function initializeRepository(repositoryRoot: string): void {
  runGit(repositoryRoot, ["init", "--quiet"]);
  runGit(repositoryRoot, ["config", "core.autocrlf", "false"]);
  runGit(repositoryRoot, ["config", "user.email", "staging@example.invalid"]);
  runGit(repositoryRoot, ["config", "user.name", "Index Staging Test"]);
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
  return resultValue(parseStateIndex({
    definition,
    expectation: { definitionVersion: 1, namespace: "staging-test" },
    sourcePath: indexPath,
    text: await pendingIndexText(repositoryRoot)
  }));
}

async function pendingIndexText(repositoryRoot: string): Promise<string> {
  const files = await (await openVersionControl(repositoryRoot)).readPendingFiles({
    pathScopes: [indexPath]
  });
  assert.equal(files.length, 1);
  return Buffer.from(files[0]!.data).toString("utf8");
}

async function readPendingText(
  repositoryRoot: string,
  pathScope: string
): Promise<Array<{ data: string; path: string }>> {
  const files = await (await openVersionControl(repositoryRoot)).readPendingFiles({
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
  return Object.fromEntries(Object.entries(index.entries).map(([id, entry]) => [
    id,
    entry.state.label
  ]));
}

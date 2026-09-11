/* oxlint-disable no-unused-vars -- Shared test fixture keeps the original dependency surface for focused scenario modules. */
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
  initializeRepository,
  readPendingIndex,
  runGit,
  writeFile
} from "./staging-pending-support.ts";

export const indexPath = "indexes/states.json";
export const testOptions = { timeout: 15_000 };
export type TestMetadata = {
  catalog: string;
};

export type TestState = {
  id: string;
  label: string;
};

export type TestControl = {
  onValidation:
    | ((index: ReadonlyStateIndex<TestState, TestMetadata>) => void)
    | null;
  reads: number;
  revisionReads: number;
};

export type TestSource = {
  snapshot: StateSnapshot<TestState, TestMetadata>;
};

export type RepositoryFixture = {
  repositoryRoot: string;
  revisionText: string | null;
  workspaceText: string;
};

export type StagingFixture = RepositoryFixture & {
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

export async function withTempRoot(
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

export function createControl(): TestControl {
  return {
    onValidation: null,
    reads: 0,
    revisionReads: 0
  };
}

export function resetControl(control: TestControl): void {
  control.reads = 0;
  control.revisionReads = 0;
}

export function createDefinition(
  source: TestSource,
  control: TestControl
): StateIndexDefinition<TestState, TestMetadata> {
  return defineStateIndexDefinition<TestState, TestMetadata>({
    definitionVersion: 1,
    queryFields: [
      {
        mode: "exact",
        name: "label",
        sources: [{ kind: "state-path", path: ["label"] }]
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

export function snapshot(
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

export function isSelectedMixedTarget(
  index: ReadonlyStateIndex<TestState, TestMetadata>
): boolean {
  return index.entries.A?.label === "A1" && index.entries.B?.label === "B0";
}

export async function buildText(
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

export async function createGitRepositoryFixture(options: {
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

export async function createStagingFixture(options: {
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

export async function stageFixture(
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

export async function readStagedIndex(
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

export {
  entryLabels,
  pendingChangedPaths,
  pendingConflictDiagnostic,
  pendingIndexText,
  readPendingText,
  runGit,
  writeFile
} from "./staging-pending-support.ts";
export { readPendingIndex } from "./staging-pending-support.ts";

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after } from "node:test";
import test from "node:test";
import * as v from "valibot";
import { stageTestEvidenceIndex as stageBundledTestEvidenceIndex } from "../../../skills/test-evidence-review/scripts/test-evidence-catalog.mjs";
import {
  stageTestEvidenceIndex,
  syncTestEvidenceIndex,
  testEvidenceIndexStageResultSchema,
  testEvidenceStateIndexSchema,
  type TestEvidenceStateIndex
} from "../src/cli.ts";
import { executeTestEvidenceIndexStage } from "../src/staging.ts";
import {
  bootstrapStagingFixtureTemplates,
  removeStagingFixtureTemplates,
  runGit,
  type StagingFixtureTemplates,
  withStagingGitFixture
} from "./staging-fixture.ts";

const repositoryRoot = path.resolve(import.meta.dirname, "..", "..", "..");
const distributedScript = path.join(
  repositoryRoot,
  "skills",
  "test-evidence-review",
  "scripts",
  "test-evidence-catalog.mjs"
);
const catalogPath = "docs/test-evidence";
const indexRepositoryPath = `${catalogPath}/test-evidence-index.json`;
const topicCatalogPath = `${catalogPath}/test-evidence-topics.json`;
const defaultTopicDescription = "Runtime staging contract evidence.";

let fixtureTemplates: Promise<StagingFixtureTemplates> | undefined;

function stagingFixtureTemplates(): Promise<StagingFixtureTemplates> {
  fixtureTemplates ??= bootstrapStagingFixtureTemplates();
  return fixtureTemplates;
}

after(async () => {
  if (fixtureTemplates !== undefined) {
    await removeStagingFixtureTemplates(await fixtureTemplates);
  }
});

type CaseFixture = Readonly<{
  id: string;
  slug: string;
  title: string;
}>;

const caseA: CaseFixture = {
  id: "TEST-EVIDENCE-STAGE-A-001",
  slug: "stage-a",
  title: "Case A baseline"
};
const caseB: CaseFixture = {
  id: "TEST-EVIDENCE-STAGE-B-001",
  slug: "stage-b",
  title: "Case B baseline"
};
const caseC: CaseFixture = {
  id: "TEST-EVIDENCE-STAGE-C-001",
  slug: "stage-c",
  title: "Case C baseline"
};
const caseD: CaseFixture = {
  id: "TEST-EVIDENCE-STAGE-D-001",
  slug: "stage-d",
  title: "Case D renamed"
};
const caseE: CaseFixture = {
  id: "TEST-EVIDENCE-STAGE-E-001",
  slug: "stage-e",
  title: "Case E added"
};

test("stage-index validates fixed case ids before repository access", async () => {
  await withTempWorkspace("input", async (tempRoot) => {
    const workspaceRoot = path.join(tempRoot, "missing-workspace");
    const empty = await stageTestEvidenceIndex({
      caseIds: [],
      workspaceRoot
    });
    assert.equal(empty.status, "error");
    assert.equal(empty.state, "selection-invalid");
    assert.equal(
      empty.diagnostics[0]?.code,
      "test-evidence.stage-case-ids-empty"
    );

    const invalid = await stageTestEvidenceIndex({
      caseIds: ["INVALID-001"],
      workspaceRoot
    });
    assert.equal(invalid.status, "error");
    assert.equal(invalid.state, "selection-invalid");
    assert.equal(
      invalid.diagnostics[0]?.code,
      "test-evidence.stage-case-id-invalid"
    );

    const duplicate = await stageTestEvidenceIndex({
      caseIds: [caseA.id, caseA.id],
      workspaceRoot
    });
    assert.equal(duplicate.status, "error");
    assert.equal(duplicate.state, "selection-invalid");
    assert.equal(
      duplicate.diagnostics[0]?.code,
      "test-evidence.stage-case-id-duplicate"
    );

    const execution = await executeTestEvidenceIndexStage({
      caseIds: [caseA.id, caseA.id],
      workspaceRoot
    });
    assert.equal(execution.isErr(), true);
    if (execution.isErr()) {
      assert.equal(execution.error.kind, "invalid-arguments");
      assert.equal(execution.error.result.status, "error");
    }
    await assert.rejects(fs.stat(workspaceRoot), { code: "ENOENT" });
  });
});

test("stage-index isolates one case without reading or staging domain files", async () => {
  await withStagingGitFixture(
    await stagingFixtureTemplates(),
    "catalog-a-b",
    async (workspaceRoot) => {
      await fs.writeFile(path.join(workspaceRoot, "outside.txt"), "outside\n");
      runGit(workspaceRoot, ["add", "outside.txt"]);
      await writeCatalog(workspaceRoot, [
        { ...caseA, title: "Case A workspace" },
        { ...caseB, title: "Case B workspace" }
      ]);

      const baseline = readRevisionIndex(workspaceRoot);
      const workspace = await readWorkspaceIndex(workspaceRoot);
      const topicFile = path.join(workspaceRoot, topicCatalogPath);
      const caseAFile = caseFilePath(workspaceRoot, caseA);
      const caseBFile = caseFilePath(workspaceRoot, caseB);
      await fs.writeFile(topicFile, "not valid JSON\n");
      await fs.writeFile(caseAFile, "not a valid case\n");
      await fs.writeFile(caseBFile, "also not a valid case\n");
      const before = {
        caseA: await fs.readFile(caseAFile),
        caseB: await fs.readFile(caseBFile),
        index: await fs.readFile(indexPath(workspaceRoot)),
        topics: await fs.readFile(topicFile)
      };

      const cli = runGeneratedStage(workspaceRoot, [caseA.id], true);
      assert.equal(cli.status, 0, cli.stderr);
      assert.equal(cli.stderr, "");
      const result = v.parse(
        testEvidenceIndexStageResultSchema,
        JSON.parse(cli.stdout) as unknown
      );
      assert.deepEqual(result, {
        changed: true,
        diagnostics: [],
        indexPath: indexRepositoryPath,
        namespace: "test-evidence",
        selectedIds: [caseA.id],
        state: "staged",
        status: "ok"
      });

      const pending = readPendingIndex(workspaceRoot);
      assert.deepEqual(pending.entries[caseA.id], workspace.entries[caseA.id]);
      assert.deepEqual(pending.entries[caseB.id], baseline.entries[caseB.id]);
      assert.deepEqual(pending.metadata, baseline.metadata);
      assert.deepEqual(
        pendingPaths(workspaceRoot).sort(),
        [indexRepositoryPath, "outside.txt"].sort()
      );
      assert.deepEqual(
        await fs.readFile(indexPath(workspaceRoot)),
        before.index
      );
      assert.deepEqual(await fs.readFile(topicFile), before.topics);
      assert.deepEqual(await fs.readFile(caseAFile), before.caseA);
      assert.deepEqual(await fs.readFile(caseBFile), before.caseB);
    }
  );
});

test("stage-index applies selected additions deletions and explicit renames", async () => {
  await withStagingGitFixture(
    await stagingFixtureTemplates(),
    "catalog-a-b-c",
    async (workspaceRoot) => {
      await writeCatalog(workspaceRoot, [
        { ...caseA, title: "Case A unselected workspace change" },
        caseD,
        caseE
      ]);
      const baseline = readRevisionIndex(workspaceRoot);
      const workspace = await readWorkspaceIndex(workspaceRoot);

      const cli = runGeneratedStage(workspaceRoot, [
        caseE.id,
        caseB.id,
        caseD.id,
        caseC.id
      ]);
      assert.equal(cli.status, 0, cli.stderr);
      assert.equal(cli.stderr, "");
      assert.match(cli.stdout, /state: staged; changed: true/u);
      assert.match(
        cli.stdout,
        new RegExp(
          `selected IDs: ${[caseB.id, caseC.id, caseD.id, caseE.id].join(", ")}`,
          "u"
        )
      );
      assert.match(
        cli.stdout,
        /case Markdown, test code, and product code remain outside/u
      );

      const pending = readPendingIndex(workspaceRoot);
      assert.deepEqual(Object.keys(pending.entries), [
        caseA.id,
        caseD.id,
        caseE.id
      ]);
      assert.deepEqual(pending.entries[caseA.id], baseline.entries[caseA.id]);
      assert.deepEqual(pending.entries[caseD.id], workspace.entries[caseD.id]);
      assert.deepEqual(pending.entries[caseE.id], workspace.entries[caseE.id]);
      assert.deepEqual(pendingPaths(workspaceRoot), [indexRepositoryPath]);
    }
  );
});

test("stage-index bootstraps the first test evidence index", async () => {
  await withStagingGitFixture(
    await stagingFixtureTemplates(),
    "readme",
    async (workspaceRoot) => {
      await writeCatalog(workspaceRoot, [caseA, caseB]);

      const result = await stageBundledTestEvidenceIndex({
        caseIds: [caseA.id],
        workspaceRoot
      });
      assert.equal(result.status, "ok");
      assert.equal(result.state, "staged");
      assert.deepEqual(result.selectedIds, [caseA.id]);
      assert.deepEqual(pendingPaths(workspaceRoot), [indexRepositoryPath]);
      const pending = readPendingIndex(workspaceRoot);
      assert.deepEqual(Object.keys(pending.entries), [caseA.id]);
      assert.equal(pending.metadata.topics[0]?.id, "runtime");
    }
  );
});

test("stage-index permits a legal empty target", async () => {
  await withStagingGitFixture(
    await stagingFixtureTemplates(),
    "catalog-a",
    async (workspaceRoot) => {
      await writeCatalog(workspaceRoot, []);

      const result = await stageTestEvidenceIndex({
        caseIds: [caseA.id],
        workspaceRoot
      });
      assert.equal(result.status, "ok");
      assert.equal(result.state, "staged");
      assert.deepEqual(readPendingIndex(workspaceRoot).entries, {});
    }
  );
});

test("stage-index reports an unchanged selected case", async () => {
  await withStagingGitFixture(
    await stagingFixtureTemplates(),
    "catalog-a",
    async (workspaceRoot) => {
      const result = await stageTestEvidenceIndex({
        caseIds: [caseA.id],
        workspaceRoot
      });
      assert.equal(result.status, "ok");
      assert.equal(result.state, "unchanged");
      assert.equal(result.changed, false);
      assert.deepEqual(pendingPaths(workspaceRoot), []);
    }
  );
});

test("stage-index rejects case ids missing from both indexes", async () => {
  await withStagingGitFixture(
    await stagingFixtureTemplates(),
    "catalog-a",
    async (workspaceRoot) => {
      const before = await fs.readFile(indexPath(workspaceRoot));

      const result = await stageTestEvidenceIndex({
        caseIds: [caseE.id],
        workspaceRoot
      });
      assert.equal(result.status, "error");
      assert.equal(result.state, "selection-invalid");
      assert.deepEqual(result.selectedIds, [caseE.id]);
      assert.equal(
        result.diagnostics[0]?.code,
        "state-index.selected-id-missing"
      );
      assert.deepEqual(pendingPaths(workspaceRoot), []);
      assert.deepEqual(await fs.readFile(indexPath(workspaceRoot)), before);
    }
  );
});

test("stage-index reports unavailable version control without workspace writes", async () => {
  await withTempWorkspace("no-repository", async (workspaceRoot) => {
    await writeCatalog(workspaceRoot, [caseA]);
    const before = {
      caseFile: await fs.readFile(caseFilePath(workspaceRoot, caseA)),
      index: await fs.readFile(indexPath(workspaceRoot))
    };

    const result = await stageTestEvidenceIndex({
      caseIds: [caseA.id],
      workspaceRoot
    });
    assert.equal(result.status, "error");
    assert.equal(result.state, "revision-read-failed");
    assert.equal(
      result.diagnostics[0]?.code,
      "state-index.repository-unavailable"
    );
    assert.deepEqual(result.diagnostics[0]?.versionControl, {
      causeCategory: "not-repository",
      detail: null,
      operation: "discover a version-control worktree",
      target: "configured root"
    });
    assert.deepEqual(await fs.readFile(indexPath(workspaceRoot)), before.index);
    assert.deepEqual(
      await fs.readFile(caseFilePath(workspaceRoot, caseA)),
      before.caseFile
    );
  });
});

test("stage-index rejects existing same-index pending content", async () => {
  await withStagingGitFixture(
    await stagingFixtureTemplates(),
    "catalog-a",
    async (workspaceRoot) => {
      await writeCatalog(workspaceRoot, [
        { ...caseA, title: "Pending version" }
      ]);
      runGit(workspaceRoot, ["add", indexRepositoryPath]);
      await fs.writeFile(path.join(workspaceRoot, "outside.txt"), "outside\n");
      runGit(workspaceRoot, ["add", "outside.txt"]);
      const pendingBefore = readPendingText(workspaceRoot);
      await writeCatalog(workspaceRoot, [
        { ...caseA, title: "Workspace version" }
      ]);
      const workspaceBefore = await fs.readFile(indexPath(workspaceRoot));

      const result = await stageTestEvidenceIndex({
        caseIds: [caseA.id],
        workspaceRoot
      });
      assert.equal(result.status, "error");
      assert.equal(result.state, "pending-conflict");
      assert.equal(result.diagnostics[0]?.code, "state-index.pending-conflict");
      assert.deepEqual(result.pending, {
        outcome: "no-change",
        scope: indexRepositoryPath
      });
      assert.ok(result.diagnostics[0]?.versionControl);
      assert.equal(readPendingText(workspaceRoot), pendingBefore);
      assert.deepEqual(
        pendingPaths(workspaceRoot).sort(),
        [indexRepositoryPath, "outside.txt"].sort()
      );
      assert.deepEqual(
        await fs.readFile(indexPath(workspaceRoot)),
        workspaceBefore
      );
    }
  );
});

test("stage-index rejects topic metadata changes", async () => {
  await withStagingGitFixture(
    await stagingFixtureTemplates(),
    "catalog-a",
    async (workspaceRoot) => {
      await writeCatalog(
        workspaceRoot,
        [caseA],
        "Changed runtime staging contract evidence."
      );

      const result = await stageTestEvidenceIndex({
        caseIds: [caseA.id],
        workspaceRoot
      });
      assert.equal(result.status, "error");
      assert.equal(result.state, "collection-changed");
      assert.equal(
        result.diagnostics[0]?.code,
        "state-index.stage-collection-changed"
      );
      assert.deepEqual(pendingPaths(workspaceRoot), []);
    }
  );
});

test("stage-index rejects workspace cases projected to an unknown topic", async () => {
  await withStagingGitFixture(
    await stagingFixtureTemplates(),
    "catalog-a",
    async (workspaceRoot) => {
      const index = structuredClone(await readWorkspaceIndex(workspaceRoot));
      const entry = index.entries[caseA.id];
      assert.ok(entry);
      entry.state.sourcePath = "unknown/stage-a.md";
      entry.keys.topic = ["unknown"];
      await fs.writeFile(
        indexPath(workspaceRoot),
        `${JSON.stringify(index, null, 2)}\n`
      );

      const result = await stageTestEvidenceIndex({
        caseIds: [caseA.id],
        workspaceRoot
      });
      assert.equal(result.status, "error");
      assert.equal(result.state, "workspace-index-invalid");
      assert.ok(
        result.diagnostics.some(
          (diagnostic) =>
            diagnostic.stateId === caseA.id &&
            diagnostic.code.startsWith("state-index.")
        )
      );
      assert.deepEqual(pendingPaths(workspaceRoot), []);
    }
  );
});

test("stage-index CLI exposes help and schema-valid exit contracts", async () => {
  await withTempWorkspace("cli-usage", async (tempRoot) => {
    const help = spawnSync(
      "node",
      [distributedScript, "stage-index", "--help"],
      { encoding: "utf8" }
    );
    assert.equal(help.status, 0, help.stderr);
    assert.equal(help.stderr, "");
    assert.match(help.stdout, /stage-index \[options\] <case-ids\.\.\.>/u);
    assert.match(help.stdout, /case Markdown, test code, and product code/u);

    const rootHelp = spawnSync("node", [distributedScript, "--help"], {
      encoding: "utf8"
    });
    assert.equal(rootHelp.status, 0, rootHelp.stderr);
    assert.match(
      rootHelp.stdout,
      /1  Validation, query, or operation failure\./u
    );

    const missing = runGeneratedStage(tempRoot, [], true);
    assert.equal(missing.status, 2);
    assert.equal(missing.stdout, "");
    assert.match(missing.stderr, /missing required argument 'case-ids'/u);

    for (const caseIds of [["INVALID-001"], [caseA.id, caseA.id]]) {
      const failure = runGeneratedStage(tempRoot, caseIds, true);
      assert.equal(failure.status, 2, failure.stderr);
      assert.equal(failure.stderr, "");
      const result = v.parse(
        testEvidenceIndexStageResultSchema,
        JSON.parse(failure.stdout) as unknown
      );
      assert.equal(result.status, "error");
      assert.equal(result.state, "selection-invalid");
    }

    const operationFailure = runGeneratedStage(tempRoot, [caseA.id], true);
    assert.equal(operationFailure.status, 1, operationFailure.stderr);
    assert.equal(operationFailure.stderr, "");
    const operationResult = v.parse(
      testEvidenceIndexStageResultSchema,
      JSON.parse(operationFailure.stdout) as unknown
    );
    assert.equal(operationResult.status, "error");
    assert.equal(operationResult.state, "revision-read-failed");
    assert.deepEqual(operationResult.diagnostics[0]?.versionControl, {
      causeCategory: "not-repository",
      detail: null,
      operation: "discover a version-control worktree",
      target: "configured root"
    });
  });
});

async function withTempWorkspace(
  name: string,
  operation: (workspaceRoot: string) => Promise<void>
): Promise<void> {
  const workspaceRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), `test-evidence-stage-${name}-`)
  );
  try {
    await operation(workspaceRoot);
  } finally {
    await fs.rm(workspaceRoot, { force: true, recursive: true });
  }
}

async function writeCatalog(
  workspaceRoot: string,
  cases: readonly CaseFixture[],
  topicDescription = defaultTopicDescription
): Promise<void> {
  await fs.rm(path.join(workspaceRoot, catalogPath), {
    force: true,
    recursive: true
  });
  await writeWorkspaceFile(
    workspaceRoot,
    topicCatalogPath,
    `${JSON.stringify(
      {
        schemaVersion: 1,
        topics: [{ description: topicDescription, id: "runtime" }]
      },
      null,
      2
    )}\n`
  );
  for (const fixture of cases) {
    await writeWorkspaceFile(
      workspaceRoot,
      `${catalogPath}/runtime/${fixture.slug}.md`,
      caseMarkdown(fixture)
    );
  }
  const synchronized = await syncTestEvidenceIndex({
    mode: "write",
    workspaceRoot
  });
  assert.equal(
    synchronized.status,
    "ok",
    synchronized.diagnostics.map((entry) => entry.message).join("; ")
  );
}

function caseMarkdown(fixture: CaseFixture): string {
  return [
    `### Case ${fixture.id}: ${fixture.title}`,
    "",
    "Entry:",
    `- \`tests/staging.test.ts > ${fixture.id}\``,
    "",
    "Contract:",
    `- ${fixture.title} remains independently stageable.`,
    "",
    "Proves:",
    `- ${fixture.title} produces an observable selected index entry.`,
    ""
  ].join("\n");
}

function runGeneratedStage(
  workspaceRoot: string,
  caseIds: readonly string[],
  json = false
) {
  return spawnSync(
    "node",
    [
      distributedScript,
      "stage-index",
      ...caseIds,
      "--root",
      workspaceRoot,
      ...(json ? ["--json"] : [])
    ],
    { encoding: "utf8" as const }
  );
}

async function readWorkspaceIndex(
  workspaceRoot: string
): Promise<TestEvidenceStateIndex> {
  return parseIndex(
    await fs.readFile(indexPath(workspaceRoot), "utf8"),
    indexPath(workspaceRoot)
  );
}

function readRevisionIndex(workspaceRoot: string): TestEvidenceStateIndex {
  return parseIndex(
    runGit(workspaceRoot, ["show", `HEAD:${indexRepositoryPath}`]),
    `HEAD:${indexRepositoryPath}`
  );
}

function readPendingIndex(workspaceRoot: string): TestEvidenceStateIndex {
  return parseIndex(
    readPendingText(workspaceRoot),
    `pending:${indexRepositoryPath}`
  );
}

function parseIndex(text: string, source: string): TestEvidenceStateIndex {
  try {
    return v.parse(testEvidenceStateIndexSchema, JSON.parse(text) as unknown);
  } catch (error) {
    assert.fail(
      `${source} is not a valid test evidence index: ${String(error)}`
    );
  }
}

function readPendingText(workspaceRoot: string): string {
  return runGit(workspaceRoot, ["show", `:${indexRepositoryPath}`]);
}

function pendingPaths(workspaceRoot: string): string[] {
  return runGit(workspaceRoot, ["diff", "--cached", "--name-only"])
    .split("\n")
    .filter((entry) => entry.length > 0);
}

function indexPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, ...indexRepositoryPath.split("/"));
}

function caseFilePath(workspaceRoot: string, fixture: CaseFixture): string {
  return path.join(
    workspaceRoot,
    ...`${catalogPath}/runtime/${fixture.slug}.md`.split("/")
  );
}

async function writeWorkspaceFile(
  workspaceRoot: string,
  relativePath: string,
  content: string
): Promise<void> {
  const targetPath = path.join(workspaceRoot, ...relativePath.split("/"));
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, content, "utf8");
}

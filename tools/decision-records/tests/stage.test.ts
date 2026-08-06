import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { createCliProgram } from "../src/cli-args.ts";
import {
  parseDecisionDomainCatalog
} from "../src/decision-domain-catalog.ts";
import {
  decisionSourceRevision
} from "../src/decision-state-index.ts";
import type { DecisionIndex } from "../src/types.ts";
import {
  candidateDecisionBody,
  commitWorkspace,
  fileExists,
  initializeGitRepository,
  runSourceCli,
  withTemporaryWorkspace,
  writeTestDomainCatalog
} from "./support.ts";

const domain = "decision-records";
const pathA = `${domain}/use-selected-a.md`;
const pathB = `${domain}/use-unselected-b.md`;
const oldPath = `${domain}/use-old-name.md`;
const newPath = `${domain}/use-new-name.md`;
const indexRepositoryPath = "docs/decisions/decision-index.json";
const catalogRepositoryPath = "docs/decisions/decision-domains.json";

test(
  "stage isolates one selected filesystem decision and rebuilds the complete pending index",
  () => withStageWorkspace("stage-isolation", {
    [pathA]: decisionBody("采用基线方案 A"),
    [pathB]: decisionBody("采用基线方案 B")
  }, async (workspaceRoot) => {
    await writeDecision(workspaceRoot, pathB, decisionBody("采用磁盘方案 B"));
    await syncFilesystemIndex(workspaceRoot);
    runGit(workspaceRoot, [
      "add",
      repositoryDecisionPath(pathB),
      indexRepositoryPath
    ]);

    await fs.writeFile(
      path.join(workspaceRoot, "README.md"),
      "outside pending change\n",
      "utf8"
    );
    runGit(workspaceRoot, ["add", "README.md"]);
    await writeDecision(workspaceRoot, pathA, decisionBody("采用磁盘方案 A"));

    const filesystemBefore = await readFilesystemDecisionScope(workspaceRoot, [
      pathA,
      pathB
    ]);
    const staged = await runSourceCli([
      "stage",
      pathA,
      "--root",
      workspaceRoot
    ]);
    assert.equal(staged.exitCode, 0, staged.stderr);
    assert.equal(staged.stderr, "");
    assert.match(staged.stdout, /complete pending decision snapshot/);

    assert.deepEqual(pendingChangedPaths(workspaceRoot), [
      "README.md",
      indexRepositoryPath,
      repositoryDecisionPath(pathA)
    ]);
    assert.equal(
      await readPendingText(workspaceRoot, repositoryDecisionPath(pathA)),
      decisionBody("采用磁盘方案 A")
    );
    assert.equal(
      await readPendingText(workspaceRoot, repositoryDecisionPath(pathB)),
      decisionBody("采用基线方案 B")
    );
    assert.equal(
      await readPendingText(workspaceRoot, "README.md"),
      "outside pending change\n"
    );

    const pendingIndex = await readPendingIndex(workspaceRoot);
    assert.deepEqual(
      pendingIndex.entries.map((entry) => [entry.id, entry.state.title]),
      [
        [pathA, "采用磁盘方案 A"],
        [pathB, "采用基线方案 B"]
      ]
    );
    await assertPendingSourceRevision(workspaceRoot, pendingIndex, [pathA, pathB]);
    assert.deepEqual(
      await readFilesystemDecisionScope(workspaceRoot, [pathA, pathB]),
      filesystemBefore
    );
  })
);

test(
  "stage applies selected additions modifications deletions and explicit renames",
  () => withStageWorkspace("stage-overlay", {
    [oldPath]: decisionBody("保留旧名称决策"),
    [pathA]: decisionBody("采用基线方案 A"),
    [pathB]: decisionBody("采用基线方案 B")
  }, async (workspaceRoot) => {
    const addedPath = `${domain}/use-added-c.md`;
    await writeDecision(workspaceRoot, pathA, decisionBody("采用修改方案 A"));
    await fs.rm(decisionPath(workspaceRoot, pathB));
    await writeDecision(workspaceRoot, addedPath, decisionBody("采用新增方案 C"));
    await fs.rm(decisionPath(workspaceRoot, oldPath));
    await writeDecision(workspaceRoot, newPath, decisionBody("采用新名称决策"));

    const staged = await runSourceCli([
      "stage",
      pathA,
      pathB,
      addedPath,
      oldPath,
      newPath,
      "--root",
      workspaceRoot
    ]);
    assert.equal(staged.exitCode, 0, staged.stderr);
    assert.deepEqual(pendingChangedPaths(workspaceRoot), [
      indexRepositoryPath,
      repositoryDecisionPath(oldPath),
      repositoryDecisionPath(pathA),
      repositoryDecisionPath(addedPath),
      repositoryDecisionPath(newPath),
      repositoryDecisionPath(pathB)
    ].sort());
    assert.equal(pendingFileExists(workspaceRoot, repositoryDecisionPath(pathB)), false);
    assert.equal(pendingFileExists(workspaceRoot, repositoryDecisionPath(oldPath)), false);
    assert.equal(pendingFileExists(workspaceRoot, repositoryDecisionPath(addedPath)), true);
    assert.equal(pendingFileExists(workspaceRoot, repositoryDecisionPath(newPath)), true);

    const pendingIndex = await readPendingIndex(workspaceRoot);
    assert.deepEqual(
      pendingIndex.entries.map((entry) => entry.id),
      [pathA, addedPath, newPath].sort()
    );
    await assertPendingSourceRevision(
      workspaceRoot,
      pendingIndex,
      [pathA, addedPath, newPath]
    );
  })
);

test("stage bootstraps the first pending decision collection", () => (
  withTemporaryWorkspace("stage-first-collection", async (workspaceRoot) => {
    initializeGitRepository(workspaceRoot);
    await fs.writeFile(path.join(workspaceRoot, "README.md"), "baseline\n", "utf8");
    commitWorkspace(workspaceRoot);
    assert.notEqual(runGit(workspaceRoot, ["rev-parse", "--verify", "HEAD"]).trim(), "");
    assert.equal(runGit(workspaceRoot, [
      "ls-tree",
      "-r",
      "--name-only",
      "HEAD",
      "--",
      "docs/decisions"
    ]), "");

    await writeTestDomainCatalog(path.join(workspaceRoot, "docs", "decisions"));
    await writeDecision(workspaceRoot, pathA, decisionBody("采用首个决策集合"));
    assert.equal(await fileExists(path.join(workspaceRoot, indexRepositoryPath)), false);

    const staged = await runSourceCli([
      "stage",
      pathA,
      "--root",
      workspaceRoot
    ]);
    assert.equal(staged.exitCode, 0, staged.stderr);
    assert.deepEqual(pendingChangedPaths(workspaceRoot), [
      catalogRepositoryPath,
      indexRepositoryPath,
      repositoryDecisionPath(pathA)
    ]);
    const pendingIndex = await readPendingIndex(workspaceRoot);
    assert.deepEqual(pendingIndex.entries.map((entry) => entry.id), [pathA]);
    await assertPendingSourceRevision(workspaceRoot, pendingIndex, [pathA]);
    assert.equal(await fileExists(path.join(workspaceRoot, indexRepositoryPath)), false);
  })
));

test("stage rejects invalid duplicate and missing paths without changing pending", () => (
  withStageWorkspace("stage-invalid-input", {
    [pathA]: decisionBody("采用基线方案 A")
  }, async (workspaceRoot) => {
    await fs.writeFile(path.join(workspaceRoot, "README.md"), "pending\n", "utf8");
    runGit(workspaceRoot, ["add", "README.md"]);
    const pendingBefore = pendingIndexEntries(workspaceRoot);
    const inputs = [
      ["../outside.md"],
      [pathA, pathA],
      [`${domain}/use-missing.md`]
    ];
    for (const input of inputs) {
      const rejected = await runSourceCli([
        "stage",
        ...input,
        "--root",
        workspaceRoot
      ]);
      assert.equal(rejected.exitCode, 2, rejected.stderr);
      assert.equal(rejected.stdout, "");
      assert.match(rejected.stderr, /Decision records command failed/);
      assert.equal(pendingIndexEntries(workspaceRoot), pendingBefore);
    }
  })
));

test(
  "stage rejects invalid candidate domain and relationship targets before pending writes",
  async () => {
    const cases: Array<{
      label: string;
      prepare: (workspaceRoot: string) => Promise<string>;
    }> = [
      {
        label: "candidate",
        prepare: async (workspaceRoot) => {
          const candidatePath = `${domain}/use-candidate.md`;
          await writeDecision(
            workspaceRoot,
            candidatePath,
            candidateDecisionBody()
          );
          return candidatePath;
        }
      },
      {
        label: "unknown-domain",
        prepare: async (workspaceRoot) => {
          const unknownPath = "unknown-domain/use-unknown.md";
          const catalogPath = path.join(
            workspaceRoot,
            "docs",
            "decisions",
            "decision-domains.json"
          );
          await fs.writeFile(catalogPath, JSON.stringify({
            schemaVersion: 1,
            domains: [
              {
                id: domain,
                description: "维护长期决策的记录契约、生命周期、索引、查询与演进关系。"
              },
              {
                id: "unknown-domain",
                description: "维护只存在于当前磁盘目录表中的新增领域。"
              }
            ]
          }, null, 2) + "\n", "utf8");
          const filesystemCatalog = parseDecisionDomainCatalog(
            await fs.readFile(catalogPath, "utf8"),
            catalogRepositoryPath
          );
          assert.equal(filesystemCatalog.status, "ok");
          if (filesystemCatalog.status === "ok") {
            assert.equal(
              filesystemCatalog.value.domains.some(
                (entry) => entry.id === "unknown-domain"
              ),
              true
            );
          }
          const revisionCatalog = parseDecisionDomainCatalog(
            runGit(workspaceRoot, ["show", `HEAD:${catalogRepositoryPath}`]),
            catalogRepositoryPath
          );
          assert.equal(revisionCatalog.status, "ok");
          if (revisionCatalog.status === "ok") {
            assert.equal(
              revisionCatalog.value.domains.some(
                (entry) => entry.id === "unknown-domain"
              ),
              false
            );
          }
          await writeDecision(workspaceRoot, unknownPath, decisionBody("采用未知领域决策"));
          return unknownPath;
        }
      },
      {
        label: "unselected-relation",
        prepare: async (workspaceRoot) => {
          const unselectedPath = `${domain}/use-unselected-target.md`;
          await writeDecision(workspaceRoot, unselectedPath, decisionBody(
            "保留未选择关系目标",
            { status: "archived" }
          ));
          await writeDecision(workspaceRoot, pathA, decisionBody(
            "引用未选择关系目标",
            { relationTarget: unselectedPath }
          ));
          return pathA;
        }
      }
    ];

    for (const scenario of cases) {
      await withStageWorkspace(`stage-invalid-${scenario.label}`, {
        [pathA]: decisionBody("采用基线方案 A")
      }, async (workspaceRoot) => {
        const selectedPath = await scenario.prepare(workspaceRoot);
        const pendingBefore = pendingIndexEntries(workspaceRoot);
        const rejected = await runSourceCli([
          "stage",
          selectedPath,
          "--root",
          workspaceRoot
        ]);
        assert.equal(rejected.exitCode, 1, `${scenario.label}: ${rejected.stderr}`);
        assert.equal(rejected.stdout, "");
        assert.match(rejected.stderr, /Decision records command failed/);
        assert.equal(pendingIndexEntries(workspaceRoot), pendingBefore);
      });
    }
  }
);

test("stage reports unavailable version control without writing filesystem state", () => (
  withTemporaryWorkspace("stage-no-version-control", async (workspaceRoot) => {
    await writeTestDomainCatalog(path.join(workspaceRoot, "docs", "decisions"));
    await writeDecision(workspaceRoot, pathA, decisionBody("采用无仓库决策"));
    const before = await readFilesystemDecisionScope(workspaceRoot, [pathA]);

    const rejected = await runSourceCli([
      "stage",
      pathA,
      "--root",
      workspaceRoot
    ]);
    assert.equal(rejected.exitCode, 1);
    assert.equal(rejected.stdout, "");
    assert.match(rejected.stderr, /version-controlled decision workspace/);
    assert.deepEqual(await readFilesystemDecisionScope(workspaceRoot, [pathA]), before);
  })
));

test("help exposes stage independently without adding lifecycle stage options", () => {
  const program = createCliProgram(async () => 0, () => undefined);
  assert.match(program.helpInformation(), /stage <decision-path\.\.\.>/);

  for (const command of [
    "activate",
    "evolve",
    "archive",
    "mark-aligned",
    "discard"
  ]) {
    const commandNode = program.commands.find((entry) => entry.name() === command);
    assert.ok(commandNode, "Expected lifecycle command " + command);
    assert.doesNotMatch(commandNode.helpInformation(), /--stage/);
  }
});

async function withStageWorkspace(
  label: string,
  records: Readonly<Record<string, string>>,
  operation: (workspaceRoot: string) => Promise<void>
): Promise<void> {
  await withTemporaryWorkspace(label, async (workspaceRoot) => {
    initializeGitRepository(workspaceRoot);
    await fs.writeFile(path.join(workspaceRoot, "README.md"), "baseline\n", "utf8");
    await writeTestDomainCatalog(path.join(workspaceRoot, "docs", "decisions"));
    for (const [relativePath, body] of Object.entries(records)) {
      await writeDecision(workspaceRoot, relativePath, body);
    }
    await syncFilesystemIndex(workspaceRoot);
    commitWorkspace(workspaceRoot);
    await operation(workspaceRoot);
  });
}

async function syncFilesystemIndex(workspaceRoot: string): Promise<void> {
  const synchronized = await runSourceCli([
    "sync-index",
    "--write",
    "--root",
    workspaceRoot
  ]);
  assert.equal(synchronized.exitCode, 0, synchronized.stderr);
}

function decisionBody(
  title: string,
  options: {
    relationTarget?: string;
    status?: "active" | "archived";
  } = {}
): string {
  const status = options.status ?? "active";
  const relations = options.relationTarget === undefined
    ? ["relations: []"]
    : [
        "relations:",
        "  - type: 修订",
        "    target: " + options.relationTarget
      ];
  return [
    "---",
    "title: " + title,
    "status: " + status,
    "alignment: aligned",
    "createdAt: 2026-08-03T12:34:56Z",
    "purpose: 证明指定决策可以形成完整且一致的待提交集合。",
    "background: 并行磁盘变化不能直接共享一个不一致的聚合索引。",
    "decision: 只把显式路径叠加到已提交决策基线并重建索引。",
    ...relations,
    "---",
    "",
    "## 目的",
    "- 证明指定决策可以形成完整且一致的待提交集合。",
    "",
    "## 背景",
    "- 并行磁盘变化不能直接共享一个不一致的聚合索引。",
    "",
    "## 决策",
    "- 采用: 只把显式路径叠加到已提交决策基线并重建索引。",
    ""
  ].join("\n");
}

async function writeDecision(
  workspaceRoot: string,
  relativePath: string,
  body: string
): Promise<void> {
  const filePath = decisionPath(workspaceRoot, relativePath);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, body, "utf8");
}

function decisionPath(workspaceRoot: string, relativePath: string): string {
  return path.join(
    workspaceRoot,
    "docs",
    "decisions",
    ...relativePath.split("/")
  );
}

function repositoryDecisionPath(relativePath: string): string {
  return path.posix.join("docs/decisions", relativePath);
}

async function readFilesystemDecisionScope(
  workspaceRoot: string,
  decisionPaths: readonly string[]
): Promise<Record<string, string | null>> {
  const paths = [
    catalogRepositoryPath,
    indexRepositoryPath,
    ...decisionPaths.map(repositoryDecisionPath)
  ];
  return await readFiles(paths, async (filePath) => {
    try {
      return await fs.readFile(path.join(workspaceRoot, ...filePath.split("/")), "utf8");
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") {
        return null;
      }
      throw error;
    }
  });
}

async function assertPendingSourceRevision(
  workspaceRoot: string,
  index: DecisionIndex,
  relativePaths: readonly string[]
): Promise<void> {
  const catalogText = await readPendingText(workspaceRoot, catalogRepositoryPath);
  const catalog = parseDecisionDomainCatalog(catalogText, catalogRepositoryPath);
  if (catalog.status === "error") {
    assert.fail(catalog.errors.join("; "));
    return;
  }
  const sources = await Promise.all(relativePaths.map(async (relativePath) => ({
    path: relativePath,
    text: await readPendingText(
      workspaceRoot,
      repositoryDecisionPath(relativePath)
    )
  })));
  assert.equal(index.sourceRevision, decisionSourceRevision(catalog.value, sources));
}

async function readPendingIndex(workspaceRoot: string): Promise<DecisionIndex> {
  return JSON.parse(
    await readPendingText(workspaceRoot, indexRepositoryPath)
  ) as DecisionIndex;
}

function pendingChangedPaths(workspaceRoot: string): string[] {
  return runGit(workspaceRoot, [
    "diff",
    "--no-renames",
    "--cached",
    "--name-only",
    "--diff-filter=ACDMRTUXB"
  ]).trim().split(/\r?\n/u).filter((entry) => entry.length > 0).sort();
}

function pendingIndexEntries(workspaceRoot: string): string {
  return runGit(workspaceRoot, ["ls-files", "--stage"]);
}

function pendingFileExists(workspaceRoot: string, filePath: string): boolean {
  return spawnSync(
    "git",
    ["-C", workspaceRoot, "cat-file", "-e", `:${filePath}`],
    { windowsHide: true }
  ).status === 0;
}

function readPendingText(workspaceRoot: string, filePath: string): Promise<string> {
  return Promise.resolve(runGit(workspaceRoot, ["show", `:${filePath}`]));
}

async function readFiles(
  filePaths: readonly string[],
  read: (filePath: string) => Promise<string | null>
): Promise<Record<string, string | null>> {
  const entries = await Promise.all(filePaths.map(async (filePath) => (
    [filePath, await read(filePath)] as const
  )));
  return Object.fromEntries(entries);
}

function runGit(workspaceRoot: string, args: readonly string[]): string {
  return execFileSync("git", ["-C", workspaceRoot, ...args], {
    encoding: "utf8",
    windowsHide: true
  });
}

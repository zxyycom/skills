import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";
import {
  calculateSkillPackageSnapshotHash,
  collectSkillPackageFileSets,
  getSkillPackageVersionIssues,
  readPendingSkillPackageSnapshot,
  readSkillPackageSnapshotVersionBaseline,
  readSkillPackageSnapshotVersionBaselineFromRepository,
  readSkillPackageVersion,
  readSkillPackageVersionBaseline,
  type SkillPackageFile,
  type SkillPackageSnapshot
} from "./skill-package-hash.ts";
import type { SkillPackage } from "./project.ts";
import { VersionControlError } from "../../tools/shared/src/version-control/index.ts";
import { createGitRepositoryFixture } from "../../tools/shared/tests/git-fixture.ts";

const gitTestOptions = { timeout: 15_000 };
const gitFixtureRoot = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../tools/shared/tests/fixtures/git-repositories"
);
const fixtureRepositoryRoot = "/skill-package-fixture";

type RepositoryTemplate = Readonly<{
  parentDirectory: string;
  repositoryRoot: string;
}>;

type BaselineFiles = Readonly<Record<string, string | Buffer>>;

let pendingRepositoryTemplate: Promise<RepositoryTemplate> | null = null;

after(async () => {
  if (pendingRepositoryTemplate === null) {
    return;
  }
  const template = await pendingRepositoryTemplate;
  await fs.rm(template.parentDirectory, { force: true, recursive: true });
});

async function withTempRoot(
  run: (tempRoot: string) => Promise<void>
): Promise<void> {
  const tempRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "skill-package-hash-test-")
  );
  try {
    await run(tempRoot);
  } finally {
    await fs.rm(tempRoot, { force: true, recursive: true });
  }
}

async function createSkillRepositoryFixture(tempRoot: string) {
  const repositoryRoot = path.join(tempRoot, "repository");
  const alphaDirectory = path.join(repositoryRoot, "skills", "alpha");
  const betaDirectory = path.join(repositoryRoot, "skills", "beta");
  const gammaDirectory = path.join(repositoryRoot, "skills", "gamma");
  const alphaStaged = skillMarkdown("alpha", 3, "alpha staged");
  const betaCommitted = skillMarkdown("beta", 7, "beta committed");

  await fs.cp(await pendingRepositoryTemplateRoot(), repositoryRoot, {
    recursive: true
  });
  await fs.mkdir(path.join(alphaDirectory, "nested"), { recursive: true });

  const stagedBinary = Buffer.from([0x00, 0x01, 0xfe, 0xff]);
  await fs.writeFile(path.join(alphaDirectory, "SKILL.md"), alphaStaged);
  await fs.writeFile(path.join(alphaDirectory, "binary.bin"), stagedBinary);
  await fs.writeFile(
    path.join(alphaDirectory, "nested", "file with space.txt"),
    "nested staged\n"
  );
  await fs.rm(path.join(alphaDirectory, "deleted.txt"));
  runGit(repositoryRoot, ["add", "-A"]);

  await fs.writeFile(
    path.join(alphaDirectory, "SKILL.md"),
    skillMarkdown("alpha", 3, "alpha working")
  );
  await fs.writeFile(
    path.join(alphaDirectory, "binary.bin"),
    Buffer.from([0xaa, 0xbb])
  );
  await fs.writeFile(
    path.join(betaDirectory, "SKILL.md"),
    skillMarkdown("beta", 8, "beta working")
  );
  await fs.writeFile(
    path.join(alphaDirectory, "untracked.txt"),
    "not staged\n"
  );

  const skills: SkillPackage[] = [
    { directory: betaDirectory, name: "beta" },
    { directory: alphaDirectory, name: "alpha" }
  ];
  return {
    alphaDirectory,
    alphaStaged,
    betaCommitted,
    gammaDirectory,
    repositoryRoot,
    skills,
    stagedBinary
  };
}

test(
  "collects sorted skill files from pending Git content",
  gitTestOptions,
  async () => {
    await withTempRoot(async (tempRoot) => {
      const { alphaStaged, betaCommitted, skills, stagedBinary } =
        await createSkillRepositoryFixture(tempRoot);
      const filesBySkill = await collectSkillPackageFileSets(skills);
      const alphaFiles = filesBySkill.get("alpha") ?? [];
      const betaFiles = filesBySkill.get("beta") ?? [];

      assert.deepEqual(
        alphaFiles.map((file) => file.path),
        sortedPaths(["SKILL.md", "binary.bin", "nested/file with space.txt"])
      );
      assert.equal(
        fileData(alphaFiles, "SKILL.md").toString("utf8"),
        alphaStaged
      );
      assert.deepEqual(fileData(alphaFiles, "binary.bin"), stagedBinary);
      assert.equal(
        fileData(alphaFiles, "nested/file with space.txt").toString("utf8"),
        "nested staged\n"
      );
      assert.equal(
        alphaFiles.some((file) => file.path === "deleted.txt"),
        false
      );
      assert.equal(
        alphaFiles.some((file) => file.path === "untracked.txt"),
        false
      );
      assert.equal(readSkillPackageVersion("alpha", alphaFiles), 3);

      assert.deepEqual(
        betaFiles.map((file) => file.path),
        ["SKILL.md"]
      );
      assert.equal(
        fileData(betaFiles, "SKILL.md").toString("utf8"),
        betaCommitted
      );
      assert.equal(readSkillPackageVersion("beta", betaFiles), 7);
      assert.equal((await collectSkillPackageFileSets([])).size, 0);
    });
  }
);

test(
  "discovers skill membership from the same pending snapshot as its files",
  gitTestOptions,
  async () => {
    await withTempRoot(async (tempRoot) => {
      const { gammaDirectory, repositoryRoot } =
        await createSkillRepositoryFixture(tempRoot);
      const gammaMarkdown = skillMarkdown("gamma", 1, "gamma staged");
      await fs.mkdir(gammaDirectory, { recursive: true });
      await fs.writeFile(path.join(gammaDirectory, "SKILL.md"), gammaMarkdown);
      runGit(repositoryRoot, ["add", "skills/gamma/SKILL.md"]);
      await fs.rm(gammaDirectory, { force: true, recursive: true });

      const untrackedDirectory = path.join(
        repositoryRoot,
        "skills",
        "untracked"
      );
      await fs.mkdir(untrackedDirectory, { recursive: true });
      await fs.writeFile(
        path.join(untrackedDirectory, "SKILL.md"),
        skillMarkdown("untracked", 1, "working tree only")
      );

      const snapshot = await readPendingSkillPackageSnapshot(repositoryRoot);
      assert.deepEqual(
        snapshot.skills.map((skill) => skill.name),
        ["alpha", "beta", "gamma"]
      );
      assert.deepEqual(
        [...snapshot.filesBySkill.keys()],
        ["alpha", "beta", "gamma"]
      );
      assert.equal(
        fileData(snapshot.filesBySkill.get("gamma") ?? [], "SKILL.md").toString(
          "utf8"
        ),
        gammaMarkdown
      );
      assert.deepEqual(calculateSkillPackageSnapshotHash(snapshot).versions, {
        alpha: 3,
        beta: 7,
        gamma: 1
      });
      const baseline = await readSkillPackageVersionBaseline(
        snapshot.skills,
        "HEAD",
        repositoryRoot
      );
      assert.equal(baseline.revision.length, 40);
      assert.deepEqual(baseline.skills, { alpha: 3, gamma: null });
    });
  }
);

test(
  "reports missing or malformed skill version baselines",
  gitTestOptions,
  async () => {
    await withTempRoot(async (tempRoot) => {
      const { repositoryRoot, skills } =
        await createSkillRepositoryFixture(tempRoot);
      await assert.rejects(
        readSkillPackageVersionBaseline(
          skills,
          "missing-baseline",
          repositoryRoot
        ),
        (error: unknown) =>
          error instanceof VersionControlError &&
          error.code === "revision-not-found" &&
          error.message.includes("missing-baseline")
      );
    });

    const snapshot = skillPackageSnapshot({
      "SKILL.md": skillMarkdown("alpha", 3, "current")
    });
    await assert.rejects(
      readSkillPackageSnapshotVersionBaselineFromRepository(
        snapshot,
        "baseline",
        createBaselineRepository({
          "skills/alpha/SKILL.md": "---\nmetadata:\n  version: malformed\n---\n"
        })
      ),
      (error: unknown) =>
        error instanceof Error &&
        error.message.includes("frontmatter metadata.version") &&
        error.message.includes(
          "must be a string containing one positive integer"
        )
    );
  }
);

test("requires changed skills to increase independent versions", async () => {
  const baselineFiles = alphaBaselineFiles();
  const unchangedVersion = skillPackageSnapshot({
    "SKILL.md": skillMarkdown("alpha", 3, "changed")
  });
  const baseline = await readBaseline(unchangedVersion, baselineFiles);
  assert.deepEqual(baseline.skills, { alpha: 3 });
  assert.match(
    getSkillPackageVersionIssues(
      calculateSkillPackageSnapshotHash(unchangedVersion),
      baseline
    )[0] ?? "",
    /increase skills\/alpha\/SKILL\.md metadata\.version above 3/
  );

  const incrementedVersion = skillPackageSnapshot({
    "SKILL.md": skillMarkdown("alpha", 4, "changed")
  });
  assert.deepEqual(
    getSkillPackageVersionIssues(
      calculateSkillPackageSnapshotHash(incrementedVersion),
      await readBaseline(incrementedVersion, baselineFiles)
    ),
    []
  );
});

test("does not require a version for linked source map edits, additions, or deletions", async () => {
  const baselineFiles = versionGateBaselineFiles();
  const base = skillPackageSnapshotFromBaseline(baselineFiles);
  const changedMap = replaceSnapshotFile(
    base,
    "scripts/cli.mjs.map",
    "edited source map\n"
  );
  assert.deepEqual(await versionIssues(changedMap, baselineFiles), []);

  const deletedMap = removeSnapshotFile(base, "scripts/cli.mjs.map");
  assert.deepEqual(await versionIssues(deletedMap, baselineFiles), []);

  const noMapBaseline = { ...baselineFiles };
  delete noMapBaseline["skills/alpha/scripts/cli.mjs.map"];
  const addedMap = replaceSnapshotFile(
    skillPackageSnapshotFromBaseline(noMapBaseline),
    "scripts/cli.mjs.map",
    "new source map\n"
  );
  assert.deepEqual(await versionIssues(addedMap, noMapBaseline), []);

  assert.equal(
    (
      await versionIssues(
        replaceSnapshotFile(base, "debug.mjs.map", "edited\n"),
        baselineFiles
      )
    ).length,
    1
  );
  assert.equal(
    (
      await versionIssues(
        replaceSnapshotFile(base, "scripts/template.mjs.map", "edited\n"),
        baselineFiles
      )
    ).length,
    1
  );
  assert.equal(
    (
      await versionIssues(
        replaceSnapshotFile(base, "scripts/fake.mjs.map", "edited\n"),
        baselineFiles
      )
    ).length,
    1
  );
});

test("requires a version for runtime and declaration semantic package changes", async () => {
  const baselineFiles = versionGateBaselineFiles();
  const base = skillPackageSnapshotFromBaseline(baselineFiles);
  assert.equal(
    (
      await versionIssues(
        replaceSnapshotFile(
          base,
          "scripts/cli.mjs",
          "export const v = 2;\n//# sourceMappingURL=cli.mjs.map\n"
        ),
        baselineFiles
      )
    ).length,
    1
  );
  assert.equal(
    (
      await versionIssues(
        replaceSnapshotFile(
          base,
          "api.d.mts",
          "export declare const value: number;\n"
        ),
        baselineFiles
      )
    ).length,
    1
  );
});

test("ignores declaration formatting but not declaration semantics for versioning", async () => {
  const baselineFiles = versionGateBaselineFiles();
  const base = skillPackageSnapshotFromBaseline(baselineFiles);
  assert.deepEqual(
    await versionIssues(
      replaceSnapshotFile(
        base,
        "api.d.mts",
        "export type Item = ( typeof values )[ number ];\n"
      ),
      baselineFiles
    ),
    []
  );
  assert.equal(
    (
      await versionIssues(
        replaceSnapshotFile(
          base,
          "api.d.mts",
          "export type Item = (typeof values)[number | string];\n"
        ),
        baselineFiles
      )
    ).length,
    1
  );
});

test("aggregate hashes retain raw source map and declaration bytes", () => {
  const baseSnapshot = skillPackageSnapshot({
    "api.d.mts": "export type Item = (typeof values)[number];\n",
    "scripts/cli.mjs":
      "export const value = 1;\n//# sourceMappingURL=cli.mjs.map\n",
    "scripts/cli.mjs.map": '{"version":3,"mappings":"AAAA"}\n',
    "SKILL.md": skillMarkdown("alpha", 3, "unchanged")
  });
  const changedMapSnapshot = replaceSnapshotFile(
    baseSnapshot,
    "scripts/cli.mjs.map",
    '{"version":3,"mappings":"AAAB"}\n'
  );
  const reformattedDeclarationSnapshot = replaceSnapshotFile(
    baseSnapshot,
    "api.d.mts",
    "export type Item = ( typeof values )[ number ];\n"
  );

  const baseHash =
    calculateSkillPackageSnapshotHash(baseSnapshot).aggregateHash;
  assert.notEqual(
    calculateSkillPackageSnapshotHash(changedMapSnapshot).aggregateHash,
    baseHash
  );
  assert.notEqual(
    calculateSkillPackageSnapshotHash(reformattedDeclarationSnapshot)
      .aggregateHash,
    baseHash
  );
});

test(
  "version checks retain the captured pending snapshot after the index resets",
  gitTestOptions,
  async () => {
    await withTempRoot(async (tempRoot) => {
      const { alphaDirectory, repositoryRoot } =
        await createSkillRepositoryFixture(tempRoot);
      runGit(repositoryRoot, ["reset", "--hard", "HEAD"]);
      await fs.writeFile(
        path.join(alphaDirectory, "SKILL.md"),
        skillMarkdown("alpha", 3, "captured content-only change")
      );
      runGit(repositoryRoot, ["add", "skills/alpha/SKILL.md"]);
      const snapshot = await readPendingSkillPackageSnapshot(repositoryRoot);

      runGit(repositoryRoot, ["reset", "--hard", "HEAD"]);

      const baseline = await readSkillPackageSnapshotVersionBaseline(
        snapshot,
        "HEAD",
        repositoryRoot
      );
      assert.deepEqual(baseline.skills, { alpha: 3 });
      assert.match(
        getSkillPackageVersionIssues(
          calculateSkillPackageSnapshotHash(snapshot),
          baseline
        )[0] ?? "",
        /increase skills\/alpha\/SKILL\.md metadata\.version above 3/
      );
    });
  }
);

test("version checks stop reading baseline blobs after the first ordinary change", async () => {
  const baselineFiles = {
    ...alphaBaselineFiles(),
    "skills/alpha/a-changed.txt": "base\n",
    "skills/alpha/z-unreadable.txt": "base\n"
  };
  const snapshot = skillPackageSnapshot({
    "SKILL.md": skillMarkdown("alpha", 3, "unchanged"),
    "a-changed.txt": "changed\n",
    "z-unreadable.txt": "base\n"
  });
  const readPaths: string[] = [];
  const repository = createBaselineRepository(baselineFiles, { readPaths });
  const baseline = await readSkillPackageSnapshotVersionBaselineFromRepository(
    snapshot,
    "baseline",
    repository
  );

  assert.deepEqual(baseline.skills, { alpha: 3 });
  assert.equal(readPaths.includes("skills/alpha/z-unreadable.txt"), false);
  assert.match(
    getSkillPackageVersionIssues(
      calculateSkillPackageSnapshotHash(snapshot),
      baseline
    )[0] ?? "",
    /increase skills\/alpha\/SKILL\.md metadata\.version above 3/
  );
});

test("accepts a new skill at initial version one", async () => {
  const snapshot: SkillPackageSnapshot = {
    filesBySkill: new Map([
      ["alpha", [skillFile("SKILL.md", skillMarkdown("alpha", 4, "changed"))]],
      ["gamma", [skillFile("SKILL.md", skillMarkdown("gamma", 1, "new"))]]
    ]),
    skills: [
      {
        directory: path.join(fixtureRepositoryRoot, "skills", "alpha"),
        name: "alpha"
      },
      {
        directory: path.join(fixtureRepositoryRoot, "skills", "gamma"),
        name: "gamma"
      }
    ]
  };
  const baseline = await readBaseline(snapshot, alphaBaselineFiles());
  assert.deepEqual(baseline.skills, { alpha: 3, gamma: null });
  assert.deepEqual(
    getSkillPackageVersionIssues(
      calculateSkillPackageSnapshotHash(snapshot),
      baseline
    ),
    []
  );
});

test(
  "reports corrupt baseline skill blobs as operation failures",
  gitTestOptions,
  async () => {
    await withTempRoot(async (tempRoot) => {
      const { alphaDirectory: skillDirectory, repositoryRoot } =
        await createSkillRepositoryFixture(tempRoot);
      runGit(repositoryRoot, ["reset", "--hard", "HEAD"]);
      await fs.writeFile(path.join(skillDirectory, "changed.txt"), "changed\n");
      await fs.writeFile(
        path.join(skillDirectory, "SKILL.md"),
        skillMarkdown("alpha", 3, "pending")
      );
      runGit(repositoryRoot, ["add", "skills/alpha/changed.txt"]);
      runGit(repositoryRoot, ["add", "skills/alpha/SKILL.md"]);

      const blobId = runGit(repositoryRoot, [
        "rev-parse",
        "HEAD:skills/alpha/SKILL.md"
      ]).trim();
      const blobPath = path.join(
        repositoryRoot,
        ".git",
        "objects",
        blobId.slice(0, 2),
        blobId.slice(2)
      );
      await fs.chmod(blobPath, 0o666);
      await fs.writeFile(blobPath, "corrupt Git object", "utf8");

      await assert.rejects(
        readSkillPackageVersionBaseline(
          [{ directory: skillDirectory, name: "alpha" }],
          "HEAD",
          repositoryRoot
        ),
        (error: unknown) =>
          error instanceof VersionControlError &&
          error.code === "operation-failed" &&
          error.message.includes("read skills/alpha/SKILL.md from revision")
      );
    });
  }
);

function skillMarkdown(name: string, version: number, body: string): string {
  return [
    "---",
    `name: ${name}`,
    `description: ${name} test skill`,
    "metadata:",
    `  version: "${version}"`,
    "---",
    "",
    body,
    ""
  ].join("\n");
}

function alphaBaselineFiles(): BaselineFiles {
  return {
    "skills/alpha/SKILL.md": skillMarkdown("alpha", 3, "unchanged")
  };
}

function versionGateBaselineFiles(): Record<string, string> {
  return {
    ...alphaBaselineFiles(),
    "skills/alpha/api.d.mts": "export type Item = (typeof values)[number];\n",
    "skills/alpha/debug.mjs":
      "export const debug = 1;\n//# sourceMappingURL=debug.mjs.map\n",
    "skills/alpha/debug.mjs.map": "initial debug source map\n",
    "skills/alpha/scripts/cli.mjs":
      "export const v = 1;\n//# sourceMappingURL=cli.mjs.map\n",
    "skills/alpha/scripts/cli.mjs.map": "initial source map\n",
    "skills/alpha/scripts/fake.mjs":
      'export const fake = "sourceMappingURL=fake.mjs.map";\n',
    "skills/alpha/scripts/fake.mjs.map":
      "initial pseudo-reference source map\n",
    "skills/alpha/scripts/template.mjs":
      "export const template = `\n//# sourceMappingURL=template.mjs.map\n`;\n",
    "skills/alpha/scripts/template.mjs.map":
      "initial template pseudo-reference source map\n"
  };
}

function skillPackageSnapshot(
  files: Readonly<Record<string, string>>
): SkillPackageSnapshot {
  return createSkillPackageSnapshot(
    Object.entries(files).map(([filePath, contents]) =>
      skillFile(filePath, contents)
    )
  );
}

function skillPackageSnapshotFromBaseline(
  files: BaselineFiles
): SkillPackageSnapshot {
  return createSkillPackageSnapshot(
    Object.entries(files).map(([filePath, contents]) =>
      skillFile(filePath.slice("skills/alpha/".length), contents)
    )
  );
}

function createSkillPackageSnapshot(
  files: SkillPackageFile[]
): SkillPackageSnapshot {
  return {
    filesBySkill: new Map([
      [
        "alpha",
        [...files].sort((left, right) => left.path.localeCompare(right.path))
      ]
    ]),
    skills: [
      {
        directory: path.join(fixtureRepositoryRoot, "skills", "alpha"),
        name: "alpha"
      }
    ]
  };
}

function replaceSnapshotFile(
  snapshot: SkillPackageSnapshot,
  filePath: string,
  contents: string
): SkillPackageSnapshot {
  const files = snapshot.filesBySkill.get("alpha") ?? [];
  return createSkillPackageSnapshot([
    ...files.filter((file) => file.path !== filePath),
    skillFile(filePath, contents)
  ]);
}

function removeSnapshotFile(
  snapshot: SkillPackageSnapshot,
  filePath: string
): SkillPackageSnapshot {
  return createSkillPackageSnapshot(
    (snapshot.filesBySkill.get("alpha") ?? []).filter(
      (file) => file.path !== filePath
    )
  );
}

function skillFile(
  filePath: string,
  contents: string | Buffer
): SkillPackageFile {
  return { data: Buffer.from(contents), path: filePath };
}

async function readBaseline(
  snapshot: SkillPackageSnapshot,
  files: BaselineFiles
) {
  return await readSkillPackageSnapshotVersionBaselineFromRepository(
    snapshot,
    "baseline",
    createBaselineRepository(files),
    process.cwd()
  );
}

async function versionIssues(
  snapshot: SkillPackageSnapshot,
  baselineFiles: BaselineFiles
): Promise<string[]> {
  return getSkillPackageVersionIssues(
    calculateSkillPackageSnapshotHash(snapshot),
    await readBaseline(snapshot, baselineFiles)
  );
}

function createBaselineRepository(
  files: BaselineFiles,
  options: { readPaths?: string[] } = {}
) {
  const contents = new Map(
    Object.entries(files).map(([filePath, data]) => [
      filePath,
      Buffer.from(data)
    ])
  );
  return {
    rootDirectory: fixtureRepositoryRoot,
    async resolveRevision(revision: string) {
      if (revision === "missing-baseline") {
        throw new VersionControlError(
          "revision-not-found",
          `Version-control revision could not be resolved: ${revision}`
        );
      }
      return "baseline-revision";
    },
    async listRevisionFiles() {
      return [...contents.keys()].sort((left, right) =>
        left.localeCompare(right)
      );
    },
    async readRevisionFile(_revision: string, filePath: string) {
      options.readPaths?.push(filePath);
      const data = contents.get(filePath);
      return data === undefined ? null : { data, path: filePath };
    }
  };
}

function fileData(
  files: readonly SkillPackageFile[],
  filePath: string
): Buffer {
  const file = files.find((candidate) => candidate.path === filePath);
  if (file === undefined) {
    throw new Error(`${filePath} should be present`);
  }
  return file.data;
}

function sortedPaths(paths: readonly string[]): string[] {
  return [...paths].sort((left, right) => left.localeCompare(right));
}

async function pendingRepositoryTemplateRoot(): Promise<string> {
  pendingRepositoryTemplate ??= createRepositoryTemplate(
    "skill-package-hash-pending"
  );
  try {
    return (await pendingRepositoryTemplate).repositoryRoot;
  } catch (error) {
    pendingRepositoryTemplate = null;
    throw error;
  }
}

async function createRepositoryTemplate(
  fixtureName: string
): Promise<RepositoryTemplate> {
  const parentDirectory = await fs.mkdtemp(
    path.join(os.tmpdir(), `skill-package-${fixtureName}-`)
  );
  try {
    const fixture = await createGitRepositoryFixture({
      fixtureRoot: path.join(gitFixtureRoot, fixtureName),
      parentDirectory,
      repositoryName: "repository",
      userEmail: "skill-package@example.invalid",
      userName: "Skill Package Test"
    });
    return { parentDirectory, repositoryRoot: fixture.repositoryRoot };
  } catch (error) {
    await fs.rm(parentDirectory, { force: true, recursive: true });
    throw error;
  }
}

function runGit(workingDirectory: string, args: readonly string[]): string {
  return execFileSync("git", ["-C", workingDirectory, ...args], {
    encoding: "utf8",
    windowsHide: true
  });
}

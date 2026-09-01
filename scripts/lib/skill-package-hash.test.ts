import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";
import {
  calculateSkillPackageHash,
  calculateSkillPackageSnapshotHash,
  collectSkillPackageFileSets,
  getSkillPackageVersionIssues,
  readPendingSkillPackageSnapshot,
  readSkillPackageSnapshotVersionBaseline,
  readSkillPackageVersionBaseline,
  readSkillPackageVersion,
  type SkillPackageFile
} from "./skill-package-hash.ts";
import type { SkillPackage } from "./project.ts";
import { VersionControlError } from "../../tools/shared/src/version-control/index.ts";
import { createGitRepositoryFixture } from "../../tools/shared/tests/git-fixture.ts";

const gitTestOptions = { timeout: 15_000 };
const gitFixtureRoot = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../tools/shared/tests/fixtures/git-repositories"
);

type RepositoryTemplate = Readonly<{
  parentDirectory: string;
  repositoryRoot: string;
}>;

let pendingRepositoryTemplate: Promise<RepositoryTemplate> | null = null;
let versionGateRepositoryTemplate: Promise<RepositoryTemplate> | null = null;

after(async () => {
  const templates = await Promise.allSettled(
    [pendingRepositoryTemplate, versionGateRepositoryTemplate].filter(
      (template): template is Promise<RepositoryTemplate> => template !== null
    )
  );
  await Promise.all(
    templates.flatMap((template) =>
      template.status === "fulfilled"
        ? [
            fs.rm(template.value.parentDirectory, {
              force: true,
              recursive: true
            })
          ]
        : []
    )
  );
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
  const alphaCommitted = skillMarkdown("alpha", 3, "alpha committed");
  const alphaStaged = skillMarkdown("alpha", 3, "alpha staged");
  const betaCommitted = skillMarkdown("beta", 7, "beta committed");

  await fs.cp(await pendingRepositoryTemplateRoot(), repositoryRoot, {
    recursive: true
  });
  await fs.mkdir(path.join(alphaDirectory, "nested"), { recursive: true });
  const malformedRevision = runGit(repositoryRoot, [
    "rev-parse",
    "HEAD"
  ]).trim();

  await fs.writeFile(path.join(alphaDirectory, "SKILL.md"), alphaCommitted);
  await fs.writeFile(path.join(alphaDirectory, "deleted.txt"), "delete me\n");
  runGit(repositoryRoot, ["add", "."]);
  runGit(repositoryRoot, ["commit", "--quiet", "--message", "base"]);

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
    malformedRevision,
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
      assert.deepEqual(
        (
          await readSkillPackageVersionBaseline(
            snapshot.skills,
            "HEAD",
            repositoryRoot
          )
        ).skills,
        { alpha: 3, gamma: null }
      );
    });
  }
);

test(
  "reports missing or malformed skill version baselines",
  gitTestOptions,
  async () => {
    await withTempRoot(async (tempRoot) => {
      const { malformedRevision, repositoryRoot, skills } =
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
      await assert.rejects(
        readSkillPackageVersionBaseline(
          skills,
          malformedRevision,
          repositoryRoot
        ),
        (error: unknown) =>
          error instanceof Error &&
          error.message.includes("frontmatter metadata.version") &&
          error.message.includes(
            "must be a string containing one positive integer"
          )
      );
    });
  }
);

test(
  "requires changed skills to increase independent versions",
  gitTestOptions,
  async () => {
    await withTempRoot(async (tempRoot) => {
      const { alphaDirectory, repositoryRoot, skills } =
        await createSkillRepositoryFixture(tempRoot);
      const baseline = await readSkillPackageVersionBaseline(
        skills,
        "HEAD",
        repositoryRoot
      );
      assert.equal(baseline.revision.length, 40);
      assert.deepEqual(baseline.skills, { alpha: 3 });
      assert.match(
        getSkillPackageVersionIssues(
          await calculateSkillPackageHash(skills),
          baseline
        )[0] ?? "",
        /increase skills\/alpha\/SKILL\.md metadata\.version above 3/
      );

      await fs.writeFile(
        path.join(alphaDirectory, "SKILL.md"),
        skillMarkdown("alpha", 4, "alpha staged")
      );
      runGit(repositoryRoot, ["add", "skills/alpha/SKILL.md"]);
      assert.deepEqual(
        getSkillPackageVersionIssues(
          await calculateSkillPackageHash(skills),
          baseline
        ),
        []
      );
    });
  }
);

test(
  "does not require a version for linked source map edits, additions, or deletions",
  gitTestOptions,
  async () => {
    await withTempRoot(async (tempRoot) => {
      const { repositoryRoot, skillDirectory, skills } =
        await createVersionGateRepositoryFixture(tempRoot);
      const mapPath = path.join(skillDirectory, "scripts", "cli.mjs.map");
      await fs.writeFile(mapPath, "edited source map\n");
      runGit(repositoryRoot, ["add", "skills/alpha/scripts/cli.mjs.map"]);
      assert.deepEqual(
        getSkillPackageVersionIssues(
          await calculateSkillPackageHash(skills),
          await readSkillPackageVersionBaseline(skills, "HEAD", repositoryRoot)
        ),
        []
      );

      await fs.rm(mapPath);
      runGit(repositoryRoot, ["add", "-A"]);
      assert.deepEqual(
        getSkillPackageVersionIssues(
          await calculateSkillPackageHash(skills),
          await readSkillPackageVersionBaseline(skills, "HEAD", repositoryRoot)
        ),
        []
      );

      await fs.writeFile(mapPath, "replacement source map\n");
      runGit(repositoryRoot, ["add", "skills/alpha/scripts/cli.mjs.map"]);
      assert.deepEqual(
        getSkillPackageVersionIssues(
          await calculateSkillPackageHash(skills),
          await readSkillPackageVersionBaseline(skills, "HEAD", repositoryRoot)
        ),
        []
      );

      const addedMapFixture = await createVersionGateRepositoryFixture(
        tempRoot,
        {
          fixtureName: "version-gate-no-source-map",
          includeCliSourceMap: false
        }
      );
      await fs.writeFile(
        path.join(addedMapFixture.skillDirectory, "scripts", "cli.mjs.map"),
        "new source map\n"
      );
      runGit(addedMapFixture.repositoryRoot, [
        "add",
        "skills/alpha/scripts/cli.mjs.map"
      ]);
      assert.deepEqual(
        getSkillPackageVersionIssues(
          await calculateSkillPackageHash(addedMapFixture.skills),
          await readSkillPackageVersionBaseline(
            addedMapFixture.skills,
            "HEAD",
            addedMapFixture.repositoryRoot
          )
        ),
        []
      );

      runGit(repositoryRoot, ["reset", "--hard", "HEAD"]);
      await fs.writeFile(
        path.join(skillDirectory, "debug.mjs.map"),
        "edited non-script source map\n"
      );
      runGit(repositoryRoot, ["add", "skills/alpha/debug.mjs.map"]);
      assert.equal(
        getSkillPackageVersionIssues(
          await calculateSkillPackageHash(skills),
          await readSkillPackageVersionBaseline(skills, "HEAD", repositoryRoot)
        ).length,
        1
      );

      runGit(repositoryRoot, ["reset", "--hard", "HEAD"]);
      await fs.writeFile(
        path.join(skillDirectory, "scripts", "template.mjs.map"),
        "edited template pseudo-reference source map\n"
      );
      runGit(repositoryRoot, ["add", "skills/alpha/scripts/template.mjs.map"]);
      assert.equal(
        getSkillPackageVersionIssues(
          await calculateSkillPackageHash(skills),
          await readSkillPackageVersionBaseline(skills, "HEAD", repositoryRoot)
        ).length,
        1
      );

      runGit(repositoryRoot, ["reset", "--hard", "HEAD"]);
      await fs.writeFile(
        path.join(skillDirectory, "scripts", "fake.mjs.map"),
        "edited pseudo-reference source map\n"
      );
      runGit(repositoryRoot, ["add", "skills/alpha/scripts/fake.mjs.map"]);
      assert.equal(
        getSkillPackageVersionIssues(
          await calculateSkillPackageHash(skills),
          await readSkillPackageVersionBaseline(skills, "HEAD", repositoryRoot)
        ).length,
        1
      );
    });
  }
);

test(
  "requires a version for runtime and declaration semantic package changes",
  gitTestOptions,
  async () => {
    await withTempRoot(async (tempRoot) => {
      const { repositoryRoot, skillDirectory, skills } =
        await createVersionGateRepositoryFixture(tempRoot);
      await fs.writeFile(
        path.join(skillDirectory, "scripts", "cli.mjs"),
        "export const v = 2;\n//# sourceMappingURL=cli.mjs.map\n"
      );
      runGit(repositoryRoot, ["add", "skills/alpha/scripts/cli.mjs"]);
      assert.equal(
        getSkillPackageVersionIssues(
          await calculateSkillPackageHash(skills),
          await readSkillPackageVersionBaseline(skills, "HEAD", repositoryRoot)
        ).length,
        1
      );

      runGit(repositoryRoot, ["reset", "--hard", "HEAD"]);
      await fs.writeFile(
        path.join(skillDirectory, "api.d.mts"),
        "export declare const value: number;\n"
      );
      runGit(repositoryRoot, ["add", "skills/alpha/api.d.mts"]);
      assert.equal(
        getSkillPackageVersionIssues(
          await calculateSkillPackageHash(skills),
          await readSkillPackageVersionBaseline(skills, "HEAD", repositoryRoot)
        ).length,
        1
      );
    });
  }
);

test(
  "ignores declaration formatting but not declaration semantics for versioning",
  gitTestOptions,
  async () => {
    await withTempRoot(async (tempRoot) => {
      const { repositoryRoot, skillDirectory, skills } =
        await createVersionGateRepositoryFixture(tempRoot);
      const declarationPath = path.join(skillDirectory, "api.d.mts");
      await fs.writeFile(
        declarationPath,
        "export type Item = ( typeof values )[ number ];\n"
      );
      runGit(repositoryRoot, ["add", "skills/alpha/api.d.mts"]);
      assert.deepEqual(
        getSkillPackageVersionIssues(
          await calculateSkillPackageHash(skills),
          await readSkillPackageVersionBaseline(skills, "HEAD", repositoryRoot)
        ),
        []
      );

      await fs.writeFile(
        declarationPath,
        "export type Item = (typeof values)[number | string];\n"
      );
      runGit(repositoryRoot, ["add", "skills/alpha/api.d.mts"]);
      assert.equal(
        getSkillPackageVersionIssues(
          await calculateSkillPackageHash(skills),
          await readSkillPackageVersionBaseline(skills, "HEAD", repositoryRoot)
        ).length,
        1
      );
    });
  }
);

test("aggregate hashes retain raw source map and declaration bytes", () => {
  const baseSnapshot = skillPackageSnapshot({
    "api.d.mts": "export type Item = (typeof values)[number];\n",
    "scripts/cli.mjs":
      "export const value = 1;\n//# sourceMappingURL=cli.mjs.map\n",
    "scripts/cli.mjs.map": '{"version":3,"mappings":"AAAA"}\n',
    "SKILL.md": skillMarkdown("alpha", 3, "unchanged")
  });
  const changedMapSnapshot = skillPackageSnapshot({
    "api.d.mts": "export type Item = (typeof values)[number];\n",
    "scripts/cli.mjs":
      "export const value = 1;\n//# sourceMappingURL=cli.mjs.map\n",
    "scripts/cli.mjs.map": '{"version":3,"mappings":"AAAB"}\n',
    "SKILL.md": skillMarkdown("alpha", 3, "unchanged")
  });
  const reformattedDeclarationSnapshot = skillPackageSnapshot({
    "api.d.mts": "export type Item = ( typeof values )[ number ];\n",
    "scripts/cli.mjs":
      "export const value = 1;\n//# sourceMappingURL=cli.mjs.map\n",
    "scripts/cli.mjs.map": '{"version":3,"mappings":"AAAA"}\n',
    "SKILL.md": skillMarkdown("alpha", 3, "unchanged")
  });

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

test(
  "version checks stop reading baseline blobs after the first ordinary change",
  gitTestOptions,
  async () => {
    await withTempRoot(async (tempRoot) => {
      const { repositoryRoot, skillDirectory } =
        await createVersionGateRepositoryFixture(tempRoot);
      await fs.writeFile(
        path.join(skillDirectory, "z-unreadable.txt"),
        "base\n"
      );
      runGit(repositoryRoot, ["add", "skills/alpha/z-unreadable.txt"]);
      runGit(repositoryRoot, ["commit", "--quiet", "--message", "extra blob"]);
      await fs.writeFile(
        path.join(skillDirectory, "a-changed.txt"),
        "changed\n"
      );
      runGit(repositoryRoot, ["add", "skills/alpha/a-changed.txt"]);
      const snapshot = await readPendingSkillPackageSnapshot(repositoryRoot);

      const blobId = runGit(repositoryRoot, [
        "rev-parse",
        "HEAD:skills/alpha/z-unreadable.txt"
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

test("accepts a new skill at initial version one", gitTestOptions, async () => {
  await withTempRoot(async (tempRoot) => {
    const { alphaDirectory, gammaDirectory, repositoryRoot, skills } =
      await createSkillRepositoryFixture(tempRoot);
    await fs.writeFile(
      path.join(alphaDirectory, "SKILL.md"),
      skillMarkdown("alpha", 4, "alpha staged")
    );
    runGit(repositoryRoot, ["add", "skills/alpha/SKILL.md"]);
    await fs.mkdir(gammaDirectory, { recursive: true });
    await fs.writeFile(
      path.join(gammaDirectory, "SKILL.md"),
      skillMarkdown("gamma", 1, "gamma staged")
    );
    runGit(repositoryRoot, ["add", "skills/gamma/SKILL.md"]);
    const skillsWithNewSkill = [
      ...skills,
      { directory: gammaDirectory, name: "gamma" }
    ];
    const baseline = await readSkillPackageVersionBaseline(
      skillsWithNewSkill,
      "HEAD",
      repositoryRoot
    );
    assert.deepEqual(baseline.skills, {
      alpha: 3,
      gamma: null
    });
    assert.deepEqual(
      getSkillPackageVersionIssues(
        await calculateSkillPackageHash(skillsWithNewSkill),
        baseline
      ),
      []
    );
  });
});

test(
  "reports corrupt baseline skill blobs as operation failures",
  gitTestOptions,
  async () => {
    await withTempRoot(async (tempRoot) => {
      const repositoryRoot = path.join(tempRoot, "unreadable-repository");
      const skillDirectory = path.join(repositoryRoot, "skills", "unreadable");
      await fs.mkdir(skillDirectory, { recursive: true });
      initializeRepository(repositoryRoot);
      await fs.writeFile(
        path.join(skillDirectory, "SKILL.md"),
        skillMarkdown("unreadable", 1, "committed")
      );
      runGit(repositoryRoot, ["add", "."]);
      runGit(repositoryRoot, ["commit", "--quiet", "--message", "base"]);
      await fs.writeFile(path.join(skillDirectory, "changed.txt"), "changed\n");
      await fs.writeFile(
        path.join(skillDirectory, "SKILL.md"),
        skillMarkdown("unreadable", 1, "pending")
      );
      runGit(repositoryRoot, ["add", "skills/unreadable/changed.txt"]);
      runGit(repositoryRoot, ["add", "skills/unreadable/SKILL.md"]);

      const blobId = runGit(repositoryRoot, [
        "rev-parse",
        "HEAD:skills/unreadable/SKILL.md"
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
          [{ directory: skillDirectory, name: "unreadable" }],
          "HEAD",
          repositoryRoot
        ),
        (error: unknown) =>
          error instanceof VersionControlError &&
          error.code === "operation-failed" &&
          error.message.includes(
            "read skills/unreadable/SKILL.md from revision"
          )
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

async function createVersionGateRepositoryFixture(
  tempRoot: string,
  options: {
    fixtureName?: string;
    includeCliSourceMap?: boolean;
  } = {}
): Promise<{
  repositoryRoot: string;
  skillDirectory: string;
  skills: SkillPackage[];
}> {
  const repositoryRoot = path.join(
    tempRoot,
    options.fixtureName ?? "version-gate-repository"
  );
  const skillDirectory = path.join(repositoryRoot, "skills", "alpha");
  await fs.cp(await versionGateRepositoryTemplateRoot(), repositoryRoot, {
    recursive: true
  });
  if (options.includeCliSourceMap === false) {
    await fs.rm(path.join(skillDirectory, "scripts", "cli.mjs.map"));
    runGit(repositoryRoot, ["rm", "skills/alpha/scripts/cli.mjs.map"]);
    runGit(repositoryRoot, [
      "commit",
      "--quiet",
      "--message",
      "remove source map"
    ]);
  }

  return {
    repositoryRoot,
    skillDirectory,
    skills: [{ directory: skillDirectory, name: "alpha" }]
  };
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

async function versionGateRepositoryTemplateRoot(): Promise<string> {
  versionGateRepositoryTemplate ??= createRepositoryTemplate(
    "skill-package-version-gate"
  );
  try {
    return (await versionGateRepositoryTemplate).repositoryRoot;
  } catch (error) {
    versionGateRepositoryTemplate = null;
    throw error;
  }
}

async function createRepositoryTemplate(
  fixtureName: string
): Promise<RepositoryTemplate> {
  const parent = await fs.mkdtemp(
    path.join(os.tmpdir(), `skill-package-${fixtureName}-`)
  );
  try {
    const fixture = await createGitRepositoryFixture({
      fixtureRoot: path.join(gitFixtureRoot, fixtureName),
      parentDirectory: parent,
      repositoryName: "repository",
      userEmail: "skill-package@example.invalid",
      userName: "Skill Package Test"
    });
    return { parentDirectory: parent, repositoryRoot: fixture.repositoryRoot };
  } catch (error) {
    await fs.rm(parent, { force: true, recursive: true });
    throw error;
  }
}

function skillPackageSnapshot(
  files: Readonly<Record<string, string>>
): ReturnType<typeof createSkillPackageSnapshot> {
  return createSkillPackageSnapshot(
    Object.entries(files).map(([filePath, contents]) => ({
      data: Buffer.from(contents),
      path: filePath
    }))
  );
}

function createSkillPackageSnapshot(files: SkillPackageFile[]) {
  return {
    filesBySkill: new Map([["alpha", files]]),
    skills: [
      {
        directory: path.join("/unused", "alpha"),
        name: "alpha"
      }
    ]
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

function initializeRepository(repositoryRoot: string): void {
  runGit(repositoryRoot, ["init", "--quiet"]);
  runGit(repositoryRoot, ["config", "core.autocrlf", "false"]);
  runGit(repositoryRoot, [
    "config",
    "user.email",
    "skill-package@example.invalid"
  ]);
  runGit(repositoryRoot, ["config", "user.name", "Skill Package Test"]);
}

function runGit(workingDirectory: string, args: readonly string[]): string {
  return execFileSync("git", ["-C", workingDirectory, ...args], {
    encoding: "utf8",
    windowsHide: true
  });
}

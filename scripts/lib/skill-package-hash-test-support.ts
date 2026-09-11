import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after } from "node:test";
import { fileURLToPath } from "node:url";
import {
  calculateSkillPackageSnapshotHash,
  getSkillPackageVersionIssues,
  readSkillPackageSnapshotVersionBaselineFromRepository,
  type SkillPackageFile,
  type SkillPackageSnapshot
} from "./skill-package-hash.ts";
import type { SkillPackage } from "./project.ts";
import { VersionControlError } from "../../tools/shared/src/version-control/index.ts";
import { createGitRepositoryFixture } from "../../tools/shared/tests/git-fixture.ts";

export const gitTestOptions = { timeout: 15_000 };
const gitFixtureRoot = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../tools/shared/tests/fixtures/git-repositories"
);
export const fixtureRepositoryRoot = "/skill-package-fixture";

type RepositoryTemplate = Readonly<{
  parentDirectory: string;
  repositoryRoot: string;
}>;

export type BaselineFiles = Readonly<Record<string, string | Buffer>>;

let pendingRepositoryTemplate: Promise<RepositoryTemplate> | null = null;

after(async () => {
  if (pendingRepositoryTemplate === null) {
    return;
  }
  const template = await pendingRepositoryTemplate;
  await fs.rm(template.parentDirectory, { force: true, recursive: true });
});

export async function withTempRoot(
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

export async function createSkillRepositoryFixture(tempRoot: string) {
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

export function skillMarkdown(
  name: string,
  version: number,
  body: string
): string {
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

export function alphaBaselineFiles(): BaselineFiles {
  return {
    "skills/alpha/SKILL.md": skillMarkdown("alpha", 3, "unchanged")
  };
}

export function versionGateBaselineFiles(): Record<string, string> {
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

export function skillPackageSnapshot(
  files: Readonly<Record<string, string>>
): SkillPackageSnapshot {
  return createSkillPackageSnapshot(
    Object.entries(files).map(([filePath, contents]) =>
      skillFile(filePath, contents)
    )
  );
}

export function skillPackageSnapshotFromBaseline(
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

export function replaceSnapshotFile(
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

export function removeSnapshotFile(
  snapshot: SkillPackageSnapshot,
  filePath: string
): SkillPackageSnapshot {
  return createSkillPackageSnapshot(
    (snapshot.filesBySkill.get("alpha") ?? []).filter(
      (file) => file.path !== filePath
    )
  );
}

export function skillFile(
  filePath: string,
  contents: string | Buffer
): SkillPackageFile {
  return { data: Buffer.from(contents), path: filePath };
}

export async function readBaseline(
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

export async function versionIssues(
  snapshot: SkillPackageSnapshot,
  baselineFiles: BaselineFiles
): Promise<string[]> {
  return getSkillPackageVersionIssues(
    calculateSkillPackageSnapshotHash(snapshot),
    await readBaseline(snapshot, baselineFiles)
  );
}

export function createBaselineRepository(
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
        throw new VersionControlError({
          causeCategory: "revision-unavailable",
          code: "revision-not-found",
          operation: "resolve a revision",
          target: "missing-baseline"
        });
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

export function fileData(
  files: readonly SkillPackageFile[],
  filePath: string
): Buffer {
  const file = files.find((candidate) => candidate.path === filePath);
  if (file === undefined) {
    throw new Error(`${filePath} should be present`);
  }
  return file.data;
}

export function sortedPaths(paths: readonly string[]): string[] {
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

export function runGit(
  workingDirectory: string,
  args: readonly string[]
): string {
  return execFileSync("git", ["-C", workingDirectory, ...args], {
    encoding: "utf8",
    windowsHide: true
  });
}

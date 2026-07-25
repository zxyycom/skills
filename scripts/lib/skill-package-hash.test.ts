import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  calculateSkillPackageHash,
  collectSkillPackageFileSets,
  getSkillPackageVersionIssues,
  readSkillPackageVersionBaseline,
  readSkillPackageVersion,
  type SkillPackageFile
} from "./skill-package-hash.ts";
import type { SkillPackage } from "./project.ts";
import { VersionControlError } from "../../tools/shared/src/version-control/index.ts";

const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "skill-package-hash-test-"));
const repositoryRoot = path.join(tempRoot, "repository");
const unreadableRepositoryRoot = path.join(tempRoot, "unreadable-repository");
const alphaDirectory = path.join(repositoryRoot, "skills", "alpha");
const betaDirectory = path.join(repositoryRoot, "skills", "beta");
const gammaDirectory = path.join(repositoryRoot, "skills", "gamma");
const alphaCommitted = skillMarkdown("alpha", 3, "alpha committed");
const alphaStaged = skillMarkdown("alpha", 3, "alpha staged");
const alphaMalformed = alphaCommitted.replace(
  '  version: "3"',
  "  version: malformed"
);
const betaCommitted = skillMarkdown("beta", 7, "beta committed");

try {
  await fs.mkdir(path.join(alphaDirectory, "nested"), { recursive: true });
  await fs.mkdir(betaDirectory, { recursive: true });
  runGit(repositoryRoot, ["init", "--quiet"]);
  runGit(repositoryRoot, ["config", "core.autocrlf", "false"]);
  runGit(repositoryRoot, ["config", "user.email", "skill-package@example.invalid"]);
  runGit(repositoryRoot, ["config", "user.name", "Skill Package Test"]);

  await fs.writeFile(path.join(alphaDirectory, "SKILL.md"), alphaMalformed);
  await fs.writeFile(path.join(betaDirectory, "SKILL.md"), betaCommitted);
  runGit(repositoryRoot, ["add", "."]);
  runGit(repositoryRoot, ["commit", "--quiet", "--message", "malformed baseline"]);
  const malformedRevision = runGit(repositoryRoot, ["rev-parse", "HEAD"]).trim();

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
  await fs.writeFile(path.join(alphaDirectory, "untracked.txt"), "not staged\n");

  const skills: SkillPackage[] = [
    { directory: betaDirectory, name: "beta" },
    { directory: alphaDirectory, name: "alpha" }
  ];
  const filesBySkill = await collectSkillPackageFileSets(skills);
  const alphaFiles = filesBySkill.get("alpha") ?? [];
  const betaFiles = filesBySkill.get("beta") ?? [];

  assert.deepEqual(
    alphaFiles.map((file) => file.path),
    sortedPaths(["SKILL.md", "binary.bin", "nested/file with space.txt"])
  );
  assert.equal(fileData(alphaFiles, "SKILL.md").toString("utf8"), alphaStaged);
  assert.deepEqual(fileData(alphaFiles, "binary.bin"), stagedBinary);
  assert.equal(
    fileData(alphaFiles, "nested/file with space.txt").toString("utf8"),
    "nested staged\n"
  );
  assert.equal(alphaFiles.some((file) => file.path === "deleted.txt"), false);
  assert.equal(alphaFiles.some((file) => file.path === "untracked.txt"), false);
  assert.equal(readSkillPackageVersion("alpha", alphaFiles), 3);

  assert.deepEqual(betaFiles.map((file) => file.path), ["SKILL.md"]);
  assert.equal(fileData(betaFiles, "SKILL.md").toString("utf8"), betaCommitted);
  assert.equal(readSkillPackageVersion("beta", betaFiles), 7);
  assert.equal((await collectSkillPackageFileSets([])).size, 0);

  await assert.rejects(
    readSkillPackageVersionBaseline(
      skills,
      "missing-baseline",
      repositoryRoot
    ),
    (error: unknown) => error instanceof VersionControlError
      && error.code === "revision-not-found"
      && error.message.includes("missing-baseline")
  );
  await assert.rejects(
    readSkillPackageVersionBaseline(
      skills,
      malformedRevision,
      repositoryRoot
    ),
    (error: unknown) => error instanceof Error
      && error.message.includes("frontmatter metadata.version")
      && error.message.includes("must be a string containing one positive integer")
  );

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
  const newSkillBaseline = await readSkillPackageVersionBaseline(
    skillsWithNewSkill,
    "HEAD",
    repositoryRoot
  );
  assert.deepEqual(newSkillBaseline.skills, {
    alpha: 3,
    gamma: null
  });
  assert.deepEqual(
    getSkillPackageVersionIssues(
      await calculateSkillPackageHash(skillsWithNewSkill),
      newSkillBaseline
    ),
    []
  );

  await assertUnreadableBaselineFails(unreadableRepositoryRoot);
} finally {
  await fs.rm(tempRoot, { force: true, recursive: true });
}

console.log("Skill package hash tests passed.");

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

function fileData(files: readonly SkillPackageFile[], filePath: string): Buffer {
  const file = files.find((candidate) => candidate.path === filePath);
  if (file === undefined) {
    throw new Error(`${filePath} should be present`);
  }
  return file.data;
}

function sortedPaths(paths: readonly string[]): string[] {
  return [...paths].sort((left, right) => left.localeCompare(right));
}

function runGit(workingDirectory: string, args: readonly string[]): string {
  return execFileSync(
    "git",
    ["-C", workingDirectory, ...args],
    { encoding: "utf8", windowsHide: true }
  );
}

async function assertUnreadableBaselineFails(
  workingDirectory: string
): Promise<void> {
  const skillDirectory = path.join(workingDirectory, "skills", "unreadable");
  await fs.mkdir(skillDirectory, { recursive: true });
  runGit(workingDirectory, ["init", "--quiet"]);
  runGit(workingDirectory, ["config", "core.autocrlf", "false"]);
  runGit(workingDirectory, ["config", "user.email", "skill-package@example.invalid"]);
  runGit(workingDirectory, ["config", "user.name", "Skill Package Test"]);
  await fs.writeFile(
    path.join(skillDirectory, "SKILL.md"),
    skillMarkdown("unreadable", 1, "committed")
  );
  runGit(workingDirectory, ["add", "."]);
  runGit(workingDirectory, ["commit", "--quiet", "--message", "base"]);
  await fs.writeFile(path.join(skillDirectory, "changed.txt"), "changed\n");
  runGit(workingDirectory, ["add", "skills/unreadable/changed.txt"]);

  const blobId = runGit(workingDirectory, [
    "rev-parse",
    "HEAD:skills/unreadable/SKILL.md"
  ]).trim();
  const blobPath = path.join(
    workingDirectory,
    ".git",
    "objects",
    blobId.slice(0, 2),
    blobId.slice(2)
  );
  await fs.chmod(blobPath, 0o666);
  await fs.writeFile(
    blobPath,
    "corrupt Git object",
    "utf8"
  );

  await assert.rejects(
    readSkillPackageVersionBaseline(
      [{ directory: skillDirectory, name: "unreadable" }],
      "HEAD",
      workingDirectory
    ),
    (error: unknown) => error instanceof VersionControlError
      && error.code === "operation-failed"
      && error.message.includes(
        "read skills/unreadable/SKILL.md from revision"
      )
  );
}

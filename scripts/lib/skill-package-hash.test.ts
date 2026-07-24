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

const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "skill-package-hash-test-"));
const repositoryRoot = path.join(tempRoot, "repository");
const alphaDirectory = path.join(repositoryRoot, "skills", "alpha");
const betaDirectory = path.join(repositoryRoot, "skills", "beta");
const alphaCommitted = skillMarkdown("alpha", 3, "alpha committed");
const alphaStaged = skillMarkdown("alpha", 3, "alpha staged");
const betaCommitted = skillMarkdown("beta", 7, "beta committed");

try {
  await fs.mkdir(path.join(alphaDirectory, "nested"), { recursive: true });
  await fs.mkdir(betaDirectory, { recursive: true });
  runGit(repositoryRoot, ["init", "--quiet"]);
  runGit(repositoryRoot, ["config", "core.autocrlf", "false"]);
  runGit(repositoryRoot, ["config", "user.email", "skill-package@example.invalid"]);
  runGit(repositoryRoot, ["config", "user.name", "Skill Package Test"]);

  await fs.writeFile(path.join(alphaDirectory, "SKILL.md"), alphaCommitted);
  await fs.writeFile(path.join(alphaDirectory, "deleted.txt"), "delete me\n");
  await fs.writeFile(path.join(betaDirectory, "SKILL.md"), betaCommitted);
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

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import {
  rootDir,
  toPosix,
  type SkillPackage
} from "./project.ts";

export const skillPackageHashFileName = "skill-package.hash";

export function getSkillPackageHashFilePath(workspaceRoot: string = rootDir): string {
  return path.join(workspaceRoot, skillPackageHashFileName);
}

type GitSkillTree = {
  repoRoot: string;
  treePath: string;
};

function readGitOutput(args: string[], cwd: string): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"]
  }).trim();
}

function readGitBlob(args: string[], cwd: string): Buffer {
  return execFileSync("git", args, {
    cwd,
    stdio: ["ignore", "pipe", "inherit"]
  });
}

function resolveGitSkillTree(skill: SkillPackage): GitSkillTree {
  const repoRoot = readGitOutput(["rev-parse", "--show-toplevel"], skill.directory);
  const treePath = toPosix(path.relative(repoRoot, skill.directory));
  return { repoRoot, treePath };
}

function collectGitSkillFiles(tree: GitSkillTree): string[] {
  const output = readGitOutput(["ls-tree", "-r", "--name-only", `HEAD:${tree.treePath}`], tree.repoRoot);
  return output.length === 0 ? [] : output.split(/\r?\n/).sort((a, b) => a.localeCompare(b));
}

function readGitSkillFile(tree: GitSkillTree, relativePath: string): Buffer {
  return readGitBlob(["show", `HEAD:${tree.treePath}/${relativePath}`], tree.repoRoot);
}

export async function calculateSkillPackageHash(skills: SkillPackage[]): Promise<string> {
  const hash = createHash("sha256");
  hash.update("skills-package-v1\0");

  for (const skill of skills) {
    hash.update(`skill\0${skill.name}\0`);
    const tree = resolveGitSkillTree(skill);
    const files = collectGitSkillFiles(tree);

    for (const relativePath of files) {
      const packagePath = `${skill.name}/${toPosix(relativePath)}`;
      const data = readGitSkillFile(tree, relativePath);
      hash.update(`file\0${packagePath}\0${data.byteLength}\0`);
      hash.update(data);
      hash.update("\0");
    }
  }

  return hash.digest("hex");
}

export async function readRecordedSkillPackageHash(workspaceRoot: string = rootDir): Promise<string | null> {
  try {
    const content = await fs.readFile(getSkillPackageHashFilePath(workspaceRoot), "utf8");
    const trimmed = content.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

export async function writeRecordedSkillPackageHash(
  hash: string,
  workspaceRoot: string = rootDir
): Promise<void> {
  await fs.writeFile(getSkillPackageHashFilePath(workspaceRoot), `${hash}\n`, "utf8");
}

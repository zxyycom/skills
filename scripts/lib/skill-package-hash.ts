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

type GitIndexFile = {
  objectId: string;
  relativePath: string;
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

function collectGitIndexSkillFiles(tree: GitSkillTree): GitIndexFile[] {
  const output = readGitBlob(["ls-files", "-s", "-z", "--", tree.treePath], tree.repoRoot).toString("utf8");
  if (output.length === 0) {
    return [];
  }

  return output
    .split("\0")
    .filter((line) => line.length > 0)
    .map((line) => {
      const match = line.match(/^\d+\s+([a-f0-9]{40,64})\s+\d+\t(.+)$/);
      if (!match) {
        throw new Error(`Unexpected git ls-files output: ${line}`);
      }

      const repoPath = match[2];
      return {
        objectId: match[1],
        relativePath: repoPath.slice(`${tree.treePath}/`.length)
      };
    })
    .sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

function readGitIndexFile(tree: GitSkillTree, file: GitIndexFile): Buffer {
  return readGitBlob(["cat-file", "blob", file.objectId], tree.repoRoot);
}

export async function calculateSkillPackageHash(skills: SkillPackage[]): Promise<string> {
  const hash = createHash("sha256");
  hash.update("skills-package-v1\0");

  for (const skill of skills) {
    hash.update(`skill\0${skill.name}\0`);
    const tree = resolveGitSkillTree(skill);
    const files = collectGitIndexSkillFiles(tree);

    for (const file of files) {
      const packagePath = `${skill.name}/${toPosix(file.relativePath)}`;
      const data = readGitIndexFile(tree, file);
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

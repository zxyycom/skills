import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import {
  rootDir,
  toPosix,
  type SkillPackage
} from "./project.ts";

export const skillPackageLockFileName = "skill-package-lock.json";

export type SkillPackageHashes = {
  aggregateHash: string;
  skills: Record<string, string>;
};

export type SkillPackageLock = {
  aggregateHash: string;
  schemaVersion: 1;
  skills: Record<string, string>;
};

export function getSkillPackageLockFilePath(workspaceRoot: string = rootDir): string {
  return path.join(workspaceRoot, skillPackageLockFileName);
}

type GitSkillTree = {
  repoRoot: string;
  treePath: string;
};

type GitIndexFile = {
  objectId: string;
  relativePath: string;
};

type SkillFile = {
  data: Buffer;
  path: string;
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

function calculateSingleSkillPackageHash(skillName: string, files: SkillFile[]): string {
  const hash = createHash("sha256");
  hash.update(`skill-self-update-v1\0${skillName}\0`);

  for (const file of files) {
    hash.update(`file\0${file.path}\0${file.data.byteLength}\0`);
    hash.update(file.data);
    hash.update("\0");
  }

  return hash.digest("hex");
}

export async function calculateSkillPackageHashes(skills: SkillPackage[]): Promise<SkillPackageHashes> {
  const aggregate = createHash("sha256");
  aggregate.update("skills-package-v1\0");
  const skillHashes: Record<string, string> = {};

  for (const skill of skills) {
    aggregate.update(`skill\0${skill.name}\0`);
    const tree = resolveGitSkillTree(skill);
    const files = collectGitIndexSkillFiles(tree).map((file) => ({
      data: readGitIndexFile(tree, file),
      path: toPosix(file.relativePath)
    }));

    for (const file of files) {
      const packagePath = `${skill.name}/${file.path}`;
      aggregate.update(`file\0${packagePath}\0${file.data.byteLength}\0`);
      aggregate.update(file.data);
      aggregate.update("\0");
    }

    skillHashes[skill.name] = calculateSingleSkillPackageHash(skill.name, files);
  }

  return {
    aggregateHash: aggregate.digest("hex"),
    skills: skillHashes
  };
}

export function buildSkillPackageLock(hashes: SkillPackageHashes): SkillPackageLock {
  return {
    aggregateHash: hashes.aggregateHash,
    schemaVersion: 1,
    skills: Object.fromEntries(
      Object.entries(hashes.skills).sort(([left], [right]) => left.localeCompare(right))
    )
  };
}

export function stringifySkillPackageLock(lock: SkillPackageLock): string {
  return `${JSON.stringify(buildSkillPackageLock(lock), null, 2)}\n`;
}

export async function readRecordedSkillPackageLockText(workspaceRoot: string = rootDir): Promise<string | null> {
  try {
    return await fs.readFile(getSkillPackageLockFilePath(workspaceRoot), "utf8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

export async function readRecordedSkillPackageLock(workspaceRoot: string = rootDir): Promise<SkillPackageLock | null> {
  const text = await readRecordedSkillPackageLockText(workspaceRoot);
  if (text === null) {
    return null;
  }

  return JSON.parse(text) as SkillPackageLock;
}

export async function writeRecordedSkillPackageLock(
  lock: SkillPackageLock,
  workspaceRoot: string = rootDir
): Promise<void> {
  await fs.writeFile(getSkillPackageLockFilePath(workspaceRoot), stringifySkillPackageLock(lock), "utf8");
}

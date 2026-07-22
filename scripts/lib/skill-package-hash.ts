import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import {
  rootDir,
  type SkillPackage
} from "./project.ts";
import { toPosix } from "../../tools/shared/src/node/filesystem.ts";
import { calculateSkillPackageFingerprint } from "../../tools/skill-package/src/fingerprint.ts";
import {
  skillPackageLockFileName,
  validateSkillPackageLock,
  type SkillPackageLock
} from "../../tools/skill-package/src/lock.ts";

export {
  skillPackageLockFileName,
  type SkillPackageLock
} from "../../tools/skill-package/src/lock.ts";

export type SkillPackageHashes = {
  aggregateHash: string;
  skills: Record<string, string>;
};

export function getSkillPackageLockFilePath(workspaceRoot: string = rootDir): string {
  return path.join(workspaceRoot, skillPackageLockFileName);
}

type GitSkillTree = {
  repoRoot: string;
  skillName: string;
  treePath: string;
};

type GitIndexFile = {
  objectId: string;
  relativePath: string;
  skillName: string;
};

export type SkillPackageFile = {
  data: Buffer;
  path: string;
};

const gitOutputMaxBuffer = 16 * 1024 * 1024;
const gitBatchOutputMaxBuffer = 256 * 1024 * 1024;

function readGitOutput(args: string[], cwd: string): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    maxBuffer: gitOutputMaxBuffer,
    stdio: ["ignore", "pipe", "inherit"]
  }).trim();
}

function readGitBlob(args: string[], cwd: string): Buffer {
  return execFileSync("git", args, {
    cwd,
    maxBuffer: gitOutputMaxBuffer,
    stdio: ["ignore", "pipe", "inherit"]
  });
}

function resolveGitSkillTrees(skills: readonly SkillPackage[]): GitSkillTree[] {
  const firstSkill = skills[0];
  if (firstSkill === undefined) {
    return [];
  }

  const repoRoot = readGitOutput(["rev-parse", "--show-toplevel"], firstSkill.directory);
  return skills.map((skill) => {
    const relativePath = path.relative(repoRoot, skill.directory);
    if (
      relativePath === ""
      || relativePath === ".."
      || relativePath.startsWith(`..${path.sep}`)
      || path.isAbsolute(relativePath)
    ) {
      throw new Error(`${skill.directory} must be inside Git repository ${repoRoot}`);
    }

    return {
      repoRoot,
      skillName: skill.name,
      treePath: toPosix(relativePath)
    };
  });
}

function collectGitIndexSkillFiles(trees: readonly GitSkillTree[]): GitIndexFile[] {
  const firstTree = trees[0];
  if (firstTree === undefined) {
    return [];
  }

  const output = readGitBlob(
    ["ls-files", "-s", "-z", "--", ...trees.map((tree) => tree.treePath)],
    firstTree.repoRoot
  ).toString("utf8");
  if (output.length === 0) {
    return [];
  }

  const treesByLongestPath = [...trees].sort(
    (left, right) => right.treePath.length - left.treePath.length
  );
  return output
    .split("\0")
    .filter((line) => line.length > 0)
    .map((line) => {
      const separatorIndex = line.indexOf("\t");
      const metadata = separatorIndex === -1
        ? []
        : line.slice(0, separatorIndex).split(/\s+/u);
      if (
        metadata.length !== 3
        || !/^\d+$/u.test(metadata[0] ?? "")
        || !/^[a-f0-9]{40,64}$/u.test(metadata[1] ?? "")
        || !/^\d+$/u.test(metadata[2] ?? "")
      ) {
        throw new Error(`Unexpected git ls-files output: ${line}`);
      }

      const repoPath = line.slice(separatorIndex + 1);
      const tree = treesByLongestPath.find((candidate) =>
        repoPath.startsWith(`${candidate.treePath}/`)
      );
      if (tree === undefined) {
        throw new Error(`Git index path is outside discovered skills: ${repoPath}`);
      }

      return {
        objectId: metadata[1],
        relativePath: repoPath.slice(`${tree.treePath}/`.length),
        skillName: tree.skillName
      };
    })
    .sort((left, right) =>
      left.skillName.localeCompare(right.skillName)
      || left.relativePath.localeCompare(right.relativePath)
    );
}

function readGitIndexBlobs(
  repoRoot: string,
  objectIds: readonly string[]
): ReadonlyMap<string, Buffer> {
  const uniqueObjectIds = [...new Set(objectIds)];
  if (uniqueObjectIds.length === 0) {
    return new Map();
  }

  const output = execFileSync("git", ["cat-file", "--batch"], {
    cwd: repoRoot,
    input: `${uniqueObjectIds.join("\n")}\n`,
    maxBuffer: gitBatchOutputMaxBuffer,
    stdio: ["pipe", "pipe", "inherit"]
  });
  const blobs = new Map<string, Buffer>();
  let offset = 0;

  for (const expectedObjectId of uniqueObjectIds) {
    const headerEnd = output.indexOf(0x0a, offset);
    if (headerEnd === -1) {
      throw new Error(`Missing git cat-file header for ${expectedObjectId}`);
    }

    const header = output.subarray(offset, headerEnd).toString("utf8");
    const [objectId, objectType, sizeText, ...extraFields] = header.split(" ");
    const size = Number(sizeText);
    if (
      extraFields.length > 0
      || objectId !== expectedObjectId
      || objectType !== "blob"
      || !Number.isSafeInteger(size)
      || size < 0
    ) {
      throw new Error(`Unexpected git cat-file header: ${header}`);
    }

    const dataStart = headerEnd + 1;
    const dataEnd = dataStart + size;
    if (dataEnd >= output.length || output[dataEnd] !== 0x0a) {
      throw new Error(`Truncated git cat-file blob for ${expectedObjectId}`);
    }

    blobs.set(objectId, output.subarray(dataStart, dataEnd));
    offset = dataEnd + 1;
  }

  if (offset !== output.length) {
    throw new Error("Unexpected trailing output from git cat-file");
  }

  return blobs;
}

export async function collectSkillPackageFiles(skill: SkillPackage): Promise<SkillPackageFile[]> {
  return (await collectSkillPackageFileSets([skill])).get(skill.name) ?? [];
}

export async function collectSkillPackageFileSets(
  skills: readonly SkillPackage[]
): Promise<ReadonlyMap<string, SkillPackageFile[]>> {
  const trees = resolveGitSkillTrees(skills);
  const files = collectGitIndexSkillFiles(trees);
  const firstTree = trees[0];
  const blobs = firstTree === undefined
    ? new Map<string, Buffer>()
    : readGitIndexBlobs(
        firstTree.repoRoot,
        files.map((file) => file.objectId)
      );
  const filesBySkill = new Map<string, SkillPackageFile[]>(
    skills.map((skill) => [skill.name, []])
  );

  for (const file of files) {
    const data = blobs.get(file.objectId);
    if (data === undefined) {
      throw new Error(`Git blob ${file.objectId} was not returned by git cat-file`);
    }

    const skillFiles = filesBySkill.get(file.skillName);
    if (skillFiles === undefined) {
      throw new Error(`Git index returned unknown skill package ${file.skillName}`);
    }

    skillFiles.push({
      data,
      path: toPosix(file.relativePath)
    });
  }

  return filesBySkill;
}

export async function calculateSkillPackageHashes(skills: SkillPackage[]): Promise<SkillPackageHashes> {
  const aggregate = createHash("sha256");
  aggregate.update("skills-package-v1\0");
  const skillHashes: Record<string, string> = {};
  const filesBySkill = await collectSkillPackageFileSets(skills);

  for (const skill of skills) {
    aggregate.update(`skill\0${skill.name}\0`);
    const files = filesBySkill.get(skill.name) ?? [];

    for (const file of files) {
      const packagePath = `${skill.name}/${file.path}`;
      aggregate.update(`file\0${packagePath}\0${file.data.byteLength}\0`);
      aggregate.update(file.data);
      aggregate.update("\0");
    }

    skillHashes[skill.name] = calculateSkillPackageFingerprint(skill.name, files);
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

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error(
      `${skillPackageLockFileName} must contain valid JSON: `
      + (error instanceof Error ? error.message : String(error))
    );
  }

  const validation = validateSkillPackageLock(parsed);
  if (!validation.success) {
    throw new Error(
      `${skillPackageLockFileName} is invalid:\n- ${validation.issues.join("\n- ")}`
    );
  }

  return validation.output;
}

export async function writeRecordedSkillPackageLock(
  lock: SkillPackageLock,
  workspaceRoot: string = rootDir
): Promise<void> {
  await fs.writeFile(getSkillPackageLockFilePath(workspaceRoot), stringifySkillPackageLock(lock), "utf8");
}

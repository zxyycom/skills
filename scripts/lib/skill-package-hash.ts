import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {
  rootDir,
  type SkillPackage
} from "./project.ts";
import { toPosix } from "../../tools/shared/src/node/filesystem.ts";
import { openVersionControl } from "../../tools/shared/src/version-control/index.ts";
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

type SkillTree = {
  skillName: string;
  treePath: string;
};

export type SkillPackageFile = {
  data: Buffer;
  path: string;
};

function resolveSkillTrees(
  skills: readonly SkillPackage[],
  repositoryRoot: string
): SkillTree[] {
  return skills.map((skill) => {
    const relativePath = path.relative(repositoryRoot, skill.directory);
    if (
      relativePath === ""
      || relativePath === ".."
      || relativePath.startsWith(`..${path.sep}`)
      || path.isAbsolute(relativePath)
    ) {
      throw new Error(
        `${skill.directory} must be inside version-control repository ${repositoryRoot}`
      );
    }

    return {
      skillName: skill.name,
      treePath: toPosix(relativePath)
    };
  });
}

export async function collectSkillPackageFiles(skill: SkillPackage): Promise<SkillPackageFile[]> {
  return (await collectSkillPackageFileSets([skill])).get(skill.name) ?? [];
}

export async function collectSkillPackageFileSets(
  skills: readonly SkillPackage[]
): Promise<ReadonlyMap<string, SkillPackageFile[]>> {
  const filesBySkill = new Map<string, SkillPackageFile[]>(
    skills.map((skill) => [skill.name, []])
  );
  const firstSkill = skills[0];
  if (firstSkill === undefined) {
    return filesBySkill;
  }

  const repository = await openVersionControl(firstSkill.directory);
  const trees = resolveSkillTrees(skills, repository.rootDirectory);
  const treesByLongestPath = [...trees].sort(
    (left, right) => right.treePath.length - left.treePath.length
  );
  const files = await repository.readPendingFiles({
    pathScopes: trees.map((tree) => tree.treePath)
  });

  for (const file of files) {
    const tree = treesByLongestPath.find((candidate) =>
      file.path.startsWith(`${candidate.treePath}/`)
    );
    if (tree === undefined) {
      throw new Error(
        `Pending version-control path is outside discovered skills: ${file.path}`
      );
    }

    const skillFiles = filesBySkill.get(tree.skillName);
    if (skillFiles === undefined) {
      throw new Error(
        `Pending version-control snapshot returned unknown skill package ${tree.skillName}`
      );
    }

    skillFiles.push({
      data: Buffer.from(file.data),
      path: file.path.slice(`${tree.treePath}/`.length)
    });
  }
  for (const skillFiles of filesBySkill.values()) {
    skillFiles.sort((left, right) => left.path.localeCompare(right.path));
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

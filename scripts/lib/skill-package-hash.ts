import { createHash } from "node:crypto";
import path from "node:path";
import {
  rootDir,
  shouldIgnoreDirectoryName,
  skillsRootName,
  type SkillPackage
} from "./project.ts";
import {
  openVersionControl,
  type VersionControlFile
} from "../../tools/shared/src/version-control/index.ts";
import {
  readSkillVersionFromMarkdown,
  skillEntryFileName
} from "../../tools/skill-package/src/version.ts";
import {
  readSkillPackageSnapshotVersionBaseline,
  type SkillPackageVersionBaseline
} from "./skill-package-version-baseline.ts";
import {
  resolveRepositoryTreePath,
  resolveSkillTrees
} from "./skill-package-tree.ts";

export {
  readSkillPackageSnapshotVersionBaseline,
  readSkillPackageSnapshotVersionBaselineFromRepository,
  type SkillPackageVersionBaseline
} from "./skill-package-version-baseline.ts";

export type SkillPackageHash = {
  aggregateHash: string;
  versions: Record<string, number>;
};

export type SkillPackageFile = Readonly<{
  data: Buffer;
  path: string;
}>;

export type SkillPackageSnapshot = Readonly<{
  filesBySkill: ReadonlyMap<string, readonly SkillPackageFile[]>;
  skills: readonly SkillPackage[];
}>;

export function readSkillPackageVersion(
  skillName: string,
  files: readonly SkillPackageFile[]
): number {
  const skillEntry = files.find((file) => file.path === skillEntryFileName);
  if (skillEntry === undefined) {
    throw new Error(`${skillName}/${skillEntryFileName} is required`);
  }

  return readSkillVersionFromMarkdown(
    skillEntry.data.toString("utf8"),
    `${skillName}/${skillEntryFileName}`
  );
}

function resolvePendingSkillFile(
  file: VersionControlFile,
  skillsTreePath: string
): { file: SkillPackageFile; skillName: string } | null {
  if (file.path === skillsTreePath) {
    return null;
  }

  const prefix = `${skillsTreePath}/`;
  if (!file.path.startsWith(prefix)) {
    throw new Error(
      `Pending version-control path is outside the skills tree: ${file.path}`
    );
  }

  const packagePath = file.path.slice(prefix.length);
  const separatorIndex = packagePath.indexOf("/");
  if (separatorIndex <= 0) {
    return null;
  }

  const skillName = packagePath.slice(0, separatorIndex);
  if (shouldIgnoreDirectoryName(skillName)) {
    return null;
  }

  return {
    file: {
      data: Buffer.from(file.data),
      path: packagePath.slice(separatorIndex + 1)
    },
    skillName
  };
}

export async function readPendingSkillPackageSnapshot(
  workspaceRoot: string = rootDir
): Promise<SkillPackageSnapshot> {
  const repository = await openVersionControl(workspaceRoot);
  const skillsDirectory = path.join(workspaceRoot, skillsRootName);
  const skillsTreePath = resolveRepositoryTreePath(
    skillsDirectory,
    repository.rootDirectory
  );
  const files = await repository.readPendingFiles({
    pathScopes: [skillsTreePath]
  });
  const filesBySkill = new Map<string, SkillPackageFile[]>();

  for (const pendingFile of files) {
    const resolved = resolvePendingSkillFile(pendingFile, skillsTreePath);
    if (resolved === null) {
      continue;
    }

    const skillFiles = filesBySkill.get(resolved.skillName) ?? [];
    skillFiles.push(resolved.file);
    filesBySkill.set(resolved.skillName, skillFiles);
  }

  const errors: string[] = [];
  const skills = [...filesBySkill.keys()]
    .sort((left, right) => left.localeCompare(right))
    .map((skillName) => {
      const skillFiles = filesBySkill.get(skillName) ?? [];
      skillFiles.sort((left, right) => left.path.localeCompare(right.path));
      if (!skillFiles.some((file) => file.path === skillEntryFileName)) {
        errors.push(
          `${skillsTreePath}/${skillName} must contain ${skillEntryFileName}`
        );
      }

      return {
        directory: path.join(skillsDirectory, skillName),
        name: skillName
      };
    });

  if (skills.length === 0) {
    errors.push(
      `No skill packages discovered under ${skillsRootName}/ directories`
    );
  }
  if (errors.length > 0) {
    throw new Error(
      `Pending skill package snapshot is invalid:\n- ${errors.join("\n- ")}`
    );
  }

  return { filesBySkill, skills };
}

export async function collectSkillPackageFiles(
  skill: SkillPackage
): Promise<SkillPackageFile[]> {
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

function calculateSkillPackageHashFromFileSets(
  skills: readonly SkillPackage[],
  filesBySkill: ReadonlyMap<string, readonly SkillPackageFile[]>
): SkillPackageHash {
  const aggregate = createHash("sha256");
  aggregate.update("skills-package-v1\0");
  const versions: Record<string, number> = {};

  for (const skill of skills) {
    aggregate.update(`skill\0${skill.name}\0`);
    const files = filesBySkill.get(skill.name) ?? [];

    for (const file of files) {
      const packagePath = `${skill.name}/${file.path}`;
      aggregate.update(`file\0${packagePath}\0${file.data.byteLength}\0`);
      aggregate.update(file.data);
      aggregate.update("\0");
    }

    versions[skill.name] = readSkillPackageVersion(skill.name, files);
  }

  return {
    aggregateHash: aggregate.digest("hex"),
    versions
  };
}

export function calculateSkillPackageSnapshotHash(
  snapshot: SkillPackageSnapshot
): SkillPackageHash {
  return calculateSkillPackageHashFromFileSets(
    snapshot.skills,
    snapshot.filesBySkill
  );
}

export async function calculateSkillPackageHash(
  skills: SkillPackage[]
): Promise<SkillPackageHash> {
  return calculateSkillPackageHashFromFileSets(
    skills,
    await collectSkillPackageFileSets(skills)
  );
}

export function getSkillPackageVersionIssues(
  currentPackage: SkillPackageHash,
  baseline: SkillPackageVersionBaseline
): string[] {
  return Object.entries(baseline.skills).flatMap(
    ([skillName, baselineVersion]) => {
      const currentVersion = currentPackage.versions[skillName];
      if (
        baselineVersion === null ||
        currentVersion === undefined ||
        currentVersion > baselineVersion
      ) {
        return [];
      }

      return [
        `${skillName} package content changed at version ${currentVersion}; ` +
          `increase skills/${skillName}/${skillEntryFileName} ` +
          `metadata.version above ${baselineVersion}`
      ];
    }
  );
}

export async function readSkillPackageVersionBaseline(
  skills: readonly SkillPackage[],
  baselineRef: string = "HEAD",
  workspaceRoot: string = rootDir
): Promise<SkillPackageVersionBaseline> {
  return await readSkillPackageSnapshotVersionBaseline(
    {
      filesBySkill: await collectSkillPackageFileSets(skills),
      skills: [...skills]
    },
    baselineRef,
    workspaceRoot
  );
}

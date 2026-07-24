import { createHash } from "node:crypto";
import path from "node:path";
import { simpleGit } from "simple-git";
import {
  rootDir,
  type SkillPackage
} from "./project.ts";
import { toPosix } from "../../tools/shared/src/node/filesystem.ts";
import { openVersionControl } from "../../tools/shared/src/version-control/index.ts";
import {
  readOptionalSkillVersionFromMarkdown,
  readSkillVersionFromMarkdown,
  skillEntryFileName
} from "../../tools/skill-package/src/version.ts";

export type SkillPackageHash = {
  aggregateHash: string;
  versions: Record<string, number>;
};

export type SkillPackageVersionBaseline = {
  revision: string;
  skills: Record<string, number | null>;
};

type SkillTree = {
  skillName: string;
  treePath: string;
};

export type SkillPackageFile = {
  data: Buffer;
  path: string;
};

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

export async function calculateSkillPackageHash(skills: SkillPackage[]): Promise<SkillPackageHash> {
  const aggregate = createHash("sha256");
  aggregate.update("skills-package-v1\0");
  const versions: Record<string, number> = {};
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

    versions[skill.name] = readSkillPackageVersion(skill.name, files);
  }

  return {
    aggregateHash: aggregate.digest("hex"),
    versions
  };
}

export function getSkillPackageVersionIssues(
  currentPackage: SkillPackageHash,
  baseline: SkillPackageVersionBaseline
): string[] {
  return Object.entries(baseline.skills).flatMap(([skillName, baselineVersion]) => {
    const currentVersion = currentPackage.versions[skillName];
    if (
      baselineVersion === null
      || currentVersion === undefined
      || currentVersion > baselineVersion
    ) {
      return [];
    }

    return [
      `${skillName} package content changed at version ${currentVersion}; `
      + `increase skills/${skillName}/${skillEntryFileName} `
      + `metadata.version above ${baselineVersion}`
    ];
  });
}

export async function readSkillPackageVersionBaseline(
  skills: readonly SkillPackage[],
  baselineRef: string = "HEAD",
  workspaceRoot: string = rootDir
): Promise<SkillPackageVersionBaseline> {
  if (skills.length === 0) {
    return {
      revision: baselineRef,
      skills: {}
    };
  }

  const repository = await openVersionControl(workspaceRoot);
  const git = simpleGit({
    baseDir: repository.rootDirectory,
    maxConcurrentProcesses: 4,
    trimmed: false
  });
  let revision: string;
  try {
    revision = (await git.revparse([
      "--verify",
      "--quiet",
      "--end-of-options",
      `${baselineRef}^{commit}`
    ])).trim();
  } catch {
    throw new Error(`Skill version baseline could not be resolved: ${baselineRef}`);
  }

  const trees = resolveSkillTrees(skills, repository.rootDirectory);
  const changedOutput = await git.raw([
    "diff",
    "--cached",
    "--name-only",
    "--no-renames",
    "-z",
    revision,
    "--",
    ...trees.map((tree) => tree.treePath)
  ]);
  const changedPaths = changedOutput.split("\0").filter((candidate) => candidate.length > 0);
  const changedTrees = trees.filter((tree) =>
    changedPaths.some((changedPath) =>
      changedPath === tree.treePath
      || changedPath.startsWith(`${tree.treePath}/`)
    )
  );
  const baselineSkills: Record<string, number | null> = {};

  for (const tree of changedTrees) {
    const skillEntryPath = `${tree.treePath}/${skillEntryFileName}`;
    const skillEntry = (await git.raw([
      "ls-tree",
      "--name-only",
      revision,
      "--",
      skillEntryPath
    ])).trim();
    if (skillEntry.length === 0) {
      baselineSkills[tree.skillName] = null;
      continue;
    }

    try {
      baselineSkills[tree.skillName] = readOptionalSkillVersionFromMarkdown(
        await git.show([`${revision}:${skillEntryPath}`]),
        `${baselineRef}:${skillEntryPath}`
      );
    } catch {
      baselineSkills[tree.skillName] = null;
    }
  }

  return {
    revision,
    skills: baselineSkills
  };
}

import path from "node:path";
import { toPosix } from "../../tools/shared/src/node/filesystem.ts";
import type { SkillPackage } from "./project.ts";

export type SkillTree = Readonly<{
  skillName: string;
  treePath: string;
}>;

export function resolveRepositoryTreePath(
  directory: string,
  repositoryRoot: string
): string {
  const relativePath = path.relative(repositoryRoot, directory);
  if (
    relativePath === "" ||
    relativePath === ".." ||
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath)
  ) {
    throw new Error(
      `${directory} must be inside version-control repository ${repositoryRoot}`
    );
  }

  return toPosix(relativePath);
}

export function resolveSkillTrees(
  skills: readonly SkillPackage[],
  repositoryRoot: string
): SkillTree[] {
  return skills.map((skill) => {
    return {
      skillName: skill.name,
      treePath: resolveRepositoryTreePath(skill.directory, repositoryRoot)
    };
  });
}

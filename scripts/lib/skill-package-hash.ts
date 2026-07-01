import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {
  collectSkillFiles,
  rootDir,
  toPosix,
  type SkillPackage
} from "./project.ts";

export const skillPackageHashFileName = "skill-package.hash";

export function getSkillPackageHashFilePath(workspaceRoot: string = rootDir): string {
  return path.join(workspaceRoot, skillPackageHashFileName);
}

export async function calculateSkillPackageHash(skills: SkillPackage[]): Promise<string> {
  const hash = createHash("sha256");
  hash.update("skills-package-v1\0");

  for (const skill of skills) {
    hash.update(`skill\0${skill.name}\0`);
    const files = await collectSkillFiles(skill.directory);

    for (const relativePath of files) {
      const packagePath = `${skill.name}/${toPosix(relativePath)}`;
      const data = await fs.readFile(path.join(skill.directory, relativePath));
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

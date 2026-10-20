import type { VersionControlFile } from "../../tools/shared/src/version-control/index.ts";
import type { SkillPackageFile } from "./skill-package-hash.ts";

// Installation state is never part of the distributable package, even when
// explicitly staged. Match every component so nested installations stay local.
const installationPathComponents = new Set([
  "node_modules",
  ".pnpm",
  ".pnpm-store",
  ".npm",
  ".yarn",
  ".cache",
  ".bun"
]);

export function isSkillPackagePath(filePath: string): boolean {
  return !filePath
    .split("/")
    .some((component) => installationPathComponents.has(component));
}

export function readSkillPackageFile(
  file: VersionControlFile,
  relativePath: string
): SkillPackageFile | null {
  if (!isSkillPackagePath(relativePath)) {
    return null;
  }
  if (file.kind === "symlink") {
    throw new Error(
      `Skill package path must be a regular file, not a symbolic link: ${file.path}`
    );
  }
  return { data: Buffer.from(file.data), path: relativePath };
}

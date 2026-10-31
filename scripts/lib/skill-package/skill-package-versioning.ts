import path from "node:path";
import type { SkillPackageFile } from "./skill-package-hash.ts";

export type PackageVersionChangeKind =
  | "declaration"
  | "linked-source-map-candidate"
  | "ordinary";

export function classifyPackageVersionChange(
  filePath: string
): PackageVersionChangeKind {
  if (filePath.endsWith(".d.mts")) {
    return "declaration";
  }
  if (filePath.startsWith("scripts/") && filePath.endsWith(".mjs.map")) {
    return "linked-source-map-candidate";
  }
  return "ordinary";
}

export function isLinkedSourceMap(
  filePath: string,
  getFile: (filePath: string) => Promise<SkillPackageFile | undefined>
): Promise<boolean> {
  if (
    classifyPackageVersionChange(filePath) !== "linked-source-map-candidate"
  ) {
    return Promise.resolve(false);
  }

  const bundlePath = filePath.slice(0, -".map".length);
  const sourceMapDirective = `//# sourceMappingURL=${path.basename(filePath)}`;
  return getFile(bundlePath).then((bundle) => {
    if (bundle === undefined) {
      return false;
    }
    const lastNonEmptyLine = bundle.data
      .toString("utf8")
      .split(/\r?\n/u)
      .reverse()
      .find((line) => line.trim().length > 0);
    return lastNonEmptyLine?.trim() === sourceMapDirective;
  });
}

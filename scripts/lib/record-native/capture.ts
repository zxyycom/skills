import { createHash } from "node:crypto";
import path from "node:path";
import { openVersionControl } from "../../../tools/shared/src/version-control/index.ts";
import { resolveRepositoryTreePath } from "../skill-package/skill-package-tree.ts";
import {
  skillPackageSnapshotFromPendingFiles,
  type SkillPackageFile,
  type SkillPackageSnapshot
} from "../skill-package/skill-package-hash.ts";

export type NativeCandidateSnapshot = Readonly<{
  skills: SkillPackageSnapshot;
  source: readonly SkillPackageFile[];
  sourceHash: string;
}>;

/** Capture both inputs in one Git index enumeration; never read the worktree. */
export async function captureNativeCandidateSnapshot(
  workspaceRoot: string
): Promise<NativeCandidateSnapshot> {
  const repository = await openVersionControl(workspaceRoot);
  const skillTree = resolveRepositoryTreePath(
    path.join(workspaceRoot, "skills"),
    repository.rootDirectory
  );
  const sourceTree = resolveRepositoryTreePath(
    path.join(workspaceRoot, "tools/record-cli"),
    repository.rootDirectory
  );
  const pending = await repository.readPendingFiles({
    pathScopes: [skillTree, sourceTree]
  });
  const skills = skillPackageSnapshotFromPendingFiles(
    pending.filter((file) => file.path.startsWith(`${skillTree}/`)),
    workspaceRoot,
    repository.rootDirectory
  );
  const source: SkillPackageFile[] = [];
  for (const file of pending) {
    if (!file.path.startsWith(`${sourceTree}/`)) continue;
    const name = file.path.slice(sourceTree.length + 1);
    if (name.split("/")[0] === "target" || name.split("/")[0] === "delivery")
      continue;
    if (file.kind === "symlink")
      throw new Error(`native source must be regular: ${file.path}`);
    source.push({ path: name, data: Buffer.from(file.data) });
  }
  source.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  for (const required of ["Cargo.toml", "Cargo.lock", "rust-toolchain.toml"])
    if (!source.some((file) => file.path === required))
      throw new Error(`native source is missing ${required}`);
  return { skills, source, sourceHash: digestNativeSource(source) };
}

export function digestNativeSource(
  source: readonly SkillPackageFile[]
): string {
  const hash = createHash("sha256");
  for (const file of source)
    hash
      .update(
        `${Buffer.byteLength(file.path)}:${file.path}:${file.data.byteLength}:`
      )
      .update(file.data);
  return hash.digest("hex");
}

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
  delivery: readonly SkillPackageFile[];
  deliveryHash: string;
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
  const deliveryScopes = [
    "tools/record-contracts",
    "tools/record-cli/delivery",
    "tools/skill-updater/src",
    "tools/skill-package/src",
    "tools/shared/src",
    "scripts/lib/generation",
    "scripts/lib/record-native",
    "scripts/lib/skill-package",
    "scripts/lib/project.ts",
    "scripts/lib/oxc-config.ts",
    "scripts/build/skill-updaters.ts",
    "scripts/build/native-record-candidate.ts",
    "package.json",
    "pnpm-lock.yaml"
  ].map((name) =>
    resolveRepositoryTreePath(
      path.join(workspaceRoot, name),
      repository.rootDirectory
    )
  );
  const pending = await repository.readPendingFiles({
    pathScopes: [skillTree, sourceTree, ...deliveryScopes]
  });
  const skills = skillPackageSnapshotFromPendingFiles(
    pending.filter((file) => file.path.startsWith(`${skillTree}/`)),
    workspaceRoot,
    repository.rootDirectory
  );
  const source: SkillPackageFile[] = [];
  const delivery: SkillPackageFile[] = [];
  const workspaceTree = path
    .relative(repository.rootDirectory, workspaceRoot)
    .replaceAll("\\", "/");
  for (const file of pending) {
    if (
      deliveryScopes.some(
        (scope) => file.path === scope || file.path.startsWith(`${scope}/`)
      )
    ) {
      if (file.kind === "symlink")
        throw new Error(`delivery source must be regular: ${file.path}`);
      const relative = workspaceTree
        ? file.path.slice(workspaceTree.length + 1)
        : file.path;
      delivery.push({ path: relative, data: Buffer.from(file.data) });
    }
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
  delivery.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return {
    skills,
    source,
    sourceHash: digestNativeSource(source),
    delivery,
    deliveryHash: digestNativeSource(delivery)
  };
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

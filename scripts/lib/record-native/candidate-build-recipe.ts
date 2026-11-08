import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import type { SkillPackageFile } from "../skill-package/skill-package-hash.ts";

/** The actual native compile/package path, not unrelated Node delivery code. */
export const nativeBuildRecipePaths = [
  "tools/record-cli/delivery/build.ts",
  "tools/record-cli/delivery/manifest.ts",
  "scripts/lib/record-native/build.ts",
  "scripts/lib/record-native/ci-prepared.ts",
  "scripts/lib/record-native/runtime.ts",
  "scripts/prepare-record-native.ts"
] as const;

/** Read the exact historical CI recipe from Git, not a mutable worktree. */
export function readNativeBuildRecipe(
  root: string,
  revision: string
): SkillPackageFile[] {
  if (!/^[a-f0-9]{40,64}$/.test(revision))
    throw new Error("invalid native build revision");
  return nativeBuildRecipePaths.map((name) => {
    const result = spawnSync("git", ["show", `${revision}:${name}`], {
      cwd: root,
      maxBuffer: 4 * 1024 * 1024
    });
    if (result.error || result.status !== 0)
      throw new Error(`native build recipe unavailable: ${name}`);
    return { path: name, data: Buffer.from(result.stdout) };
  });
}

/** Rust binaries can be reused only if every actual compile recipe byte is unchanged. */
export function verifyNativeBuildRecipe(
  delivery: readonly SkillPackageFile[],
  recipe: readonly SkillPackageFile[]
): Record<string, string> {
  const prior = new Map(recipe.map((file) => [file.path, file.data]));
  if (
    prior.size !== nativeBuildRecipePaths.length ||
    recipe.length !== nativeBuildRecipePaths.length
  )
    throw new Error("native build recipe set differs");
  const current = new Map(delivery.map((file) => [file.path, file.data]));
  const hashes: Record<string, string> = {};
  for (const name of nativeBuildRecipePaths) {
    const old = prior.get(name),
      next = current.get(name);
    if (!old || !next || !old.equals(next))
      throw new Error(`native build recipe changed: ${name}`);
    hashes[name] = createHash("sha256").update(old).digest("hex");
  }
  return hashes;
}

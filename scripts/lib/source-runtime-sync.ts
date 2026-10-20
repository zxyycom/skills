import fs from "node:fs/promises";
import path from "node:path";
import * as v from "valibot";
import { parse as parseYaml } from "yaml";
import {
  syncGeneratedArtifacts,
  type GeneratedArtifact,
  type GeneratedFileMode
} from "./generated-file.ts";
import { rootDir } from "./project.ts";

const runtimeManifestSchema = v.object({
  dependencies: v.record(v.string(), v.string())
});
const runtimeLockSchema = v.object({
  importers: v.object({
    ".": v.object({
      dependencies: v.record(v.string(), v.object({ specifier: v.string() }))
    })
  })
});

async function runtimeLockMatches(
  artifacts: readonly GeneratedArtifact[],
  skillRoot: string
): Promise<boolean> {
  const manifestArtifact = artifacts.find(
    (artifact) => artifact.path === path.join(skillRoot, "package.json")
  );
  if (manifestArtifact === undefined) return true;
  try {
    const manifest = v.parse(
      runtimeManifestSchema,
      JSON.parse(manifestArtifact.content) as unknown
    );
    const lock = v.parse(
      runtimeLockSchema,
      parseYaml(
        await fs.readFile(path.join(skillRoot, "pnpm-lock.yaml"), "utf8")
      ) as unknown
    );
    const expected = Object.entries(manifest.dependencies);
    const locked = lock.importers["."].dependencies;
    if (
      expected.length === Object.keys(locked).length &&
      expected.every(
        ([name, specifier]) => locked[name]?.specifier === specifier
      )
    )
      return true;
  } catch (error) {
    console.error(
      `Runtime lockfile cannot be validated: ${error instanceof Error ? error.message : String(error)}`
    );
  }
  console.error(
    `Refresh explicitly: pnpm --dir "${path.relative(rootDir, skillRoot)}" install --ignore-workspace --lockfile-only --config.node-linker=isolated`
  );
  return false;
}

async function staleRuntimeFiles(
  artifacts: readonly GeneratedArtifact[],
  skillRoot: string,
  retiredPaths: readonly string[]
): Promise<ReadonlySet<string>> {
  const expected = new Set(artifacts.map((artifact) => artifact.path));
  const stale = new Set(
    retiredPaths.map((relative) => path.join(skillRoot, relative))
  );
  const runtimeRoot = path.join(skillRoot, "scripts/runtime");
  let files: string[] = [];
  try {
    files = await fs.readdir(runtimeRoot, { recursive: true });
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT"))
      throw error;
  }
  for (const relative of files) {
    const file = path.join(runtimeRoot, relative);
    const status = await fs.lstat(file);
    if (!status.isFile() || expected.has(file)) continue;
    if (
      (await fs.readFile(file, "utf8")).startsWith(
        "/*\n * Synced TypeScript runtime;"
      )
    )
      stale.add(file);
  }
  return stale;
}

/** Clean only explicitly retired paths or files carrying our generated marker. */
export async function syncSourceRuntimeArtifacts(
  artifacts: readonly GeneratedArtifact[],
  options: Readonly<{
    mode: GeneratedFileMode;
    skillName: string;
    retiredPaths: readonly string[];
  }>
): Promise<boolean> {
  let changed = await syncGeneratedArtifacts(
    artifacts,
    options.mode,
    rootDir,
    "tools/"
  );
  const skillRoot = path.join(rootDir, "skills", options.skillName);
  if (!(await runtimeLockMatches(artifacts, skillRoot))) changed = true;
  const stale = await staleRuntimeFiles(
    artifacts,
    skillRoot,
    options.retiredPaths
  );
  for (const file of stale) {
    try {
      const status = await fs.lstat(file);
      if (!status.isFile())
        throw new Error(
          `Retired generated path must be a regular file: ${file}`
        );
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT")
        continue;
      throw error;
    }
    changed = true;
    console.error(`Retired generated file: ${path.relative(rootDir, file)}`);
    if (options.mode === "write") await fs.unlink(file);
  }
  return changed;
}

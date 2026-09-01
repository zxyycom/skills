import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { resolveInstalledPackageRoot, withTempWorkspace } from "./helpers.ts";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  ".."
);
const execFileAsync = promisify(execFile);

function packageDependencyNames(manifestContent: string): readonly string[] {
  const manifest: unknown = JSON.parse(manifestContent);
  if (
    manifest === null ||
    typeof manifest !== "object" ||
    Array.isArray(manifest) ||
    !("dependencies" in manifest) ||
    manifest.dependencies === undefined
  ) {
    return [];
  }
  const { dependencies } = manifest;
  if (
    dependencies === null ||
    typeof dependencies !== "object" ||
    Array.isArray(dependencies) ||
    !Object.values(dependencies).every(
      (dependencyVersion) => typeof dependencyVersion === "string"
    )
  ) {
    throw new Error("Package dependencies must map package names to strings");
  }
  return Object.keys(dependencies).sort();
}

async function copyInstalledPackageClosure(
  packageNames: readonly string[],
  fromManifestPath: string,
  targetNodeModules: string
): Promise<void> {
  const installed = new Map<string, string>();
  const pending = packageNames.map((packageName) => ({
    packageName,
    fromManifestPath
  }));
  while (pending.length > 0) {
    const next = pending.shift();
    if (next === undefined) break;
    const sourcePackageRoot = await resolveInstalledPackageRoot(
      next.packageName,
      next.fromManifestPath
    );
    const existingSource = installed.get(next.packageName);
    if (existingSource !== undefined) {
      if (existingSource !== sourcePackageRoot) {
        throw new Error(
          `Build fixture requires conflicting versions of ${next.packageName}`
        );
      }
      continue;
    }
    installed.set(next.packageName, sourcePackageRoot);
    const targetPackageRoot = path.join(
      targetNodeModules,
      ...next.packageName.split("/")
    );
    await fs.mkdir(path.dirname(targetPackageRoot), { recursive: true });
    await fs.cp(sourcePackageRoot, targetPackageRoot, { recursive: true });
    const sourceManifestPath = path.join(sourcePackageRoot, "package.json");
    for (const dependency of packageDependencyNames(
      await fs.readFile(sourceManifestPath, "utf8")
    )) {
      pending.push({
        packageName: dependency,
        fromManifestPath: sourceManifestPath
      });
    }
  }
}

async function copyTaskGraphBuildCheckout(targetRoot: string): Promise<void> {
  for (const relativePath of [
    "package.json",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    "scripts/build/task-graph.ts",
    "scripts/lib",
    "tools/shared/src",
    "tools/task-graph/src"
  ]) {
    const source = path.join(repositoryRoot, relativePath);
    const target = path.join(targetRoot, relativePath);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.cp(source, target, { recursive: true });
  }
  const rootManifestPath = path.join(repositoryRoot, "package.json");
  await copyInstalledPackageClosure(
    [
      "@types/node",
      "@types/write-file-atomic",
      "@typescript/native-preview",
      "@valibot/to-json-schema",
      "fast-glob",
      "simple-git",
      "valibot",
      "write-file-atomic"
    ],
    rootManifestPath,
    path.join(targetRoot, "node_modules")
  );
  const compilerRoot = await resolveInstalledPackageRoot(
    "@typescript/native-preview",
    rootManifestPath
  );
  await copyInstalledPackageClosure(
    [`@typescript/native-preview-${process.platform}-${process.arch}`],
    path.join(compilerRoot, "package.json"),
    path.join(targetRoot, "node_modules")
  );
}

test(
  "generated task graph bundle and source map are checkout-path independent",
  { timeout: 180_000 },
  async () => {
    await withTempWorkspace(async (root) => {
      const shortCheckout = path.join(root, "short");
      const longCheckout = path.join(
        root,
        "checkout-with-a-materially-different-absolute-path-length"
      );
      await Promise.all([
        copyTaskGraphBuildCheckout(shortCheckout),
        copyTaskGraphBuildCheckout(longCheckout)
      ]);
      await Promise.all(
        [shortCheckout, longCheckout].map(async (checkout) => {
          await execFileAsync(
            process.execPath,
            ["scripts/build/task-graph.ts", "--write"],
            { cwd: checkout, timeout: 120_000, windowsHide: true }
          );
        })
      );
      const relativeOutput = path.join(
        "skills",
        "task-graph",
        "scripts",
        "task-graph.mjs"
      );
      const shortBundle = await fs.readFile(
        path.join(shortCheckout, relativeOutput)
      );
      const longBundle = await fs.readFile(
        path.join(longCheckout, relativeOutput)
      );
      const shortSourceMap = await fs.readFile(
        path.join(shortCheckout, `${relativeOutput}.map`)
      );
      const longSourceMap = await fs.readFile(
        path.join(longCheckout, `${relativeOutput}.map`)
      );
      const relativeDeclaration = path.join(
        "skills",
        "task-graph",
        "scripts",
        "task-graph.d.mts"
      );
      const shortDeclaration = await fs.readFile(
        path.join(shortCheckout, relativeDeclaration)
      );
      const longDeclaration = await fs.readFile(
        path.join(longCheckout, relativeDeclaration)
      );
      const relativeDeclarationDirectory = path.join(
        "skills",
        "task-graph",
        "scripts",
        "task-graph-sdk"
      );
      const declarationFiles = (
        await fs.readdir(path.join(shortCheckout, relativeDeclarationDirectory))
      ).sort();
      assert.deepEqual(
        declarationFiles,
        (
          await fs.readdir(
            path.join(longCheckout, relativeDeclarationDirectory)
          )
        ).sort()
      );
      assert.deepEqual(shortBundle, longBundle);
      assert.deepEqual(shortSourceMap, longSourceMap);
      assert.deepEqual(shortDeclaration, longDeclaration);
      for (const filename of declarationFiles) {
        assert.deepEqual(
          await fs.readFile(
            path.join(shortCheckout, relativeDeclarationDirectory, filename)
          ),
          await fs.readFile(
            path.join(longCheckout, relativeDeclarationDirectory, filename)
          )
        );
      }
      assert.equal(shortBundle.includes(Buffer.from("debugId=")), false);
      assert.equal(shortSourceMap.includes(Buffer.from("debugId")), false);
      assert.equal(
        shortBundle.includes(
          Buffer.from("node_modules/write-file-atomic/lib/index.js")
        ),
        true
      );
    });
  }
);

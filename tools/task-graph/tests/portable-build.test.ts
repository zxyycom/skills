import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { withTempWorkspace } from "./helpers.ts";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  ".."
);
const execFileAsync = promisify(execFile);
const ambientOptionalPeerMarker = "ambient-optional-peer";

async function copyTaskGraphBuildCheckout(targetRoot: string): Promise<void> {
  for (const relativePath of [
    "package.json",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    "scripts/build",
    "scripts/lib",
    "tools/shared/src",
    "tools/skill-updater/src",
    "tools/skill-package/src",
    "tools/task-graph/src"
  ]) {
    const source = path.join(repositoryRoot, relativePath);
    const target = path.join(targetRoot, relativePath);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.cp(source, target, { recursive: true });
  }
  await fs.symlink(
    path.join(repositoryRoot, "node_modules"),
    path.join(targetRoot, "node_modules"),
    process.platform === "win32" ? "junction" : "dir"
  );
}

async function createAmbientOptionalPeer(root: string): Promise<void> {
  const packageRoot = path.join(root, "node_modules", "supports-color");
  await fs.mkdir(packageRoot, { recursive: true });
  await Promise.all([
    fs.writeFile(
      path.join(packageRoot, "package.json"),
      `${JSON.stringify({
        main: "index.js",
        name: "supports-color",
        version: "0.0.0-test"
      })}\n`
    ),
    fs.writeFile(
      path.join(packageRoot, "index.js"),
      `module.exports = { marker: ${JSON.stringify(ambientOptionalPeerMarker)}, stderr: { level: 3 } };\n`
    )
  ]);
}

test(
  "generated task graph artifacts ignore checkout path and ambient optional peers",
  { timeout: 180_000 },
  async () => {
    await withTempWorkspace(async (root) => {
      await createAmbientOptionalPeer(root);
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
        "task-graph.ts"
      );
      const shortBundle = await fs.readFile(
        path.join(shortCheckout, relativeOutput)
      );
      const longBundle = await fs.readFile(
        path.join(longCheckout, relativeOutput)
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

      assert.equal(
        shortBundle.includes(Buffer.from(ambientOptionalPeerMarker)),
        false
      );
      const runtimePath = path.join("skills/task-graph/scripts/runtime");
      const runtimeFiles = (
        await fs.readdir(path.join(shortCheckout, runtimePath), {
          recursive: true,
          withFileTypes: true
        })
      ).filter((entry) => entry.isFile());
      for (const entry of runtimeFiles) {
        const relative = path.relative(
          path.join(shortCheckout, runtimePath),
          path.join(entry.parentPath, entry.name)
        );
        const shortSource = await fs.readFile(
          path.join(shortCheckout, runtimePath, relative)
        );
        const longSource = await fs.readFile(
          path.join(longCheckout, runtimePath, relative)
        );
        assert.deepEqual(shortSource, longSource);
        assert.equal(shortSource.includes(Buffer.from(shortCheckout)), false);
        assert.equal(
          shortSource.includes(Buffer.from(ambientOptionalPeerMarker)),
          false
        );
      }
    });
  }
);

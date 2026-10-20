import fsSync from "node:fs";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

/** Copies the complete scripts closure, not a formerly bundled single file. */
export async function copyRuntimeScripts(
  sourceScript: string,
  target: string,
  frozenInstall = false
): Promise<void> {
  await fs.cp(path.dirname(sourceScript), target, { recursive: true });
  const skill = path.dirname(path.dirname(sourceScript));
  await fs.copyFile(
    path.join(skill, "package.json"),
    path.join(target, "package.json")
  );
  if (frozenInstall) {
    await fs.copyFile(
      path.join(skill, "pnpm-lock.yaml"),
      path.join(target, "pnpm-lock.yaml")
    );
    const result = spawnSync(
      "pnpm",
      [
        "--dir",
        target,
        "install",
        "--ignore-workspace",
        "--prod",
        "--frozen-lockfile",
        "--config.node-linker=isolated"
      ],
      { encoding: "utf8" }
    );
    assert.equal(result.status, 0, result.stdout + result.stderr);
  } else {
    const root = path.resolve(skill, "../..");
    await fs.symlink(
      path.join(root, "node_modules"),
      path.join(target, "node_modules"),
      process.platform === "win32" ? "junction" : "dir"
    );
  }
}

export function copyRuntimeScriptsSync(
  sourceScript: string | URL,
  target: string
): void {
  const source =
    sourceScript instanceof URL ? fileURLToPath(sourceScript) : sourceScript;
  fsSync.cpSync(path.dirname(source), target, { recursive: true });
  const skill = path.dirname(path.dirname(source));
  fsSync.copyFileSync(
    path.join(skill, "package.json"),
    path.join(target, "package.json")
  );
  fsSync.symlinkSync(
    path.join(path.resolve(skill, "../.."), "node_modules"),
    path.join(target, "node_modules"),
    process.platform === "win32" ? "junction" : "dir"
  );
}

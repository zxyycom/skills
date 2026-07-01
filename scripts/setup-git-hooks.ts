import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { pathExists, rootDir } from "./lib/project.ts";

function runGit(args: string[], cwd: string = rootDir): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"]
  }).trim();
}

function setHooksPath(cwd: string): void {
  execFileSync("git", ["config", "core.hooksPath", ".githooks"], {
    cwd,
    stdio: "inherit"
  });
}

async function makePreCommitExecutable(cwd: string): Promise<void> {
  await fs.chmod(path.join(cwd, ".githooks", "pre-commit"), 0o755);
}

await makePreCommitExecutable(rootDir);
setHooksPath(rootDir);
console.log("Configured root repository hooksPath: .githooks");

let submoduleOutput = "";
try {
  submoduleOutput = runGit(["config", "--file", ".gitmodules", "--get-regexp", "path"]);
} catch {
  submoduleOutput = "";
}

for (const line of submoduleOutput.split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed) {
    continue;
  }

  const relativePath = trimmed.split(/\s+/).at(-1);
  if (!relativePath) {
    continue;
  }

  const submoduleRoot = path.join(rootDir, relativePath);
  if (!await pathExists(path.join(submoduleRoot, ".githooks", "pre-commit"))) {
    continue;
  }

  await makePreCommitExecutable(submoduleRoot);
  setHooksPath(submoduleRoot);
  console.log(`Configured ${relativePath} hooksPath: .githooks`);
}

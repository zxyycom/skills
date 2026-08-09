#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function git(cwd, args) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: "pipe",
    windowsHide: true
  });
  if (result.error || result.status !== 0) {
    const detail = [result.stderr, result.stdout]
      .filter((value) => typeof value === "string" && value.trim().length > 0)
      .join("\n")
      .trim();
    const failure = result.error?.message || detail || `exit ${result.status}`;
    throw new Error(`git ${args.join(" ")} failed: ${failure}`);
  }
}

export function setupGitHooks(cwd) {
  const hookPath = path.join(cwd, ".githooks", "pre-commit");
  if (!fs.existsSync(hookPath)) {
    throw new Error(`pre-commit hook is missing at ${hookPath}`);
  }
  if (process.platform !== "win32") {
    fs.chmodSync(hookPath, 0o755);
  }
  git(cwd, ["config", "--local", "core.hooksPath", ".githooks"]);
}

const entryPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (entryPath === fileURLToPath(import.meta.url)) {
  const repoRoot = path.resolve(path.dirname(entryPath), "..");
  try {
    setupGitHooks(repoRoot);
    console.log("Configured repository hooksPath: .githooks");
  } catch (error) {
    console.error(
      `git hook setup failed: ${error instanceof Error ? error.message : String(error)}`
    );
    process.exitCode = 1;
  }
}

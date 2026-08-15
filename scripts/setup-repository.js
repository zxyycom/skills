#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { accessSync, constants as fsConstants, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setupGitHooks } from "./setup-git-hooks.js";

function gitResult(cwd, args) {
  return spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: "pipe",
    windowsHide: true
  });
}

function gitOutput(cwd, args) {
  const result = gitResult(cwd, args);
  if (result.error || result.status !== 0) {
    const detail = [result.stderr, result.stdout]
      .filter((value) => typeof value === "string" && value.trim().length > 0)
      .join("\n")
      .trim();
    const failure = result.error?.message || detail || `exit ${result.status}`;
    throw new Error(`git ${args.join(" ")} failed: ${failure}`);
  }
  return result.stdout.trim();
}

function readGitConfig(cwd, key) {
  const result = gitResult(cwd, ["config", "--local", "--get", key]);
  if (!result.error && result.status === 1 && result.stdout.trim() === "") {
    return null;
  }
  if (result.error || result.status !== 0) {
    const detail = [result.stderr, result.stdout]
      .filter((value) => typeof value === "string" && value.trim().length > 0)
      .join("\n")
      .trim();
    const failure = result.error?.message || detail || `exit ${result.status}`;
    throw new Error(`git config --local --get ${key} failed: ${failure}`);
  }
  return result.stdout.trim();
}

export function discoverMainWorktreeRoot(cwd) {
  const output = gitOutput(cwd, ["worktree", "list", "--porcelain", "-z"]);
  const firstField = output.split("\0", 1)[0];
  if (!firstField.startsWith("worktree ")) {
    throw new Error("git worktree list returned no main worktree");
  }
  const root = firstField.slice("worktree ".length);
  if (!path.isAbsolute(root)) {
    throw new Error(`git returned a non-absolute main worktree path: ${root}`);
  }
  return path.normalize(root);
}

export function getCurrentTaskGraphRoot(cwd) {
  const normalized = discoverMainWorktreeRoot(cwd);
  const indexPath = path.join(
    normalized,
    "docs",
    "task-graph",
    "task-graph-index.json"
  );
  if (!existsSync(indexPath)) {
    throw new Error(
      `the current project does not contain the task index: ${normalized}`
    );
  }
  return normalized;
}

export function getRepositorySetupStatus(cwd) {
  try {
    const hooksPath = readGitConfig(cwd, "core.hooksPath");
    if (hooksPath !== ".githooks") {
      return {
        detail: "core.hooksPath is not configured as .githooks",
        state: "missing"
      };
    }

    const hookPath = path.join(cwd, ".githooks", "pre-commit");
    try {
      accessSync(
        hookPath,
        process.platform === "win32" ? fsConstants.F_OK : fsConstants.X_OK
      );
    } catch {
      return {
        detail: `pre-commit is missing or not executable at ${hookPath}`,
        state: "missing"
      };
    }

    const currentRoot = getCurrentTaskGraphRoot(cwd);

    return {
      detail: `hooks enabled; task graph root ${currentRoot}`,
      state: "ready"
    };
  } catch (error) {
    return {
      detail: error instanceof Error ? error.message : String(error),
      state: "error"
    };
  }
}

export function setupRepository(cwd) {
  const mainRoot = getCurrentTaskGraphRoot(cwd);

  setupGitHooks(cwd);
  return mainRoot;
}

const entryPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (entryPath === fileURLToPath(import.meta.url)) {
  const repoRoot = path.resolve(path.dirname(entryPath), "..");
  try {
    const mainRoot = setupRepository(repoRoot);
    console.log(`Configured repository; task graph root: ${mainRoot}`);
  } catch (error) {
    console.error(
      `repository setup failed: ${error instanceof Error ? error.message : String(error)}`
    );
    process.exitCode = 1;
  }
}

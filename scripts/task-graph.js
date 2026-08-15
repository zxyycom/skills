#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getCurrentTaskGraphRoot } from "./setup-repository.js";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

function parseArguments(argv) {
  const forwarded = [];
  let explicitRoot = null;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--index" || argument.startsWith("--index=")) {
      throw new Error(
        "the repository task-graph command owns --index; select another project with --root"
      );
    }
    if (argument === "--root" || argument.startsWith("--root=")) {
      if (explicitRoot !== null) {
        throw new Error("--root may be specified only once");
      }
      let value;
      if (argument === "--root") {
        index += 1;
        value = argv[index];
      } else {
        value = argument.slice("--root=".length);
      }
      if (
        typeof value !== "string" ||
        value.length === 0 ||
        value.startsWith("--")
      ) {
        throw new Error("--root requires a project path");
      }
      explicitRoot = value;
      continue;
    }
    forwarded.push(argument);
  }

  return { explicitRoot, forwarded };
}

function resolveProjectRoot(explicitRoot) {
  return explicitRoot === null
    ? getCurrentTaskGraphRoot(repoRoot)
    : path.resolve(repoRoot, explicitRoot);
}

function runTaskGraph(argv) {
  const { explicitRoot, forwarded } = parseArguments(argv);
  const taskGraphRoot = resolveProjectRoot(explicitRoot);
  const indexPath = path.join(
    taskGraphRoot,
    "docs",
    "task-graph",
    "task-graph-index.json"
  );
  if (!existsSync(indexPath)) {
    throw new Error(`the selected project has no task index at ${indexPath}`);
  }
  const cliPath = path.join(
    taskGraphRoot,
    "skills",
    "task-graph",
    "scripts",
    "task-graph.mjs"
  );
  if (!existsSync(cliPath)) {
    throw new Error(`the selected project has no task-graph CLI at ${cliPath}`);
  }

  const result = spawnSync(
    process.execPath,
    [cliPath, ...forwarded, "--root", taskGraphRoot],
    {
      cwd: taskGraphRoot,
      env: process.env,
      stdio: "inherit",
      windowsHide: true
    }
  );
  if (result.error) {
    throw result.error;
  }
  return result.status ?? 1;
}

try {
  process.exitCode = runTaskGraph(process.argv.slice(2));
} catch (error) {
  console.error(
    `task-graph launcher failed: ${error instanceof Error ? error.message : String(error)}`
  );
  process.exitCode = 1;
}

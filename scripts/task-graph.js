#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getConfiguredTaskGraphRoot } from "./setup-repository.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function runTaskGraph(argv) {
  if (argv.some((argument) => ["--root", "--index"].some(
    (option) => argument === option || argument.startsWith(`${option}=`)
  ))) {
    throw new Error(
      "the repository task-graph command owns --root and --index; invoke the domain CLI directly for another index"
    );
  }

  const taskGraphRoot = getConfiguredTaskGraphRoot(repoRoot);
  const cliPath = path.join(
    taskGraphRoot,
    "skills",
    "task-graph",
    "scripts",
    "task-graph.mjs"
  );
  if (!existsSync(cliPath)) {
    throw new Error(`the configured task-graph CLI is missing at ${cliPath}`);
  }

  const result = spawnSync(
    process.execPath,
    [cliPath, ...argv, "--root", taskGraphRoot],
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

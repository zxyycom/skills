#!/usr/bin/env node
// Vibe 0.0.1 accepts any non-empty Lizard version. Guard the package's
// availability probe, then pass its scanner arguments through unchanged.
import { spawn, spawnSync } from "node:child_process";

const expectedVersion = "1.23.0";

function commandOutput(result) {
  return (result.stdout || "").trim() || (result.stderr || "").trim();
}

function verifyVersion() {
  const result = spawnSync("lizard", ["--version"], {
    encoding: "utf8",
    stdio: "pipe",
    windowsHide: true
  });
  if (result.error) {
    console.error(`Could not run lizard --version: ${result.error.message}`);
    return 1;
  }

  const output = commandOutput(result);
  if (result.status !== 0) {
    console.error(
      `lizard --version exited with code ${result.status ?? "unknown"}${
        output ? `: ${output}` : ""
      }`
    );
    return 1;
  }
  if (output !== expectedVersion) {
    console.error(
      `Lizard ${expectedVersion} is required; got ${output || "empty output"}.`
    );
    return 1;
  }

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  return 0;
}

function forwardScan(args) {
  return new Promise((resolve) => {
    const child = spawn("lizard", args, {
      stdio: "inherit",
      windowsHide: true
    });
    child.once("error", (error) => {
      console.error(`Could not run lizard: ${error.message}`);
      resolve(1);
    });
    child.once("close", (code) => resolve(code ?? 1));
  });
}

const args = process.argv.slice(2);
process.exitCode =
  args.length === 1 && args[0] === "--version"
    ? verifyVersion()
    : await forwardScan(args);

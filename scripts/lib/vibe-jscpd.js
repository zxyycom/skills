#!/usr/bin/env node
// Vibe 0.0.1 writes jscpd's config outside the project root, while jscpd
// resolves relative paths from that config. Normalize Vibe's exact file list.
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

function jscpdExecutable() {
  const vibeCheckIndex = fileURLToPath(
    import.meta.resolve("@zxyycom/vibe-check")
  );
  const requireFromVibeCheck = createRequire(vibeCheckIndex);
  return requireFromVibeCheck.resolve("jscpd/run-jscpd.js");
}

function rewriteConfigPaths(args) {
  if (args.length === 1 && args[0] === "--version") {
    return;
  }
  const configIndex = args.indexOf("--config");
  if (configIndex === -1 || args[configIndex + 1] === undefined) {
    throw new TypeError("Vibe jscpd scan must provide --config <path>");
  }

  const configPath = args[configIndex + 1];
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  if (
    typeof config !== "object" ||
    config === null ||
    Array.isArray(config) ||
    !Array.isArray(config.path) ||
    !config.path.every((value) => typeof value === "string")
  ) {
    throw new TypeError("Vibe jscpd config must contain a string path array");
  }

  config.path = config.path.map((filePath) =>
    isAbsolute(filePath) ? filePath : resolve(process.cwd(), filePath)
  );
  writeFileSync(configPath, `${JSON.stringify(config)}\n`, "utf8");
}

const args = process.argv.slice(2);
try {
  rewriteConfigPaths(args);
  const child = spawn(process.execPath, [jscpdExecutable(), ...args], {
    stdio: "inherit",
    windowsHide: true
  });
  child.once("error", (error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
  child.once("exit", (code) => {
    process.exitCode = code ?? 1;
  });
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

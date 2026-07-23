#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import {
  accessSync,
  constants as fsConstants,
  existsSync,
  readFileSync
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { lockfileFingerprint } from "./lib/environment-lockfile.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repoRoot, "package.json");
const lockfilePath = path.join(repoRoot, "pnpm-lock.yaml");
const maxBuffer = 64 * 1024 * 1024;
const plainTextEnvironment = {
  ...process.env,
  CLICOLOR: "0",
  CLICOLOR_FORCE: "0",
  CODEGRAPH_TELEMETRY: "0",
  FORCE_COLOR: "0",
  NO_COLOR: "1",
  PNPM_CONFIG_COLOR: "false",
  TERM: "dumb",
  npm_config_color: "false"
};

function parseAction(argv) {
  if (argv.length === 0) {
    return "check";
  }
  if (argv.length === 1 && (argv[0] === "check" || argv[0] === "install")) {
    return argv[0];
  }
  throw new Error("usage: node scripts/env.js <check|install>");
}

function readEnvironmentConfig() {
  if (!existsSync(manifestPath)) {
    throw new Error(`package.json is missing at ${manifestPath}`);
  }
  if (!existsSync(lockfilePath)) {
    throw new Error(`pnpm-lock.yaml is missing at ${lockfilePath}`);
  }

  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch (error) {
    throw new Error(`package.json is not valid JSON: ${errorMessage(error)}`);
  }

  const packageManagerMatch = /^pnpm@(\d+\.\d+\.\d+)$/u.exec(
    typeof manifest.packageManager === "string" ? manifest.packageManager : ""
  );
  if (!packageManagerMatch) {
    throw new Error(
      "package.json packageManager must pin pnpm as pnpm@<major>.<minor>.<patch>"
    );
  }

  const bunRange = typeof manifest.engines?.bun === "string"
    ? manifest.engines.bun
    : "";
  const bunMinimumMatch = /^>=(\d+\.\d+(?:\.\d+)?)$/u.exec(bunRange);
  if (!bunMinimumMatch) {
    throw new Error("package.json engines.bun must use a simple >= version");
  }

  return {
    bunMinimum: parseVersion(bunMinimumMatch[1]),
    dependencyNames: dependencyNamesFrom(manifest),
    manifest,
    pnpmVersion: parseVersion(packageManagerMatch[1])
  };
}

function dependencyNamesFrom(record) {
  const names = new Set();
  for (const field of [
    "dependencies",
    "devDependencies",
    "optionalDependencies"
  ]) {
    const dependencies = record?.[field];
    if (!dependencies || typeof dependencies !== "object") {
      continue;
    }
    for (const name of Object.keys(dependencies)) {
      names.add(name);
    }
  }
  return [...names].sort();
}

function parseVersion(value) {
  const match = /(?<!\d)(\d+)\.(\d+)(?:\.(\d+))?/u.exec(value);
  if (!match) {
    return null;
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3] ?? 0),
    text: `${match[1]}.${match[2]}.${match[3] ?? 0}`
  };
}

function compareVersions(left, right) {
  for (const field of ["major", "minor", "patch"]) {
    if (left[field] !== right[field]) {
      return left[field] < right[field] ? -1 : 1;
    }
  }
  return 0;
}

function resolveCommand(command) {
  const hasDirectory = command.includes("/") || command.includes("\\");
  const directories = hasDirectory
    ? [""]
    : (process.env.PATH ?? "").split(path.delimiter);
  const extensions = process.platform === "win32" && path.extname(command) === ""
    ? [
        ...(process.env.PATHEXT ?? ".COM;.EXE;.BAT;.CMD").split(";"),
        ""
      ]
    : [""];

  for (const directory of directories) {
    if (!hasDirectory && directory.length === 0) {
      continue;
    }
    for (const extension of extensions) {
      const candidate = hasDirectory
        ? `${command}${extension}`
        : path.join(directory, `${command}${extension}`);
      try {
        accessSync(
          candidate,
          process.platform === "win32" ? fsConstants.F_OK : fsConstants.X_OK
        );
        return candidate;
      } catch {
        // Try the next PATH entry.
      }
    }
  }
  return null;
}

function quoteWindowsCommandArgument(value) {
  if (/[\r\n%]/u.test(value)) {
    throw new Error(`unsupported Windows command argument: ${value}`);
  }
  return `"${value.replaceAll("\"", "\"\"")}"`;
}

function runCommand(command, args, { inherit = false } = {}) {
  const resolvedCommand = resolveCommand(command);
  if (!resolvedCommand) {
    return {
      exitCode: null,
      output: "",
      resolutionError: `${command} was not found on PATH`
    };
  }

  const isWindowsBatch = process.platform === "win32"
    && /\.(?:bat|cmd)$/iu.test(resolvedCommand);
  const executable = isWindowsBatch
    ? process.env.ComSpec ?? "cmd.exe"
    : resolvedCommand;
  const commandArgs = isWindowsBatch
    ? [
        "/d",
        "/s",
        "/c",
        `"${[
          quoteWindowsCommandArgument(resolvedCommand),
          ...args.map(quoteWindowsCommandArgument)
        ].join(" ")}"`
      ]
    : args;
  const result = spawnSync(executable, commandArgs, {
    cwd: repoRoot,
    encoding: "utf8",
    env: plainTextEnvironment,
    maxBuffer,
    stdio: inherit ? "inherit" : "pipe",
    windowsHide: true,
    windowsVerbatimArguments: isWindowsBatch
  });

  const output = inherit
    ? ""
    : [result.stderr, result.stdout]
        .filter((value) => typeof value === "string" && value.length > 0)
        .join("\n")
        .trim();
  return {
    exitCode: result.status,
    output,
    resolutionError: result.error?.message ?? null,
    stderr: inherit ? "" : result.stderr?.trim() ?? "",
    stdout: inherit ? "" : result.stdout?.trim() ?? ""
  };
}

function requireSuccessfulCommand(command, args) {
  const result = runCommand(command, args, { inherit: true });
  if (result.resolutionError) {
    throw new Error(result.resolutionError);
  }
  if (result.exitCode !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed with exit code ${
        result.exitCode ?? "unknown"
      }`
    );
  }
}

function getToolStatus(requirement) {
  const result = runCommand(requirement.name, ["--version"]);
  if (result.resolutionError) {
    return {
      detail: result.resolutionError,
      name: requirement.name,
      requirement,
      state: "missing",
      version: null
    };
  }
  if (result.exitCode !== 0) {
    return {
      detail: `--version failed: ${result.output || `exit ${result.exitCode}`}`,
      name: requirement.name,
      requirement,
      state: "error",
      version: null
    };
  }

  const version = parseVersion(result.stdout || result.stderr);
  if (!version) {
    return {
      detail: `could not parse version from: ${result.output}`,
      name: requirement.name,
      requirement,
      state: "error",
      version: null
    };
  }
  if (
    requirement.exactVersion
    && compareVersions(version, requirement.exactVersion) !== 0
  ) {
    return {
      detail: `expected ${requirement.exactVersion.text}`,
      name: requirement.name,
      requirement,
      state: "mismatch",
      version
    };
  }
  if (
    requirement.minimumVersion
    && compareVersions(version, requirement.minimumVersion) < 0
  ) {
    return {
      detail: `requires >= ${requirement.minimumVersion.text}`,
      name: requirement.name,
      requirement,
      state: "outdated",
      version
    };
  }

  return {
    detail: "",
    name: requirement.name,
    requirement,
    state: "ready",
    version
  };
}

function getDependencyStatus(config, toolStatuses) {
  const pnpmStatus = toolStatuses.find(({ name }) => name === "pnpm");
  if (pnpmStatus?.state !== "ready") {
    return {
      detail: "pnpm must be ready before project dependencies can be checked",
      state: "blocked"
    };
  }

  const modulesPath = path.join(repoRoot, "node_modules", ".modules.yaml");
  const installedLockfilePath = path.join(
    repoRoot,
    "node_modules",
    ".pnpm",
    "lock.yaml"
  );
  if (!existsSync(modulesPath)) {
    return { detail: "node_modules is not installed", state: "missing" };
  }
  if (!existsSync(installedLockfilePath)) {
    return {
      detail: "node_modules does not contain its pnpm lock snapshot",
      state: "stale"
    };
  }
  if (
    lockfileFingerprint(lockfilePath)
    !== lockfileFingerprint(installedLockfilePath)
  ) {
    return {
      detail: "node_modules was installed from a different pnpm-lock.yaml",
      state: "stale"
    };
  }

  const listResult = runCommand("pnpm", [
    "list",
    "--depth",
    "0",
    "--json",
    "--reporter=silent"
  ]);
  if (listResult.resolutionError || listResult.exitCode !== 0) {
    return {
      detail: `pnpm list failed: ${
        listResult.resolutionError ?? listResult.output
      }`,
      state: "error"
    };
  }

  let records;
  try {
    records = JSON.parse(listResult.stdout);
  } catch (error) {
    return {
      detail: `pnpm list returned invalid JSON: ${errorMessage(error)}`,
      state: "error"
    };
  }
  const projectRecord = Array.isArray(records) ? records[0] : records;
  if (!projectRecord || typeof projectRecord !== "object") {
    return { detail: "pnpm list returned no project record", state: "error" };
  }

  const installedNames = new Set(dependencyNamesFrom(projectRecord));
  const missingNames = config.dependencyNames.filter(
    (name) => !installedNames.has(name)
  );
  if (missingNames.length > 0) {
    return {
      detail: `missing direct dependencies: ${missingNames.join(", ")}`,
      state: "missing"
    };
  }

  return {
    detail: `${config.dependencyNames.length} direct dependencies match pnpm-lock.yaml`,
    state: "ready"
  };
}

function getCodeGraphIndexStatus(toolStatuses) {
  const toolStatus = toolStatuses.find(({ name }) => name === "codegraph");
  if (toolStatus?.state !== "ready") {
    return {
      detail: "the global codegraph command must be ready before its index can be checked",
      state: "blocked"
    };
  }

  const result = runCommand("codegraph", ["status", "--json", "."]);
  if (result.resolutionError || result.exitCode !== 0) {
    return {
      detail: `codegraph status failed: ${
        result.resolutionError ?? result.output
      }`,
      state: "error"
    };
  }

  let status;
  try {
    status = JSON.parse(result.stdout);
  } catch (error) {
    return {
      detail: `codegraph status returned invalid JSON: ${errorMessage(error)}`,
      state: "error"
    };
  }
  if (
    typeof status !== "object"
    || status === null
    || typeof status.initialized !== "boolean"
  ) {
    return {
      detail: "codegraph status returned no initialized state",
      state: "error"
    };
  }
  if (!status.initialized) {
    return {
      detail: "the repository has not been initialized",
      state: "missing"
    };
  }

  const lastIndexed = typeof status.lastIndexed === "string"
    && status.lastIndexed.length > 0
    ? `; last indexed ${status.lastIndexed}`
    : "";
  return {
    detail: `repository index is initialized${lastIndexed}`,
    state: "ready"
  };
}

function getToolStatuses(config) {
  const requirements = [
    { name: "git" },
    { name: "node" },
    { minimumVersion: config.bunMinimum, name: "bun" },
    { exactVersion: config.pnpmVersion, name: "pnpm" },
    { name: "codegraph" }
  ];
  return requirements.map(getToolStatus);
}

function getEnvironmentStatus(config) {
  const tools = getToolStatuses(config);
  const dependencies = getDependencyStatus(config, tools);
  const codegraphIndex = getCodeGraphIndexStatus(tools);
  return {
    codegraphIndex,
    dependencies,
    ready: tools.every(({ state }) => state === "ready")
      && dependencies.state === "ready"
      && codegraphIndex.state === "ready",
    tools
  };
}

function printEnvironmentStatus(status) {
  console.log(`Project environment: ${repoRoot}`);
  for (const tool of status.tools) {
    if (tool.state === "ready") {
      console.log(`[ok]       ${tool.name} ${tool.version.text}`);
    } else {
      const version = tool.version ? ` ${tool.version.text}` : "";
      console.log(
        `[${tool.state}] ${tool.name}${version} - ${tool.detail}`
      );
    }
  }

  if (status.dependencies.state === "ready") {
    console.log(
      `[ok]       project dependencies - ${status.dependencies.detail}`
    );
  } else {
    console.log(
      `[${status.dependencies.state}] project dependencies - ${status.dependencies.detail}`
    );
  }

  if (status.codegraphIndex.state === "ready") {
    console.log(
      `[ok]       codegraph index - ${status.codegraphIndex.detail}`
    );
  } else {
    console.log(
      `[${status.codegraphIndex.state}] codegraph index - ${status.codegraphIndex.detail}`
    );
  }

  if (status.ready) {
    console.log("Environment is ready.");
  } else {
    const codegraphTool = status.tools.find(
      ({ name }) => name === "codegraph"
    );
    if (codegraphTool?.state !== "ready") {
      console.log(
        "CodeGraph is a global prerequisite and is not installed by this script."
      );
      console.log(
        "Environment is not ready. Make codegraph available on PATH, "
          + "then run: node scripts/env.js install"
      );
    } else {
      console.log("Environment is not ready. Run: node scripts/env.js install");
    }
  }
}

function installWithNpm(packageSpec) {
  const npmStatus = getToolStatus({ name: "npm" });
  if (npmStatus.state !== "ready") {
    throw new Error(
      `npm is required to install ${packageSpec}: ${npmStatus.detail}`
    );
  }
  requireSuccessfulCommand("npm", ["install", "--global", packageSpec]);
}

function installPnpm(version) {
  if (resolveCommand("corepack")) {
    console.log(`Installing pnpm ${version.text} with Corepack...`);
    requireSuccessfulCommand("corepack", [
      "install",
      "--global",
      `pnpm@${version.text}`
    ]);
    requireSuccessfulCommand("corepack", ["enable", "pnpm"]);
    return;
  }

  console.log(
    `Corepack is unavailable; installing pnpm ${version.text} with npm...`
  );
  installWithNpm(`pnpm@${version.text}`);
}

function installEnvironment(config) {
  let toolStatuses = getToolStatuses(config);
  const bootstrapFailures = toolStatuses.filter(
    ({ name, state }) => (name === "git" || name === "node") && state !== "ready"
  );
  if (bootstrapFailures.length > 0) {
    throw new Error(
      `install these cross-platform prerequisites first: ${bootstrapFailures
        .map(({ detail, name }) => `${name} (${detail})`)
        .join(", ")}`
    );
  }

  const bunStatus = toolStatuses.find(({ name }) => name === "bun");
  if (bunStatus.state !== "ready") {
    console.log(
      `Installing Bun with npm to satisfy >= ${config.bunMinimum.text}...`
    );
    installWithNpm("bun@latest");
    toolStatuses = getToolStatuses(config);
  }

  const pnpmStatus = toolStatuses.find(({ name }) => name === "pnpm");
  if (pnpmStatus.state !== "ready") {
    installPnpm(config.pnpmVersion);
    toolStatuses = getToolStatuses(config);
  }

  const unreadyTools = toolStatuses.filter(({ state }) => state !== "ready");
  const unreadyManagedTools = unreadyTools.filter(
    ({ name }) => name !== "codegraph"
  );
  if (unreadyManagedTools.length > 0) {
    throw new Error(
      `tool installation did not produce a ready environment: ${unreadyManagedTools
        .map(({ detail, name }) => `${name} (${detail})`)
        .join(", ")}`
    );
  }

  console.log("Installing project dependencies from pnpm-lock.yaml...");
  requireSuccessfulCommand("pnpm", ["install", "--frozen-lockfile"]);

  const codegraphStatus = toolStatuses.find(
    ({ name }) => name === "codegraph"
  );
  if (codegraphStatus?.state !== "ready") {
    throw new Error(
      `the global codegraph command is required and is not installed by this script: ${
        codegraphStatus?.detail ?? "unknown status"
      }`
    );
  }

  console.log("Initializing and synchronizing the CodeGraph index...");
  requireSuccessfulCommand("codegraph", ["init", "."]);
  requireSuccessfulCommand("codegraph", ["sync", "--quiet", "."]);

  const finalStatus = getEnvironmentStatus(config);
  printEnvironmentStatus(finalStatus);
  if (!finalStatus.ready) {
    throw new Error(
      "installation completed but the final environment check failed"
    );
  }
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

try {
  const action = parseAction(process.argv.slice(2));
  const config = readEnvironmentConfig();
  if (action === "install") {
    installEnvironment(config);
  } else {
    const status = getEnvironmentStatus(config);
    printEnvironmentStatus(status);
    if (!status.ready) {
      process.exitCode = 1;
    }
  }
} catch (error) {
  console.error(`project environment failed: ${errorMessage(error)}`);
  process.exitCode = 1;
}

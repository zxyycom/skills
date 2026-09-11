import path from "node:path";
import {
  compareVersions,
  dependencyNamesFrom,
  parseVersion
} from "./environment-config.js";
import { errorMessage, repoRoot, runCommand } from "./environment-command.js";
import { getRepositorySetupStatus } from "./setup-repository.js";

const projectAstGrepVersion = "0.45.1";
export const globalPrerequisiteRecoveries = {
  codegraph: "Make CodeGraph available on PATH.",
  scc: "Install SCC 4.0.0 with: go install github.com/boyter/scc/v4@v4.0.0"
};
export const globalPrerequisiteNames = new Set(
  Object.keys(globalPrerequisiteRecoveries)
);

export function getToolStatus(requirement) {
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
    requirement.exactVersion &&
    compareVersions(version, requirement.exactVersion) !== 0
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
    requirement.minimumVersion &&
    compareVersions(version, requirement.minimumVersion) < 0
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
  const listResult = runCommand("pnpm", ["list", "--depth", "0", "--json"]);
  if (listResult.resolutionError || listResult.exitCode !== 0) {
    return {
      detail: `pnpm list failed: ${listResult.resolutionError ?? listResult.output}`,
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
  return missingNames.length > 0
    ? {
        detail: `missing direct dependencies: ${missingNames.join(", ")}`,
        state: "missing"
      }
    : {
        detail: `${config.dependencyNames.length} direct dependencies are installed`,
        state: "ready"
      };
}

function getProjectAstGrepStatus(config) {
  if (!config.dependencyNames.includes("@ast-grep/cli")) {
    return {
      detail: "not required by this package manifest",
      state: "not-applicable"
    };
  }
  const executable = path.join(
    repoRoot,
    "node_modules",
    ".bin",
    process.platform === "win32" ? "ast-grep.cmd" : "ast-grep"
  );
  const result = runCommand(executable, ["--version"]);
  if (result.resolutionError) {
    return {
      detail:
        "install project dependencies with pnpm install --frozen-lockfile",
      state: "missing"
    };
  }
  if (result.exitCode !== 0) {
    return {
      detail: `--version failed: ${result.output || `exit ${result.exitCode}`}`,
      state: "error"
    };
  }
  if (result.stdout !== `ast-grep ${projectAstGrepVersion}`) {
    return {
      detail: `expected ast-grep ${projectAstGrepVersion}, received ${result.stdout || result.stderr || "no version output"}`,
      state: "mismatch"
    };
  }
  return { detail: result.stdout, state: "ready" };
}

function getCodeGraphIndexStatus(toolStatuses) {
  const toolStatus = toolStatuses.find(({ name }) => name === "codegraph");
  if (toolStatus?.state !== "ready") {
    return {
      detail:
        "the global codegraph command must be ready before its index can be checked",
      state: "blocked"
    };
  }
  const result = runCommand("codegraph", ["status", "--json", "."]);
  if (result.resolutionError || result.exitCode !== 0) {
    return {
      detail: `codegraph status failed: ${result.resolutionError ?? result.output}`,
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
    typeof status !== "object" ||
    status === null ||
    typeof status.initialized !== "boolean"
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
  const lastIndexed =
    typeof status.lastIndexed === "string" && status.lastIndexed.length > 0
      ? `; last indexed ${status.lastIndexed}`
      : "";
  return {
    detail: `repository index is initialized${lastIndexed}`,
    state: "ready"
  };
}

export function getToolStatuses(config) {
  return [
    { name: "git" },
    { minimumVersion: config.nodeMinimum, name: "node" },
    { minimumVersion: config.bunMinimum, name: "bun" },
    { exactVersion: config.pnpmVersion, name: "pnpm" },
    { name: "codegraph" },
    {
      exactVersion: { major: 4, minor: 0, patch: 0, text: "4.0.0" },
      name: "scc"
    }
  ].map(getToolStatus);
}

export function unreadyGlobalPrerequisites(toolStatuses) {
  return toolStatuses.filter(
    ({ name, state }) => globalPrerequisiteNames.has(name) && state !== "ready"
  );
}

export function globalPrerequisiteRecovery(tool) {
  return globalPrerequisiteRecoveries[tool.name] ?? "Restore it on PATH.";
}

export function requireReadyGlobalPrerequisites(toolStatuses) {
  const unreadyTools = unreadyGlobalPrerequisites(toolStatuses);
  if (unreadyTools.length === 0) return;
  throw new Error(
    "these global prerequisites must be restored before setup; this script does not install them: " +
      unreadyTools
        .map(
          (tool) =>
            `${tool.name} (${tool.detail}). ${globalPrerequisiteRecovery(tool)}`
        )
        .join(", ")
  );
}

export function getEnvironmentStatus(config) {
  const tools = getToolStatuses(config);
  const dependencies = getDependencyStatus(config, tools);
  const astGrep = getProjectAstGrepStatus(config);
  const codegraphIndex = getCodeGraphIndexStatus(tools);
  const gitStatus = tools.find(({ name }) => name === "git");
  const repository =
    gitStatus?.state === "ready"
      ? getRepositorySetupStatus(repoRoot)
      : {
          detail: "git must be ready before repository setup can be checked",
          state: "blocked"
        };
  return {
    codegraphIndex,
    astGrep,
    dependencies,
    repository,
    ready:
      tools.every(({ state }) => state === "ready") &&
      dependencies.state === "ready" &&
      (astGrep.state === "ready" || astGrep.state === "not-applicable") &&
      codegraphIndex.state === "ready" &&
      repository.state === "ready",
    tools
  };
}

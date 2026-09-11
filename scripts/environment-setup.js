import {
  repoRoot,
  requireSuccessfulCommand,
  resolveCommand
} from "./environment-command.js";
import { printEnvironmentStatus } from "./environment-output.js";
import {
  getEnvironmentStatus,
  getToolStatus,
  getToolStatuses,
  globalPrerequisiteNames,
  requireReadyGlobalPrerequisites
} from "./environment-status.js";
import { setupRepository } from "./setup-repository.js";

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

function assertBootstrapTools(toolStatuses) {
  const bootstrapFailures = toolStatuses.filter(
    ({ name, state }) =>
      (name === "git" || name === "node") && state !== "ready"
  );
  if (bootstrapFailures.length > 0) {
    throw new Error(
      `install these cross-platform prerequisites first: ${bootstrapFailures
        .map(({ detail, name }) => `${name} (${detail})`)
        .join(", ")}`
    );
  }
}

function assertManagedTools(toolStatuses) {
  const unreadyManagedTools = toolStatuses.filter(
    ({ name, state }) => state !== "ready" && !globalPrerequisiteNames.has(name)
  );
  if (unreadyManagedTools.length > 0) {
    throw new Error(
      `tool installation did not produce a ready environment: ${unreadyManagedTools
        .map(({ detail, name }) => `${name} (${detail})`)
        .join(", ")}`
    );
  }
}

export function setupEnvironment(config) {
  let toolStatuses = getToolStatuses(config);
  assertBootstrapTools(toolStatuses);
  requireReadyGlobalPrerequisites(toolStatuses);

  console.log(
    "Configuring repository-local hooks and task coordination root..."
  );
  setupRepository(repoRoot);

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
  assertManagedTools(toolStatuses);

  console.log("Installing project dependencies from pnpm-lock.yaml...");
  requireSuccessfulCommand("pnpm", ["install", "--frozen-lockfile"]);
  console.log("Initializing and synchronizing the CodeGraph index...");
  requireSuccessfulCommand("codegraph", ["init", "."]);
  requireSuccessfulCommand("codegraph", ["sync", "--quiet", "."]);

  const finalStatus = getEnvironmentStatus(config);
  printEnvironmentStatus(finalStatus);
  if (!finalStatus.ready) {
    throw new Error("setup completed but the final environment check failed");
  }
}

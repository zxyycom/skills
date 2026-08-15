import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";
import { validateOxlintConfiguration } from "./lib/oxc-config.ts";
import { rootDir } from "./lib/project.ts";
import { isMainModule } from "../tools/shared/src/node/main-module.ts";

type OxlintInvocation = {
  arguments_: readonly string[];
  workspaceRoot: string;
};

type RunOxlint = (invocation: OxlintInvocation) => Promise<number>;

type RunLintOptions = {
  arguments_?: readonly string[];
  report?: (message: string) => void;
  runOxlint?: RunOxlint;
  workspaceRoot?: string;
};

const oxlintBaseArguments = ["--type-aware", "--deny-warnings"] as const;
const require = createRequire(import.meta.url);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function resolveOxlintExecutable(): string {
  const packageJsonPath = require.resolve("oxlint/package.json");
  const packageJson: unknown = require(packageJsonPath);
  if (!isRecord(packageJson) || !isRecord(packageJson.bin)) {
    throw new Error(
      "Could not resolve the installed Oxlint executable; reinstall dependencies with pnpm install --frozen-lockfile."
    );
  }
  const executable = packageJson.bin.oxlint;
  if (typeof executable !== "string") {
    throw new Error(
      "Could not resolve the installed Oxlint executable; reinstall dependencies with pnpm install --frozen-lockfile."
    );
  }
  return path.resolve(path.dirname(packageJsonPath), executable);
}

function resolveOxlintArguments(
  arguments_: readonly string[]
): readonly string[] {
  if (arguments_.length === 0) {
    return [...oxlintBaseArguments, "scripts", "tools"];
  }
  if (arguments_.length === 1 && arguments_[0] === "--fix") {
    return [...oxlintBaseArguments, "--fix", "scripts", "tools"];
  }
  throw new Error("lint accepts no arguments or the --fix option");
}

async function executeOxlint({
  arguments_,
  workspaceRoot
}: OxlintInvocation): Promise<number> {
  const executablePath = resolveOxlintExecutable();
  const child = spawn(process.execPath, [executablePath, ...arguments_], {
    cwd: workspaceRoot,
    stdio: "inherit",
    windowsHide: true
  });
  return await new Promise<number>((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (exitCode) => resolve(exitCode ?? 1));
  });
}

export async function runLint({
  arguments_ = process.argv.slice(2),
  report = console.error,
  runOxlint = executeOxlint,
  workspaceRoot = rootDir
}: RunLintOptions = {}): Promise<number> {
  try {
    const oxlintArguments = resolveOxlintArguments(arguments_);
    await validateOxlintConfiguration(workspaceRoot);
    return await runOxlint({
      arguments_: oxlintArguments,
      workspaceRoot
    });
  } catch (error) {
    report(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

if (isMainModule(import.meta.url)) {
  try {
    process.exitCode = await runLint();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

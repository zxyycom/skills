import { spawnSync } from "node:child_process";
import { accessSync, constants as fsConstants } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

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

function commandExtensions(command) {
  if (process.platform !== "win32" || path.extname(command) !== "") {
    return [""];
  }
  return [...(process.env.PATHEXT ?? ".COM;.EXE;.BAT;.CMD").split(";"), ""];
}

function isAccessibleCommand(candidate) {
  try {
    accessSync(
      candidate,
      process.platform === "win32" ? fsConstants.F_OK : fsConstants.X_OK
    );
    return true;
  } catch {
    return false;
  }
}

export function resolveCommand(command) {
  const hasDirectory = command.includes("/") || command.includes("\\");
  const directories = hasDirectory
    ? [""]
    : (process.env.PATH ?? "").split(path.delimiter);

  for (const directory of directories) {
    if (!hasDirectory && directory.length === 0) continue;
    for (const extension of commandExtensions(command)) {
      const candidate = hasDirectory
        ? `${command}${extension}`
        : path.join(directory, `${command}${extension}`);
      if (isAccessibleCommand(candidate)) return candidate;
    }
  }
  return null;
}

function quoteWindowsCommandArgument(value) {
  if (/[\r\n%]/u.test(value)) {
    throw new Error(`unsupported Windows command argument: ${value}`);
  }
  return `"${value.replaceAll('"', '""')}"`;
}

export function runCommand(command, args, { inherit = false } = {}) {
  const resolvedCommand = resolveCommand(command);
  if (!resolvedCommand) {
    return {
      exitCode: null,
      output: "",
      resolutionError: `${command} was not found on PATH`
    };
  }

  const isWindowsBatch =
    process.platform === "win32" && /\.(?:bat|cmd)$/iu.test(resolvedCommand);
  const executable = isWindowsBatch
    ? (process.env.ComSpec ?? "cmd.exe")
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
    stderr: inherit ? "" : (result.stderr?.trim() ?? ""),
    stdout: inherit ? "" : (result.stdout?.trim() ?? "")
  };
}

export function requireSuccessfulCommand(command, args) {
  const result = runCommand(command, args, { inherit: true });
  if (result.resolutionError) throw new Error(result.resolutionError);
  if (result.exitCode !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed with exit code ${result.exitCode ?? "unknown"}`
    );
  }
}

export function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

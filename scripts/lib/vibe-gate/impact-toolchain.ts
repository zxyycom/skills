import { spawn } from "node:child_process";
import { compareText, sha256 } from "./impact-values.ts";

const shellBookkeepingEnvironmentNames = new Set(["_", "OLDPWD", "SHLVL"]);

type CommandCapture = (
  command: string,
  arguments_: readonly string[],
  cwd: string
) => Promise<Buffer>;

export type CaptureDependencies = Readonly<{
  captureCommand?: CommandCapture;
  environment?: Readonly<Record<string, string | undefined>>;
}>;

export async function captureCommand(
  command: string,
  arguments_: readonly string[],
  cwd: string
): Promise<Buffer> {
  return await new Promise((resolve, reject) => {
    const child = spawn(command, arguments_, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let totalBytes = 0;
    const append = (target: Buffer[], chunk: Buffer): void => {
      totalBytes += chunk.byteLength;
      if (totalBytes > 16_777_216) {
        child.kill();
        reject(new Error(`${command} output exceeded the Gate capture limit`));
        return;
      }
      target.push(chunk);
    };
    child.stdout.on("data", (chunk: Buffer) => append(stdout, chunk));
    child.stderr.on("data", (chunk: Buffer) => append(stderr, chunk));
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) {
        resolve(Buffer.concat(stdout));
        return;
      }
      reject(
        new Error(
          `${command} ${arguments_.join(" ")} exited with ${String(code)}: ${Buffer.concat(stderr).toString("utf8").trim()}`
        )
      );
    });
  });
}

async function commandIdentity(
  runCommand: CommandCapture,
  command: string,
  arguments_: readonly string[],
  workspaceRoot: string
): Promise<string> {
  return sha256([await runCommand(command, arguments_, workspaceRoot)]);
}

export async function toolchainFingerprint(
  workspaceRoot: string,
  dependencies: CaptureDependencies
): Promise<string> {
  const runCommand = dependencies.captureCommand ?? captureCommand;
  const environment = dependencies.environment ?? process.env;
  const environmentDigest = sha256([
    JSON.stringify(
      Object.entries(environment)
        .filter(([name]) => !shellBookkeepingEnvironmentNames.has(name))
        .map(([name, value]) => [name, value ?? null] as const)
        .sort(([left], [right]) => compareText(left, right))
    )
  ]);
  const [bunToolchain, gitConfiguration, gitVersion, sccVersion] =
    await Promise.all([
      (async () => ({
        astGrepVersion: await commandIdentity(
          runCommand,
          "bun",
          ["x", "--no-install", "ast-grep", "--version"],
          workspaceRoot
        ),
        bunDependencyState: await commandIdentity(
          runCommand,
          "bun",
          ["pm", "ls", "--all"],
          workspaceRoot
        ),
        bunVersion: await commandIdentity(
          runCommand,
          "bun",
          ["--version"],
          workspaceRoot
        ),
        oxfmtVersion: await commandIdentity(
          runCommand,
          "bun",
          ["x", "--no-install", "oxfmt", "--version"],
          workspaceRoot
        ),
        oxlintVersion: await commandIdentity(
          runCommand,
          "bun",
          ["x", "--no-install", "oxlint", "--version"],
          workspaceRoot
        ),
        tsgoVersion: await commandIdentity(
          runCommand,
          "bun",
          ["x", "--no-install", "tsgo", "--version"],
          workspaceRoot
        )
      }))(),
      commandIdentity(
        runCommand,
        "git",
        ["config", "--null", "--list"],
        workspaceRoot
      ),
      commandIdentity(runCommand, "git", ["--version"], workspaceRoot),
      commandIdentity(runCommand, "scc", ["--version"], workspaceRoot)
    ]);
  return sha256([
    JSON.stringify({
      arch: process.arch,
      ...bunToolchain,
      environmentDigest,
      execPath: process.execPath,
      gitConfiguration,
      gitVersion,
      node: process.versions.node,
      platform: process.platform,
      sccVersion
    })
  ]);
}

/*
 * Synced TypeScript runtime; repository maintenance edits tools/shared/src/version-control/git-command.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/shared/src/version-control/git-command.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/shared/src/version-control/git-command.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/test-evidence-review
 * Rebuild: bun run sync:test-evidence-cli
 */
import { execFile } from "node:child_process";
import { simpleGit, type SimpleGit } from "simple-git";

const gitMaxConcurrentProcesses = 4;
const gitOutputMaxBuffer = 16 * 1024 * 1024;

export type GitCommandExit = Readonly<{
  exitCode: number;
  stderr: string;
  stdout: string;
}>;

export function createGitClient(baseDir: string): SimpleGit {
  return simpleGit({
    baseDir,
    maxConcurrentProcesses: gitMaxConcurrentProcesses,
    trimmed: false
  });
}

export function runGitForExitCode(
  rootDirectory: string,
  args: readonly string[],
  environment?: NodeJS.ProcessEnv
): Promise<GitCommandExit> {
  return runGitProcess(rootDirectory, args, environment);
}

export function runGitWithInputForExitCode(
  rootDirectory: string,
  args: readonly string[],
  input: Uint8Array,
  environment?: NodeJS.ProcessEnv
): Promise<GitCommandExit> {
  return runGitProcess(rootDirectory, args, environment, input);
}

function runGitProcess(
  rootDirectory: string,
  args: readonly string[],
  environment: NodeJS.ProcessEnv | undefined,
  input?: Uint8Array
): Promise<GitCommandExit> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const child = execFile(
      "git",
      ["-C", rootDirectory, ...args],
      {
        encoding: "utf8",
        env: environment,
        maxBuffer: gitOutputMaxBuffer,
        windowsHide: true
      },
      (error, stdout, stderr) => {
        if (settled) return;
        settled = true;
        if (error === null) {
          resolve({ exitCode: 0, stderr, stdout });
          return;
        }
        const exitCode = typeof error.code === "number" ? error.code : null;
        if (exitCode === null) {
          reject(error);
          return;
        }
        resolve({ exitCode, stderr, stdout });
      }
    );
    if (input === undefined) return;
    if (child.stdin === null) {
      settled = true;
      child.kill();
      reject(new Error("Git standard input is unavailable"));
      return;
    }
    child.stdin.on("error", (error) => {
      if (settled) return;
      settled = true;
      child.kill();
      reject(error);
    });
    child.stdin.end(input);
  });
}

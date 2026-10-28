/*
 * Synced TypeScript runtime; repository maintenance edits tools/shared/src/version-control/git-command.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/shared/src/version-control/git-command.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/shared/src/version-control/git-command.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
import { execFile, type ExecException } from "node:child_process";
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
    let inputError: Error | null = null;
    let completion: {
      error: ExecException | null;
      stdout: string;
      stderr: string;
    } | null = null;
    let closed = false;
    let escalation: ReturnType<typeof setTimeout> | undefined;
    function finish(): void {
      if (!closed || completion === null) return;
      if (escalation !== undefined) clearTimeout(escalation);
      if (inputError !== null) {
        reject(inputError);
        return;
      }
      const { error, stdout, stderr } = completion;
      if (error === null) {
        resolve({ exitCode: 0, stderr, stdout });
        return;
      }
      const exitCode = typeof error.code === "number" ? error.code : null;
      if (exitCode === null) reject(error);
      else resolve({ exitCode, stderr, stdout });
    }
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
        completion = { error, stdout, stderr };
        finish();
      }
    );
    child.once("close", () => {
      closed = true;
      finish();
    });
    if (input === undefined) return;
    function stopAfterInputError(error: Error): void {
      if (inputError !== null || completion !== null || closed) return;
      inputError = error;
      signalChild();
      escalation = setTimeout(() => signalChild("SIGKILL"), 250);
      escalation.unref();
    }
    function signalChild(signal?: NodeJS.Signals): void {
      try {
        child.kill(signal);
      } catch {
        // Only child close proves settlement; escalation still runs after a failed signal.
      }
    }
    if (child.stdin === null) {
      stopAfterInputError(new Error("Git standard input is unavailable"));
      return;
    }
    child.stdin.on("error", stopAfterInputError);
    child.stdin.end(input);
  });
}

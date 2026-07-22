import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type HeadDecisionPathsResult = {
  errors: string[];
  paths: Set<string>;
};

export async function loadHeadDecisionPaths(
  decisionsDirectory: string
): Promise<HeadDecisionPathsResult> {
  try {
    return {
      errors: [],
      paths: parseDecisionPaths(await runGit(decisionsDirectory, [
        "ls-tree",
        "-r",
        "-z",
        "--name-only",
        "HEAD",
        "--",
        "."
      ]))
    };
  } catch (error) {
    if (await hasUnbornHead(decisionsDirectory)) {
      return { errors: [], paths: new Set() };
    }
    return {
      errors: [
        "Git HEAD decision paths are unavailable for "
        + decisionsDirectory
        + ": "
        + errorText(error)
      ],
      paths: new Set()
    };
  }
}

async function hasUnbornHead(decisionsDirectory: string): Promise<boolean> {
  try {
    const symbolicHead = await runGit(decisionsDirectory, [
      "symbolic-ref",
      "-q",
      "HEAD"
    ]);
    if (symbolicHead.trim().length === 0) {
      return false;
    }
  } catch {
    return false;
  }

  try {
    await runGit(decisionsDirectory, [
      "rev-parse",
      "--verify",
      "--quiet",
      "HEAD"
    ]);
    return false;
  } catch (error) {
    return isMissingRevision(error);
  }
}

function isMissingRevision(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const processError = error as Error & {
    code?: unknown;
    stderr?: unknown;
  };
  return processError.code === 1
    && typeof processError.stderr === "string"
    && processError.stderr.trim().length === 0;
}

function parseDecisionPaths(output: string): Set<string> {
  return new Set(
    output
      .split("\0")
      .filter((candidate) => candidate.endsWith(".md"))
  );
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function runGit(
  workingDirectory: string,
  args: readonly string[]
): Promise<string> {
  const result = await execFileAsync(
    "git",
    ["-C", workingDirectory, ...args],
    {
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
      windowsHide: true
    }
  );
  return result.stdout;
}

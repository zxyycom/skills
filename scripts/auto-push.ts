#!/usr/bin/env bun

import { spawnSync } from "node:child_process";
import type { SpawnSyncReturns } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const targetBranch = "main";
const targetRef = `refs/heads/${targetBranch}`;
const targetRemote = "origin";
const throttleIntervalMilliseconds = 60 * 60 * 1000;
const throttleRef = "refs/codex/auto-push/last-attempt";
const maximumReservationAttempts = 8;
const objectIdPattern = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u;
const timestampPattern = /^(?:0|[1-9]\d*)$/u;

type GitResult = SpawnSyncReturns<string>;

type GitOptions = Readonly<{
  environment?: NodeJS.ProcessEnv;
  input?: string;
}>;

type SkipReason = "missing-origin" | "not-main" | "throttled";

type AutoPushResult =
  | Readonly<{ state: "pushed" }>
  | Readonly<{ reason: SkipReason; state: "skipped" }>
  | Readonly<{ reason: string; state: "rejected" }>;

function git(
  cwd: string,
  args: readonly string[],
  options: GitOptions = {}
): GitResult {
  return spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    env: options.environment ?? process.env,
    input: options.input,
    stdio: "pipe",
    windowsHide: true
  });
}

function commandFailure(result: GitResult): string {
  const detail = [result.stderr, result.stdout]
    .filter((value) => typeof value === "string" && value.trim().length > 0)
    .join("\n")
    .trim();
  return result.error?.message || detail || `exit ${result.status}`;
}

function requireGitResult(
  cwd: string,
  args: readonly string[],
  options?: GitOptions
): GitResult {
  const result = git(cwd, args, options);
  if (result.error || result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${commandFailure(result)}`);
  }
  return result;
}

function requireGitOutput(
  cwd: string,
  args: readonly string[],
  options?: GitOptions
): string {
  return requireGitResult(cwd, args, options).stdout.trim();
}

function parseObjectId(raw: string, source: string): string {
  if (!objectIdPattern.test(raw)) {
    throw new Error(`${source} returned an invalid object ID: ${raw}`);
  }
  return raw;
}

function currentBranch(cwd: string): string | null {
  const args = ["symbolic-ref", "--quiet", "HEAD"];
  const result = git(cwd, args);
  if (!result.error && result.status === 1) return null;
  if (result.error || result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${commandFailure(result)}`);
  }
  return result.stdout.trim();
}

function remoteExists(cwd: string): boolean {
  const args = ["remote", "get-url", targetRemote];
  const result = git(cwd, args);
  if (!result.error && result.status === 2) return false;
  if (result.error || result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${commandFailure(result)}`);
  }
  return true;
}

function readThrottleObjectId(cwd: string): string | null {
  const args = ["rev-parse", "--verify", "--quiet", throttleRef];
  const result = git(cwd, args);
  if (!result.error && result.status === 1) return null;
  if (result.error || result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${commandFailure(result)}`);
  }
  return parseObjectId(result.stdout.trim(), `git ${args.join(" ")}`);
}

function readAttemptTime(cwd: string, objectId: string): number {
  const raw = requireGitResult(cwd, ["cat-file", "blob", objectId]).stdout;
  if (!timestampPattern.test(raw)) {
    throw new Error(
      `${throttleRef} must point to a blob containing an integer timestamp`
    );
  }
  const timestamp = Number(raw);
  if (!Number.isSafeInteger(timestamp)) {
    throw new Error(
      `${throttleRef} timestamp is outside the safe integer range`
    );
  }
  return timestamp;
}

function writeAttemptObject(cwd: string, timestamp: number): string {
  return parseObjectId(
    requireGitOutput(cwd, ["hash-object", "-w", "--stdin"], {
      input: String(timestamp)
    }),
    "git hash-object"
  );
}

function reserveAttempt(cwd: string, timestamp: number): boolean {
  for (let attempt = 0; attempt < maximumReservationAttempts; attempt += 1) {
    const previousObjectId = readThrottleObjectId(cwd);
    if (previousObjectId !== null) {
      const previousTimestamp = readAttemptTime(cwd, previousObjectId);
      if (timestamp - previousTimestamp < throttleIntervalMilliseconds) {
        return false;
      }
    }

    const nextObjectId = writeAttemptObject(cwd, timestamp);
    const args = [
      "update-ref",
      "--no-deref",
      throttleRef,
      nextObjectId,
      previousObjectId ?? "0".repeat(nextObjectId.length)
    ];
    const update = git(cwd, args);
    if (!update.error && update.status === 0) return true;
    if (
      update.error ||
      update.status === null ||
      readThrottleObjectId(cwd) === previousObjectId
    ) {
      throw new Error(
        `git ${args.join(" ")} failed: ${commandFailure(update)}`
      );
    }
  }
  throw new Error(`could not reserve ${throttleRef} after concurrent updates`);
}

function runAutoPush(
  cwd: string = process.cwd(),
  timestamp: number = Date.now()
): AutoPushResult {
  const root = path.resolve(cwd);
  if (!Number.isSafeInteger(timestamp) || timestamp < 0) {
    throw new Error("auto-push timestamp must be a non-negative safe integer");
  }
  if (currentBranch(root) !== targetRef) {
    return { state: "skipped", reason: "not-main" };
  }
  if (!remoteExists(root)) {
    return { state: "skipped", reason: "missing-origin" };
  }
  if (!reserveAttempt(root, timestamp)) {
    return { state: "skipped", reason: "throttled" };
  }

  const push = git(
    root,
    ["push", "--porcelain", targetRemote, `${targetRef}:${targetRef}`],
    { environment: { ...process.env, GIT_TERMINAL_PROMPT: "0" } }
  );
  if (push.error || push.status !== 0) {
    return { state: "rejected", reason: commandFailure(push) };
  }
  return { state: "pushed" };
}

function runAutoPushCli(): number {
  try {
    const result = runAutoPush();
    if (result.state === "pushed") {
      console.log(`[auto-push] pushed ${targetRemote}/${targetBranch}`);
      return 0;
    }
    if (result.state === "rejected") {
      console.error(
        `[auto-push] ${targetRemote}/${targetBranch} was not pushed: ${result.reason}`
      );
      return 1;
    }
    return 0;
  } catch (error) {
    console.error(
      `[auto-push] skipped: ${error instanceof Error ? error.message : String(error)}`
    );
    return 1;
  }
}

const entryPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (entryPath === fileURLToPath(import.meta.url)) {
  process.exitCode = runAutoPushCli();
}

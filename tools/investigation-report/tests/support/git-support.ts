import { execFileSync } from "node:child_process";

export function git(root: string, args: readonly string[]): string {
  return execFileSync("git", ["-C", root, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
}

/** Commits the current workspace tree so tests stage against a fixed baseline. */
export function initializeGit(root: string): void {
  git(root, ["init", "--quiet"]);
  git(root, ["config", "user.email", "test@example.invalid"]);
  git(root, ["config", "user.name", "Test"]);
  git(root, ["add", "."]);
  git(root, ["commit", "--quiet", "-m", "initial"]);
}

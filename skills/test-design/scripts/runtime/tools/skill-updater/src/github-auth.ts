/*
 * Synced TypeScript runtime; repository maintenance edits tools/skill-updater/src/github-auth.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/skill-updater/src/github-auth.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/skill-updater/src/github-auth.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/test-design
 * Rebuild: bun run sync:skill-updaters
 */
import childProcess from "node:child_process";
import process from "node:process";

export type GitHubCliFailureReason =
  | "not-installed"
  | "timed-out"
  | "command-failed"
  | "empty-output"
  | "invalid-output";

const githubTokenPattern = /^[\x21-\x7e]+$/u;

export type GitHubAuthentication = Readonly<
  { token: string } | { token: null; reason: GitHubCliFailureReason }
>;

/** Resolve once per CLI invocation, after validating the local target. */
export function resolveGitHubAuthentication(): GitHubAuthentication {
  const environmentToken =
    process.env.GITHUB_TOKEN?.trim() || process.env.GH_TOKEN?.trim();
  if (environmentToken) {
    if (!githubTokenPattern.test(environmentToken)) {
      throw new Error(
        "GITHUB_TOKEN/GH_TOKEN must contain only visible ASCII characters without whitespace."
      );
    }
    return { token: environmentToken };
  }

  return readGitHubCliAuthentication(process.env);
}

function readGitHubCliAuthentication(
  environment: Readonly<NodeJS.ProcessEnv>
): GitHubAuthentication {
  // Blank overrides must not mask gh's stored login credentials either.
  const ghEnvironment = { ...environment };
  delete ghEnvironment.GITHUB_TOKEN;
  delete ghEnvironment.GH_TOKEN;
  const result = childProcess.spawnSync(
    "gh",
    ["auth", "token", "--hostname", "github.com"],
    {
      encoding: "utf8",
      env: ghEnvironment,
      timeout: 5_000,
      maxBuffer: 16 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
      windowsHide: true
    }
  );
  if (result.error) {
    const code = "code" in result.error ? result.error.code : null;
    const reason =
      code === "ENOENT"
        ? "not-installed"
        : code === "ETIMEDOUT"
          ? "timed-out"
          : "command-failed";
    return { token: null, reason };
  }
  if (result.status !== 0) {
    return { token: null, reason: "command-failed" };
  }
  const token = result.stdout?.trim();
  if (!token) return { token: null, reason: "empty-output" };
  if (!githubTokenPattern.test(token)) {
    return { token: null, reason: "invalid-output" };
  }
  return { token };
}

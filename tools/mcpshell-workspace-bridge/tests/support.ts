import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type { BridgeConfig } from "../src/shared.ts";

const execFileAsync = promisify(execFile);

export type BridgeFixture = Readonly<{
  agentProject: string;
  bridgeConfig: BridgeConfig;
  cleanup(): Promise<void>;
  project: string;
  skill: string;
  staging: string;
  sshCalls: string;
}>;

async function git(directory: string, args: readonly string[]): Promise<void> {
  // Fixture commits cannot consume the caller's index, hooks, signing or Git configuration.
  const inherited = Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !name.startsWith("GIT_"))
  );
  await execFileAsync(
    "git",
    [
      "-C",
      directory,
      "-c",
      `core.hooksPath=${os.devNull}`,
      "-c",
      "commit.gpgSign=false",
      ...args
    ],
    {
      env: {
        ...inherited,
        GIT_CONFIG_NOSYSTEM: "1",
        GIT_CONFIG_GLOBAL: os.devNull
      }
    }
  );
}

export async function createBridgeFixture(
  options: Readonly<{ git?: boolean }> = {}
): Promise<BridgeFixture> {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), "mcpshell-workspace-bridge-")
  );
  try {
    const project = path.join(root, "project");
    const staging = path.join(root, "staging");
    const agentProject = path.join(root, "agent");
    const skill = path.join(agentProject, "skills", "mcpshell-workspace-tools");
    const bin = path.join(root, "bin");
    const sshCalls = path.join(root, "ssh-calls");
    await fs.writeFile(sshCalls, "");
    const failBin = path.join(root, "fail-bin");
    const commitBin = path.join(root, "commit-bin");
    await fs.mkdir(path.join(skill, "references"), { recursive: true });
    await fs.mkdir(project, { recursive: true });
    await fs.mkdir(staging, { recursive: true });
    await fs.mkdir(bin, { recursive: true });
    await fs.mkdir(failBin, { recursive: true });
    await fs.mkdir(commitBin, { recursive: true });
    await fs.writeFile(path.join(skill, ".gitignore"), "/.env.mcpshell\n");
    await fs.writeFile(
      path.join(skill, "references", "mcpshell-tools.yaml"),
      "mcp: {}\n"
    );
    await fs.writeFile(
      path.join(bin, "ssh"),
      `#!/bin/sh
printf 'called\\n' >> "$(dirname "$0")/../ssh-calls"
[ "$1" = "-T" ] && shift
backend=$1
shift
case "$backend" in
  fixture) exec /bin/sh -c "$1" ;;
  link-failure)
    PATH="$(dirname "$0")/../fail-bin:$PATH" exec /bin/sh -c "$1"
    ;;
  swap|parent-move|get-swap|destination-swap)
    PATH="$(dirname "$0"):$PATH" exec /bin/sh -c "$1"
    ;;
  marker-loss)
    marker_stderr=$(mktemp) || exit 1
    trap 'rm -f "$marker_stderr"' EXIT HUP INT TERM
    /bin/sh -c "$1" 2>"$marker_stderr"
    marker_status=$?
    sed '/^MCPSHELL_META /d' "$marker_stderr" >&2 || exit 86
    rm -f "$marker_stderr"
    [ "$marker_status" -eq 0 ] || exit "$marker_status"
    exit 255
    ;;
  post-commit-replace)
    PATH="$(dirname "$0")/../commit-bin:$PATH" exec /bin/sh -c "$1"
    ;;
  disconnect) printf 'fixture disconnect\\n' >&2; exit 255 ;;
  *) printf 'fixture rejected backend\\n' >&2; exit 255 ;;
esac
`
    );
    await fs.chmod(path.join(bin, "ssh"), 0o755);
    await fs.writeFile(
      path.join(failBin, "ln"),
      "#!/bin/sh\nprintf 'fixture ln failure\\n' >&2\nexit 1\n"
    );
    await fs.chmod(path.join(failBin, "ln"), 0o755);
    await fs.writeFile(
      path.join(commitBin, "ln"),
      `#!/bin/sh
PATH=/usr/bin:/bin ln "$@"
status=$?
[ "$status" -eq 0 ] || exit "$status"
mv "$MCPSHELL_FIXTURE_COMMIT_PARENT" "$MCPSHELL_FIXTURE_COMMIT_OUTSIDE" || exit 81
printf '%s' "$MCPSHELL_FIXTURE_COMMIT_REPLACEMENT" > "$MCPSHELL_FIXTURE_COMMIT_OUTSIDE/$MCPSHELL_FIXTURE_COMMIT_DESTINATION"
`
    );
    await fs.chmod(path.join(commitBin, "ln"), 0o755);
    await fs.writeFile(
      path.join(bin, "wc"),
      `#!/bin/sh
# wc 在已验证父目录内、接收完毕后且提交前执行。
if [ -n "\${MCPSHELL_FIXTURE_SWAP_LINK:-}" ]; then
  [ "$(pwd -P)" = "$MCPSHELL_FIXTURE_SWAP_PARENT" ] || exit 71
  [ -f .mcpshell-transfer.* ] || exit 72
  rm -f "$MCPSHELL_FIXTURE_SWAP_LINK" || exit 73
  ln -s "$MCPSHELL_FIXTURE_SWAP_OUTSIDE" "$MCPSHELL_FIXTURE_SWAP_LINK" || exit 74
  printf 'swapped-before-commit\\n' > "$MCPSHELL_FIXTURE_SWAP_EVENT" || exit 75
fi
if [ -n "\${MCPSHELL_FIXTURE_MOVE_PARENT:-}" ]; then
  [ "$(pwd -P)" = "$MCPSHELL_FIXTURE_MOVE_PARENT" ] || exit 76
  [ -f .mcpshell-transfer.* ] || exit 77
  mv "$MCPSHELL_FIXTURE_MOVE_PARENT" "$MCPSHELL_FIXTURE_MOVE_OUTSIDE" || exit 78
  mkdir -p "$MCPSHELL_FIXTURE_MOVE_PARENT" || exit 79
  printf 'moved-before-commit\\n' > "$MCPSHELL_FIXTURE_MOVE_EVENT" || exit 80
fi
if [ -n "\${MCPSHELL_FIXTURE_GET_SWAP_LINK:-}" ]; then
  rm -f "$MCPSHELL_FIXTURE_GET_SWAP_LINK" || exit 82
  ln -s "$MCPSHELL_FIXTURE_GET_SWAP_OUTSIDE" "$MCPSHELL_FIXTURE_GET_SWAP_LINK" || exit 83
fi
if [ -n "\${MCPSHELL_FIXTURE_DESTINATION_SWAP_LINK:-}" ]; then
  rm -f "$MCPSHELL_FIXTURE_DESTINATION_SWAP_LINK" || exit 84
  ln -s "$MCPSHELL_FIXTURE_DESTINATION_SWAP_OUTSIDE" "$MCPSHELL_FIXTURE_DESTINATION_SWAP_LINK" || exit 85
fi
PATH=/usr/bin:/bin exec wc "$@"
`
    );
    await fs.chmod(path.join(bin, "wc"), 0o755);
    await fs.writeFile(path.join(project, "tracked.txt"), "before\n");
    if (options.git) {
      await git(project, ["init", "-q"]);
      await git(project, ["config", "user.email", "fixture@example.invalid"]);
      await git(project, ["config", "user.name", "fixture"]);
      await git(project, ["add", "."]);
      await git(project, ["commit", "-qm", "initial"]);
    }
    return {
      agentProject,
      bridgeConfig: {
        backendHandle: "fixture",
        projectRoot: project,
        stagingRoot: staging
      },
      cleanup: () => fs.rm(root, { force: true, recursive: true }),
      project,
      skill,
      sshCalls,
      staging
    };
  } catch (error) {
    try {
      await fs.rm(root, { force: true, recursive: true });
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        "Bridge fixture setup and cleanup failed"
      );
    }
    throw error;
  }
}

export function fixtureSsh(fixture: BridgeFixture): string {
  return path.join(path.dirname(fixture.project), "bin", "ssh");
}

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
}>;

async function git(directory: string, args: string[]): Promise<void> {
  await execFileAsync("git", ["-C", directory, ...args]);
}

export async function createBridgeFixture(): Promise<BridgeFixture> {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), "mcpshell-workspace-bridge-")
  );
  const project = path.join(root, "project");
  const staging = path.join(root, "staging");
  const agentProject = path.join(root, "agent");
  const skill = path.join(agentProject, "skills", "mcpshell-workspace-tools");
  const bin = path.join(root, "bin");
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
[ "$1" = "-T" ] && shift
backend=$1
shift
case "$backend" in
  fixture) exec /bin/sh -c "$1" ;;
  swap)
    (
      attempt=0
      while [ ! -e "$MCPSHELL_FIXTURE_SWAP_PARENT"/.mcpshell-transfer.* ]; do
        attempt=$((attempt + 1))
        [ "$attempt" -lt 200 ] || exit 0
        sleep 0.005
      done
      rm -f "$MCPSHELL_FIXTURE_SWAP_LINK"
      ln -s "$MCPSHELL_FIXTURE_SWAP_OUTSIDE" "$MCPSHELL_FIXTURE_SWAP_LINK"
    ) &
    exec /bin/sh -c "$1"
    ;;
  link-failure)
    PATH="$(dirname "$0")/../fail-bin:$PATH" exec /bin/sh -c "$1"
    ;;
  parent-move)
    (
      attempt=0
      while [ ! -e "$MCPSHELL_FIXTURE_MOVE_PARENT"/.mcpshell-transfer.* ]; do
        attempt=$((attempt + 1))
        [ "$attempt" -lt 200 ] || exit 0
        sleep 0.005
      done
      mv "$MCPSHELL_FIXTURE_MOVE_PARENT" "$MCPSHELL_FIXTURE_MOVE_OUTSIDE"
      mkdir -p "$MCPSHELL_FIXTURE_MOVE_PARENT"
    ) &
    exec /bin/sh -c "$1"
    ;;
  get-swap|destination-swap)
    PATH="$(dirname "$0"):$PATH" exec /bin/sh -c "$1"
    ;;
  marker-loss)
    marker_stderr=$(mktemp) || exit 1
    /bin/sh -c "$1" 2>"$marker_stderr"
    marker_status=$?
    sed '/^MCPSHELL_META /d' "$marker_stderr" >&2
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
mv "$MCPSHELL_FIXTURE_COMMIT_PARENT" "$MCPSHELL_FIXTURE_COMMIT_OUTSIDE"
printf '%s' "$MCPSHELL_FIXTURE_COMMIT_REPLACEMENT" > "$MCPSHELL_FIXTURE_COMMIT_OUTSIDE/$MCPSHELL_FIXTURE_COMMIT_DESTINATION"
`
  );
  await fs.chmod(path.join(commitBin, "ln"), 0o755);
  await fs.writeFile(
    path.join(bin, "wc"),
    `#!/bin/sh
if [ -n "\${MCPSHELL_FIXTURE_GET_SWAP_LINK:-}" ]; then
  rm -f "$MCPSHELL_FIXTURE_GET_SWAP_LINK"
  ln -s "$MCPSHELL_FIXTURE_GET_SWAP_OUTSIDE" "$MCPSHELL_FIXTURE_GET_SWAP_LINK"
fi
if [ -n "\${MCPSHELL_FIXTURE_DESTINATION_SWAP_LINK:-}" ]; then
  rm -f "$MCPSHELL_FIXTURE_DESTINATION_SWAP_LINK"
  ln -s "$MCPSHELL_FIXTURE_DESTINATION_SWAP_OUTSIDE" "$MCPSHELL_FIXTURE_DESTINATION_SWAP_LINK"
fi
PATH=/usr/bin:/bin exec wc "$@"
`
  );
  await fs.chmod(path.join(bin, "wc"), 0o755);
  await git(project, ["init", "-q"]);
  await git(project, ["config", "user.email", "fixture@example.invalid"]);
  await git(project, ["config", "user.name", "fixture"]);
  await fs.writeFile(path.join(project, "tracked.txt"), "before\n");
  await git(project, ["add", "."]);
  await git(project, ["commit", "-qm", "initial"]);
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
    staging
  };
}

export function fixtureSsh(fixture: BridgeFixture): string {
  return path.join(path.dirname(fixture.project), "bin", "ssh");
}

/*
 * Synced TypeScript runtime; repository maintenance edits tools/mcpshell-workspace-bridge/src/runtime/runtime-contract.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/mcpshell-workspace-bridge/src/runtime/runtime-contract.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/mcpshell-workspace-bridge/src/runtime/runtime-contract.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/mcpshell-workspace-tools
 * Rebuild: bun run sync:mcpshell-workspace-bridge
 */
export type RuntimeMode = "apply-patch" | "get-file" | "put-file" | "shell";

export type RuntimeInput = Readonly<{
  command?: string;
  destinationPath?: string;
  patch?: string;
  replace?: boolean;
  sourcePath?: string;
}>;

export type RuntimeOptions = Readonly<{
  sshExecutable?: string;
  timeoutMs?: number;
}>;

export type SshResult = Readonly<{
  exitCode: number | null;
  outputLimit: "stderr" | "stdout" | null;
  spawnError: string | null;
  stderr: Buffer;
  stdout: Buffer;
  timedOut: boolean;
}>;

const defaultTimeoutMs: Readonly<Record<RuntimeMode, number>> = {
  "apply-patch": 110_000,
  "get-file": 290_000,
  "put-file": 290_000,
  shell: 110_000
};

export function operationName(
  mode: RuntimeMode
):
  | "workspace_apply_patch"
  | "workspace_get_file"
  | "workspace_put_file"
  | "workspace_shell" {
  switch (mode) {
    case "apply-patch":
      return "workspace_apply_patch";
    case "get-file":
      return "workspace_get_file";
    case "put-file":
      return "workspace_put_file";
    case "shell":
      return "workspace_shell";
  }
}

export function operationTimeoutMs(
  mode: RuntimeMode,
  runtime: RuntimeOptions
): number {
  return runtime.timeoutMs ?? defaultTimeoutMs[mode];
}

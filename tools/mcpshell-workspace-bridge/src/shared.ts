import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const textPayloadLimit = 64 * 1024;
export const capturedTextLimit = 1024 * 1024;

export type BridgeConfig = Readonly<{
  backendHandle: string;
  projectRoot: string;
  stagingRoot: string;
}>;

export type FailureKind =
  | "config_invalid"
  | "destination_exists"
  | "invalid_input"
  | "outcome_unknown"
  | "output_limit"
  | "path_rejected"
  | "protocol_error"
  | "target_exit"
  | "text_too_large"
  | "timeout"
  | "transport_failure";

export type BridgeResult = Readonly<{
  operation:
    | "workspace_apply_patch"
    | "workspace_get_file"
    | "workspace_put_file"
    | "workspace_shell";
  ok: boolean;
  failure_kind: FailureKind | null;
  target: Readonly<{
    exit_code: number | null;
    timed_out: boolean;
  }>;
  stdout: string;
  stderr: string;
  evidence?: Readonly<Record<string, boolean | number | string>>;
}>;

export class BridgeError extends Error {
  readonly failureKind: FailureKind;

  constructor(failureKind: FailureKind, message: string) {
    super(message);
    this.name = "BridgeError";
    this.failureKind = failureKind;
  }
}

export function bridgeResult(
  operation: BridgeResult["operation"],
  failureKind: FailureKind | null,
  options: Partial<Omit<BridgeResult, "operation" | "failure_kind" | "ok">> = {}
): BridgeResult {
  return {
    operation,
    ok: failureKind === null,
    failure_kind: failureKind,
    target: options.target ?? { exit_code: 0, timed_out: false },
    stdout: options.stdout ?? "",
    stderr: options.stderr ?? "",
    ...(options.evidence === undefined ? {} : { evidence: options.evidence })
  };
}

function dotenvValue(line: string): readonly [string, string] | null {
  const match = /^([A-Z][A-Z0-9_]*)=(.*)$/u.exec(line);
  return match === null ? null : [match[1], match[2]];
}

export async function readBridgeConfig(
  skillDirectory: string
): Promise<BridgeConfig> {
  const envPath = path.join(skillDirectory, ".env.mcpshell");
  let source: string;
  try {
    source = await fs.readFile(envPath, "utf8");
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new BridgeError(
      "config_invalid",
      `.env.mcpshell could not be read: ${detail}`
    );
  }

  const values = new Map<string, string>();
  for (const line of source.split(/\r?\n/u)) {
    const parsed = dotenvValue(line);
    if (parsed !== null) {
      values.set(parsed[0], parsed[1]);
    }
  }
  const backendHandle = values.get("MCPSHELL_BACKEND_HANDLE")?.trim() ?? "";
  const projectRoot = values.get("MCPSHELL_PROJECT_ROOT")?.trim() ?? "";
  const stagingRoot = values.get("MCPSHELL_STAGING_ROOT")?.trim() ?? "";
  return validateBridgeConfig({ backendHandle, projectRoot, stagingRoot });
}

export function validateBridgeConfig(config: BridgeConfig): BridgeConfig {
  for (const [name, value] of Object.entries(config)) {
    if (value.includes("\0") || value.includes("\r") || value.includes("\n")) {
      throw new BridgeError(
        "config_invalid",
        `${name} cannot contain NUL or line breaks`
      );
    }
  }
  if (config.backendHandle.length === 0) {
    throw new BridgeError(
      "config_invalid",
      "MCPSHELL_BACKEND_HANDLE must not be empty"
    );
  }
  if (!path.posix.isAbsolute(config.projectRoot)) {
    throw new BridgeError(
      "config_invalid",
      "MCPSHELL_PROJECT_ROOT must be a POSIX absolute path"
    );
  }
  if (!path.isAbsolute(config.stagingRoot)) {
    throw new BridgeError(
      "config_invalid",
      "MCPSHELL_STAGING_ROOT must be an absolute local path"
    );
  }
  return config;
}

export function skillDirectoryFromScriptUrl(scriptUrl: string): string {
  return path.dirname(path.dirname(fileURLToPath(scriptUrl)));
}

export function agentProjectDirectoryFromSkillDirectory(
  skillDirectory: string
): string {
  const skillsDirectory = path.dirname(skillDirectory);
  if (path.basename(skillsDirectory) !== "skills") {
    throw new BridgeError(
      "config_invalid",
      "bridge script must be installed below <agent-project>/skills/<skill-name>/scripts"
    );
  }
  return path.dirname(skillsDirectory);
}

export function isMainModule(scriptUrl: string): boolean {
  const entry = process.argv[1];
  return (
    entry !== undefined && pathToFileURL(path.resolve(entry)).href === scriptUrl
  );
}

export function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

export function validateRelativePath(value: string, label: string): string {
  if (
    value.length === 0 ||
    path.isAbsolute(value) ||
    value.includes("\u0000")
  ) {
    throw new BridgeError(
      "path_rejected",
      `${label} must be a non-empty relative path`
    );
  }
  const segments = value.split(/[\\/]/u);
  if (
    segments.some(
      (segment) =>
        segment.length === 0 ||
        segment === "." ||
        segment === ".." ||
        segment === ".git"
    )
  ) {
    throw new BridgeError(
      "path_rejected",
      `${label} cannot contain empty, ., .., or .git path segments`
    );
  }
  return segments.join(path.sep);
}

export function parseReplace(value: string | undefined): boolean {
  if (value === undefined || value === "false") {
    return false;
  }
  if (value === "true") {
    return true;
  }
  throw new BridgeError("invalid_input", "replace must be true or false");
}

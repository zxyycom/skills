import { createHash, randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import { createReadStream, createWriteStream } from "node:fs";
import path from "node:path";
import { finished } from "node:stream/promises";
import {
  BridgeError,
  bridgeResult,
  isMainModule,
  parseReplace,
  readBridgeConfig,
  shellQuote,
  skillDirectoryFromScriptUrl,
  textPayloadLimit,
  validateBridgeConfig,
  validateRelativePath,
  type BridgeConfig,
  type BridgeResult,
  type FailureKind
} from "./shared.ts";

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

type SshResult = Readonly<{
  exitCode: number | null;
  spawnError: string | null;
  stderr: Buffer;
  stdout: Buffer;
  timedOut: boolean;
}>;

const defaultTimeoutMs = 60_000;
const metadataPrefix = "MCPSHELL_META ";

const remotePutScript = String.raw`
set -eu
root=$1
destination_relative=$2
replace=$3
expected_bytes=$4
expected_sha=$5
fail() { printf '%s\n' "$1" >&2; exit 64; }
relative_path_ok() {
  case "$1" in ''|/*) return 1 ;; esac
  case "/$1/" in */../*|*/.git/*) return 1 ;; esac
  return 0
}
hash_file() {
  if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | awk '{print $1}';
  elif command -v shasum >/dev/null 2>&1; then shasum -a 256 "$1" | awk '{print $1}';
  else fail 'remote SHA-256 tool is unavailable'; fi
}
relative_path_ok "$destination_relative" || fail 'destination path rejected'
root_real=$(cd "$root" && pwd -P) || fail 'project root unavailable'
destination="$root/$destination_relative"
destination_parent=$(dirname "$destination")
destination_basename=$(basename "$destination")
parent_real=$(cd "$destination_parent" && pwd -P) || fail 'destination parent unavailable'
case "$parent_real/" in "$root_real/"*) ;; *) fail 'destination escaped project root' ;; esac
# Keep the verified directory open as cwd. All later paths are relative to this
# directory object, so a lexical symlink replacement cannot redirect the write.
cd "$parent_real" || fail 'destination parent unavailable'
within_root() {
  current_parent=$(pwd -P) || return 1
  case "$current_parent/" in "$root_real/"*) return 0 ;; *) return 1 ;; esac
}
[ ! -L "$destination_basename" ] || fail 'destination symlink rejected'
temp=$(mktemp "./.mcpshell-transfer.XXXXXX") || fail 'remote temporary file unavailable'
cleanup() { rm -f "$temp"; }
trap cleanup 0 HUP INT TERM
cat > "$temp"
actual_bytes=$(wc -c < "$temp" | tr -d ' ')
actual_sha=$(hash_file "$temp")
[ "$actual_bytes" = "$expected_bytes" ] || fail 'remote byte count mismatch'
[ "$actual_sha" = "$expected_sha" ] || fail 'remote SHA-256 mismatch'
within_root || fail 'destination escaped project root before commit'
if [ "$replace" = false ]; then
  if ln "$temp" "$destination_basename" 2>/dev/null; then
    :
  elif [ -e "$destination_basename" ] || [ -L "$destination_basename" ]; then
    fail 'destination exists'
  else
    fail 'atomic no-replace link failed'
  fi
else
  mv -f "$temp" "$destination_basename"
fi
within_root || fail 'destination final containment cannot be confirmed'
printf 'MCPSHELL_META %s %s\n' "$actual_bytes" "$actual_sha" >&2
`;

const remoteGetScript = String.raw`
set -eu
root=$1
source_relative=$2
fail() { printf '%s\n' "$1" >&2; exit 64; }
relative_path_ok() {
  case "$1" in ''|/*) return 1 ;; esac
  case "/$1/" in */../*|*/.git/*) return 1 ;; esac
  return 0
}
hash_file() {
  if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | awk '{print $1}';
  elif command -v shasum >/dev/null 2>&1; then shasum -a 256 "$1" | awk '{print $1}';
  else fail 'remote SHA-256 tool is unavailable'; fi
}
relative_path_ok "$source_relative" || fail 'source path rejected'
root_real=$(cd "$root" && pwd -P) || fail 'project root unavailable'
source="$root/$source_relative"
source_parent=$(dirname "$source")
source_basename=$(basename "$source")
parent_real=$(cd "$source_parent" && pwd -P) || fail 'source parent unavailable'
case "$parent_real/" in "$root_real/"*) ;; *) fail 'source escaped project root' ;; esac
# Read through a hard-link snapshot in the verified physical parent, never through
# the lexical source path after its parent has been resolved.
cd "$parent_real" || fail 'source parent unavailable'
within_root() {
  current_parent=$(pwd -P) || return 1
  case "$current_parent/" in "$root_real/"*) return 0 ;; *) return 1 ;; esac
}
[ -f "$source_basename" ] || fail 'source is not a regular file'
[ ! -L "$source_basename" ] || fail 'source symlink rejected'
snapshot=$(mktemp "./.mcpshell-read.XXXXXX") || fail 'remote source snapshot unavailable'
rm -f "$snapshot" || fail 'remote source snapshot unavailable'
cleanup() { rm -f "$snapshot"; }
trap cleanup 0 HUP INT TERM
ln "$source_basename" "$snapshot" 2>/dev/null || fail 'remote source snapshot unavailable'
[ -f "$snapshot" ] || fail 'source is not a regular file'
[ ! -L "$snapshot" ] || fail 'source symlink rejected'
within_root || fail 'source escaped project root'
bytes=$(wc -c < "$snapshot" | tr -d ' ')
sha=$(hash_file "$snapshot")
cat "$snapshot"
within_root || fail 'source escaped project root'
printf 'MCPSHELL_META %s %s\n' "$bytes" "$sha" >&2
`;

const remoteShellStatusScript = String.raw`
set +e
root=$1
marker=$2
cd -- "$root"
status=$?
if [ "$status" -eq 0 ]; then
  /bin/sh
  status=$?
fi
printf 'MCPSHELL_TARGET_STATUS %s %s\n' "$marker" "$status" >&2
exit 0
`;

const remotePatchStatusScript = String.raw`
set +e
root=$1
marker=$2
cd -- "$root"
status=$?
if [ "$status" -eq 0 ]; then
  git apply --whitespace=nowarn --
  status=$?
fi
printf 'MCPSHELL_TARGET_STATUS %s %s\n' "$marker" "$status" >&2
exit 0
`;

function operationName(mode: RuntimeMode): BridgeResult["operation"] {
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

function remoteCommand(script: string, args: readonly string[]): string {
  return `/bin/sh -c ${shellQuote(script)} sh ${args.map(shellQuote).join(" ")}`;
}

async function runSsh(
  options: Readonly<{
    config: BridgeConfig;
    input?: Buffer | ReturnType<typeof createReadStream>;
    output?: ReturnType<typeof createWriteStream>;
    remoteCommand: string;
    runtime: RuntimeOptions;
  }>
): Promise<SshResult> {
  const child = spawn(
    options.runtime.sshExecutable ?? "ssh",
    ["-T", options.config.backendHandle, options.remoteCommand],
    { detached: process.platform !== "win32" }
  );
  const stdoutChunks: Buffer[] = [];
  const stderrChunks: Buffer[] = [];
  let spawnError: string | null = null;
  let timedOut = false;
  const timeoutGraceMs = 50;

  const signalProcessGroup = (signal: NodeJS.Signals): void => {
    if (child.pid === undefined) {
      return;
    }
    try {
      if (process.platform !== "win32") {
        process.kill(-child.pid, signal);
      } else {
        child.kill(signal);
      }
    } catch {
      child.kill(signal);
    }
  };

  let killTimer: ReturnType<typeof setTimeout> | undefined;
  const timeout = setTimeout(() => {
    timedOut = true;
    signalProcessGroup("SIGTERM");
    killTimer = setTimeout(() => signalProcessGroup("SIGKILL"), timeoutGraceMs);
  }, options.runtime.timeoutMs ?? defaultTimeoutMs);

  let resolveClose: (code: number | null) => void = () => undefined;
  const closed = new Promise<number | null>((resolve) => {
    resolveClose = resolve;
    child.once("close", resolve);
  });
  child.once("error", (error: Error) => {
    spawnError = error.message;
    options.output?.end();
    resolveClose(null);
  });
  child.stdin.on("error", () => undefined);
  child.stderr.on("data", (chunk: Buffer) =>
    stderrChunks.push(Buffer.from(chunk))
  );
  if (options.output === undefined) {
    child.stdout.on("data", (chunk: Buffer) =>
      stdoutChunks.push(Buffer.from(chunk))
    );
  } else {
    child.stdout.pipe(options.output);
  }
  if (options.input === undefined) {
    child.stdin.end();
  } else if (Buffer.isBuffer(options.input)) {
    child.stdin.end(options.input);
  } else {
    options.input.pipe(child.stdin);
  }

  const exitCode = await closed;
  clearTimeout(timeout);
  if (killTimer !== undefined) {
    clearTimeout(killTimer);
  }
  if (options.output !== undefined) {
    await finished(options.output);
  }
  return {
    exitCode,
    spawnError,
    stderr: Buffer.concat(stderrChunks),
    stdout: Buffer.concat(stdoutChunks),
    timedOut
  };
}

function sshFailureKind(
  result: SshResult,
  targetExitCode: number | null = null
): FailureKind | null {
  if (targetExitCode !== null) {
    return targetExitCode === 0 ? null : "target_exit";
  }
  if (result.timedOut) {
    return "timeout";
  }
  if (
    result.spawnError !== null ||
    result.exitCode === 255 ||
    result.exitCode === null
  ) {
    return "transport_failure";
  }
  return result.exitCode === 0 ? null : "target_exit";
}

function resultFromSsh(
  operation: BridgeResult["operation"],
  result: SshResult,
  targetExitCode: number | null = null,
  evidence?: Readonly<Record<string, boolean | number | string>>
): BridgeResult {
  return bridgeResult(operation, sshFailureKind(result, targetExitCode), {
    evidence,
    stderr: result.stderr.toString("utf8"),
    stdout: result.stdout.toString("utf8"),
    target: {
      exit_code: targetExitCode ?? result.exitCode,
      timed_out: result.timedOut
    }
  });
}

function statusMarkerFromStderr(
  stderr: Buffer,
  marker: string
): Readonly<{ invalid: boolean; remainder: Buffer; status: number | null }> {
  const prefix = `MCPSHELL_TARGET_STATUS ${marker} `;
  let status: number | null = null;
  const remaining: string[] = [];
  let invalid = false;
  for (const line of stderr.toString("utf8").split(/\r?\n/u)) {
    if (!line.startsWith(prefix)) {
      remaining.push(line);
      continue;
    }
    const parsed = Number(line.slice(prefix.length));
    if (!Number.isSafeInteger(parsed) || parsed < 0 || status !== null) {
      invalid = true;
      continue;
    }
    status = parsed;
  }
  return {
    invalid,
    remainder: Buffer.from(remaining.join("\n").replace(/\n+$/u, ""), "utf8"),
    status
  };
}

function remoteStatusInvocation(
  script: string,
  projectRoot: string
): Readonly<{ marker: string; remoteCommand: string }> {
  const marker = randomBytes(16).toString("hex");
  return {
    marker,
    remoteCommand: remoteCommand(script, [projectRoot, marker])
  };
}

function resultFromTargetStatus(
  operation: BridgeResult["operation"],
  ssh: SshResult,
  marker: string
): BridgeResult {
  const parsed = statusMarkerFromStderr(ssh.stderr, marker);
  if (
    parsed.invalid ||
    (parsed.status === null && ssh.exitCode === 0 && !ssh.timedOut)
  ) {
    return bridgeResult(operation, "protocol_error", {
      stderr:
        parsed.remainder.toString("utf8") ||
        "target status marker is missing or invalid",
      stdout: ssh.stdout.toString("utf8"),
      target: { exit_code: null, timed_out: ssh.timedOut }
    });
  }
  return resultFromSsh(
    operation,
    { ...ssh, stderr: parsed.remainder },
    parsed.status
  );
}

function textInput(value: string | undefined, label: string): string {
  if (value === undefined || value.length === 0) {
    throw new BridgeError(
      "invalid_input",
      `${label} must be a non-empty string`
    );
  }
  if (Buffer.byteLength(value, "utf8") > textPayloadLimit) {
    throw new BridgeError(
      "text_too_large",
      `${label} exceeds the ${textPayloadLimit} byte limit`
    );
  }
  return value;
}

function patchPath(pathValue: string): void {
  if (pathValue === "/dev/null") {
    return;
  }
  if (pathValue.startsWith('"') || pathValue.includes("\t")) {
    throw new BridgeError(
      "path_rejected",
      "quoted or timestamped patch paths are unsupported"
    );
  }
  const withoutPrefix = /^(?:a|b)\/(.+)$/u.exec(pathValue)?.[1] ?? pathValue;
  validateRelativePath(withoutPrefix, "patch path");
}

function validatePatchPaths(patch: string): void {
  const pathPrefixes = [
    "--- ",
    "+++ ",
    "rename from ",
    "rename to ",
    "copy from ",
    "copy to "
  ];
  for (const line of patch.split(/\r?\n/u)) {
    for (const prefix of pathPrefixes) {
      if (line.startsWith(prefix)) {
        patchPath(line.slice(prefix.length));
      }
    }
    if (line.startsWith("diff --git ")) {
      const match = /^diff --git a\/(.+) b\/(.+)$/u.exec(line);
      if (match === null) {
        throw new BridgeError(
          "path_rejected",
          "patch diff header is unsupported"
        );
      }
      patchPath(match[1]);
      patchPath(match[2]);
    }
  }
}

async function fileMetadata(
  filePath: string
): Promise<Readonly<{ bytes: number; sha256: string }>> {
  const hash = createHash("sha256");
  let bytes = 0;
  for await (const chunk of createReadStream(filePath)) {
    const bytesChunk = Buffer.from(chunk);
    bytes += bytesChunk.length;
    hash.update(bytesChunk);
  }
  return { bytes, sha256: hash.digest("hex") };
}

function metadataFromStderr(stderr: Buffer): Readonly<{
  metadata: Readonly<{ bytes: number; sha256: string }> | null;
  remainder: string;
}> {
  const lines = stderr.toString("utf8").split(/\r?\n/u);
  let metadata: Readonly<{ bytes: number; sha256: string }> | null = null;
  const remaining: string[] = [];
  for (const line of lines) {
    if (!line.startsWith(metadataPrefix)) {
      remaining.push(line);
      continue;
    }
    const match = /^MCPSHELL_META ([0-9]+) ([a-f0-9]{64})$/u.exec(line);
    if (match === null || metadata !== null) {
      return { metadata: null, remainder: stderr.toString("utf8") };
    }
    metadata = { bytes: Number(match[1]), sha256: match[2] };
  }
  return { metadata, remainder: remaining.join("\n").replace(/\n+$/u, "") };
}

async function resolveLocalPath(
  root: string,
  relativePath: string,
  label: string
): Promise<string> {
  const normalized = validateRelativePath(relativePath, label);
  const rootReal = await fs.realpath(root);
  const resolved = path.resolve(root, normalized);
  const parentReal = await fs.realpath(path.dirname(resolved));
  const inRoot =
    parentReal === rootReal || parentReal.startsWith(`${rootReal}${path.sep}`);
  if (!inRoot) {
    throw new BridgeError(
      "path_rejected",
      `${label} escaped its configured root`
    );
  }
  return resolved;
}

async function sourceFile(
  root: string,
  relativePath: string,
  label: string
): Promise<string> {
  const source = await resolveLocalPath(root, relativePath, label);
  const status = await fs.lstat(source);
  if (!status.isFile() || status.isSymbolicLink()) {
    throw new BridgeError(
      "path_rejected",
      `${label} must be a regular non-symlink file`
    );
  }
  const real = await fs.realpath(source);
  const rootReal = await fs.realpath(root);
  if (!real.startsWith(`${rootReal}${path.sep}`)) {
    throw new BridgeError(
      "path_rejected",
      `${label} escaped its configured root`
    );
  }
  return source;
}

async function resolveLocalDestination(
  root: string,
  relativePath: string,
  label: string
): Promise<string> {
  const normalized = validateRelativePath(relativePath, label);
  const rootReal = await fs.realpath(root);
  const lexicalDestination = path.resolve(root, normalized);
  const parentReal = await fs.realpath(path.dirname(lexicalDestination));
  const inRoot =
    parentReal === rootReal || parentReal.startsWith(`${rootReal}${path.sep}`);
  if (!inRoot) {
    throw new BridgeError(
      "path_rejected",
      `${label} escaped its configured root`
    );
  }
  return path.join(parentReal, path.basename(lexicalDestination));
}

async function temporaryPath(
  parent: string,
  basename: string
): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const candidate = path.join(
      parent,
      `.${basename}.mcpshell-${randomBytes(8).toString("hex")}`
    );
    try {
      const handle = await fs.open(candidate, "wx");
      await handle.close();
      return candidate;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
        throw error;
      }
    }
  }
  throw new BridgeError(
    "protocol_error",
    "could not allocate a transfer temporary file"
  );
}

async function atomicLocalReceive(
  temporary: string,
  destination: string,
  replace: boolean
): Promise<void> {
  try {
    if (replace) {
      await fs.rename(temporary, destination);
      return;
    }
    await fs.link(temporary, destination);
    await fs.unlink(temporary);
  } catch (error) {
    await fs.rm(temporary, { force: true });
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      throw new BridgeError("destination_exists", "destination already exists");
    }
    throw error;
  }
}

async function runShell(
  input: RuntimeInput,
  config: BridgeConfig,
  runtime: RuntimeOptions
): Promise<BridgeResult> {
  const command = textInput(input.command, "command");
  const invocation = remoteStatusInvocation(
    remoteShellStatusScript,
    config.projectRoot
  );
  const ssh = await runSsh({
    config,
    input: Buffer.from(command, "utf8"),
    remoteCommand: invocation.remoteCommand,
    runtime
  });
  return resultFromTargetStatus(operationName("shell"), ssh, invocation.marker);
}

async function runPatch(
  input: RuntimeInput,
  config: BridgeConfig,
  runtime: RuntimeOptions
): Promise<BridgeResult> {
  const patch = textInput(input.patch, "patch");
  validatePatchPaths(patch);
  const invocation = remoteStatusInvocation(
    remotePatchStatusScript,
    config.projectRoot
  );
  const ssh = await runSsh({
    config,
    input: Buffer.from(patch, "utf8"),
    remoteCommand: invocation.remoteCommand,
    runtime
  });
  return resultFromTargetStatus(
    operationName("apply-patch"),
    ssh,
    invocation.marker
  );
}

async function runPut(
  input: RuntimeInput,
  config: BridgeConfig,
  runtime: RuntimeOptions
): Promise<BridgeResult> {
  if (input.sourcePath === undefined || input.destinationPath === undefined) {
    throw new BridgeError(
      "invalid_input",
      "source_path and destination_path are required"
    );
  }
  const sourceRelative = validateRelativePath(input.sourcePath, "source_path");
  const destinationRelative = validateRelativePath(
    input.destinationPath,
    "destination_path"
  );
  const source = await sourceFile(
    config.stagingRoot,
    sourceRelative,
    "source_path"
  );
  const metadata = await fileMetadata(source);
  const ssh = await runSsh({
    config,
    input: createReadStream(source),
    remoteCommand: remoteCommand(remotePutScript, [
      config.projectRoot,
      destinationRelative.replaceAll(path.sep, "/"),
      String(input.replace ?? false),
      String(metadata.bytes),
      metadata.sha256
    ]),
    runtime
  });
  const parsed = metadataFromStderr(ssh.stderr);
  const result = resultFromSsh(operationName("put-file"), {
    ...ssh,
    stderr: Buffer.from(parsed.remainder, "utf8")
  });
  const evidence = {
    destination: destinationRelative.replaceAll(path.sep, "/"),
    sha256: metadata.sha256,
    bytes: metadata.bytes
  };
  const confirmed =
    parsed.metadata !== null &&
    parsed.metadata.bytes === metadata.bytes &&
    parsed.metadata.sha256 === metadata.sha256;
  const unknown = (detail: string): BridgeResult =>
    bridgeResult(result.operation, "outcome_unknown", {
      ...result,
      evidence,
      stderr: detail
    });
  if (confirmed) {
    return bridgeResult(result.operation, null, { ...result, evidence });
  }
  if (!result.ok) {
    if (ssh.spawnError !== null) {
      return result;
    }
    if (result.stderr.includes("destination exists")) {
      return bridgeResult(result.operation, "destination_exists", result);
    }
    if (result.stderr.includes("destination escaped project root")) {
      return bridgeResult(result.operation, "path_rejected", result);
    }
    const confirmedPreCommitFailure = [
      "destination path rejected",
      "project root unavailable",
      "destination parent unavailable",
      "destination symlink rejected",
      "remote temporary file unavailable",
      "remote byte count mismatch",
      "remote SHA-256 tool is unavailable",
      "remote SHA-256 mismatch",
      "atomic no-replace link failed"
    ].some((detail) => result.stderr.includes(detail));
    if (confirmedPreCommitFailure) {
      return result;
    }
    return unknown(
      result.stderr ||
        "final destination may have been committed but its acknowledgment was lost"
    );
  }
  return unknown(
    "final destination may have been committed but its acknowledgment is missing or invalid"
  );
}

async function runGet(
  input: RuntimeInput,
  config: BridgeConfig,
  runtime: RuntimeOptions
): Promise<BridgeResult> {
  if (input.sourcePath === undefined || input.destinationPath === undefined) {
    throw new BridgeError(
      "invalid_input",
      "source_path and destination_path are required"
    );
  }
  const sourceRelative = validateRelativePath(input.sourcePath, "source_path");
  const destinationRelative = validateRelativePath(
    input.destinationPath,
    "destination_path"
  );
  const destination = await resolveLocalDestination(
    config.stagingRoot,
    destinationRelative,
    "destination_path"
  );
  const temporary = await temporaryPath(
    path.dirname(destination),
    path.basename(destination)
  );
  const output = createWriteStream(temporary, { flags: "w" });
  let ssh: SshResult;
  try {
    ssh = await runSsh({
      config,
      output,
      remoteCommand: remoteCommand(remoteGetScript, [
        config.projectRoot,
        sourceRelative.replaceAll(path.sep, "/")
      ]),
      runtime
    });
  } catch (error) {
    await fs.rm(temporary, { force: true });
    throw error;
  }
  const parsed = metadataFromStderr(ssh.stderr);
  const result = resultFromSsh(operationName("get-file"), {
    ...ssh,
    stderr: Buffer.from(parsed.remainder, "utf8")
  });
  if (!result.ok) {
    await fs.rm(temporary, { force: true });
    if (result.stderr.includes("source escaped project root")) {
      return bridgeResult(result.operation, "path_rejected", result);
    }
    return result;
  }
  const local = await fileMetadata(temporary);
  if (
    parsed.metadata === null ||
    parsed.metadata.bytes !== local.bytes ||
    parsed.metadata.sha256 !== local.sha256
  ) {
    await fs.rm(temporary, { force: true });
    return bridgeResult(result.operation, "protocol_error", {
      ...result,
      stderr:
        "remote transfer metadata is missing or does not match received bytes"
    });
  }
  try {
    await atomicLocalReceive(temporary, destination, input.replace ?? false);
  } catch (error) {
    if (error instanceof BridgeError) {
      return bridgeResult(result.operation, error.failureKind, {
        ...result,
        stderr: error.message
      });
    }
    throw error;
  }
  return bridgeResult(result.operation, null, {
    ...result,
    evidence: {
      destination: destinationRelative.replaceAll(path.sep, "/"),
      sha256: local.sha256,
      bytes: local.bytes
    }
  });
}

export async function runWorkspaceOperation(
  mode: RuntimeMode,
  input: RuntimeInput,
  unsafeConfig: BridgeConfig,
  runtime: RuntimeOptions = {}
): Promise<BridgeResult> {
  try {
    const config = validateBridgeConfig(unsafeConfig);
    switch (mode) {
      case "apply-patch":
        return await runPatch(input, config, runtime);
      case "get-file":
        return await runGet(input, config, runtime);
      case "put-file":
        return await runPut(input, config, runtime);
      case "shell":
        return await runShell(input, config, runtime);
    }
  } catch (error) {
    if (error instanceof BridgeError) {
      return bridgeResult(operationName(mode), error.failureKind, {
        stderr: error.message,
        target: { exit_code: null, timed_out: false }
      });
    }
    const detail = error instanceof Error ? error.message : String(error);
    return bridgeResult(operationName(mode), "protocol_error", {
      stderr: `workspace bridge failed: ${detail}`,
      target: { exit_code: null, timed_out: false }
    });
  }
}

function modeInput(mode: RuntimeMode): RuntimeInput {
  switch (mode) {
    case "apply-patch":
      return { patch: process.env.MCPSHELL_WORKSPACE_PATCH };
    case "get-file":
      return {
        destinationPath: process.env.MCPSHELL_WORKSPACE_DESTINATION_PATH,
        replace: parseReplace(process.env.MCPSHELL_WORKSPACE_REPLACE),
        sourcePath: process.env.MCPSHELL_WORKSPACE_SOURCE_PATH
      };
    case "put-file":
      return {
        destinationPath: process.env.MCPSHELL_WORKSPACE_DESTINATION_PATH,
        replace: parseReplace(process.env.MCPSHELL_WORKSPACE_REPLACE),
        sourcePath: process.env.MCPSHELL_WORKSPACE_SOURCE_PATH
      };
    case "shell":
      return { command: process.env.MCPSHELL_WORKSPACE_COMMAND };
  }
}

async function main(): Promise<void> {
  const mode = process.argv[2] as RuntimeMode | undefined;
  if (
    mode !== "shell" &&
    mode !== "apply-patch" &&
    mode !== "put-file" &&
    mode !== "get-file"
  ) {
    throw new Error(
      "usage: mcpshell-workspace.mjs <shell|apply-patch|put-file|get-file>"
    );
  }
  let result: BridgeResult;
  try {
    const config = await readBridgeConfig(
      skillDirectoryFromScriptUrl(import.meta.url)
    );
    result = await runWorkspaceOperation(mode, modeInput(mode), config);
  } catch (error) {
    const failureKind =
      error instanceof BridgeError ? error.failureKind : "protocol_error";
    const detail = error instanceof Error ? error.message : String(error);
    result = bridgeResult(operationName(mode), failureKind, {
      stderr: detail,
      target: { exit_code: null, timed_out: false }
    });
  }
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (isMainModule(import.meta.url)) {
  await main();
}

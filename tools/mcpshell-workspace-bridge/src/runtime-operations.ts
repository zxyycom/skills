import fs from "node:fs/promises";
import { createReadStream, createWriteStream } from "node:fs";
import path from "node:path";
import {
  BridgeError,
  bridgeResult,
  capturedTextLimit,
  validateRelativePath,
  type BridgeConfig,
  type BridgeResult
} from "./shared.ts";
import {
  operationName,
  operationTimeoutMs,
  type RuntimeInput,
  type RuntimeOptions,
  type SshResult
} from "./runtime-contract.ts";
import {
  atomicLocalReceive,
  fileMetadata,
  metadataFromStderr,
  resolveLocalDestination,
  sourceFile,
  temporaryPath,
  textInput,
  validatePatchPaths
} from "./runtime-files.ts";
import {
  remoteGetScript,
  remotePatchStatusScript,
  remotePutScript,
  remoteShellStatusScript
} from "./runtime-scripts.ts";
import {
  remoteCommand,
  remoteStatusInvocation,
  resultFromSsh,
  resultFromTargetStatus,
  runSsh
} from "./runtime-ssh.ts";

export async function runShell(
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
    sshExecutable: runtime.sshExecutable,
    timeoutMs: operationTimeoutMs("shell", runtime)
  });
  return resultFromTargetStatus(operationName("shell"), ssh, invocation.marker);
}

export async function runPatch(
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
    sshExecutable: runtime.sshExecutable,
    timeoutMs: operationTimeoutMs("apply-patch", runtime)
  });
  return resultFromTargetStatus(
    operationName("apply-patch"),
    ssh,
    invocation.marker
  );
}

export async function runPut(
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
    sshExecutable: runtime.sshExecutable,
    timeoutMs: operationTimeoutMs("put-file", runtime)
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
  const confirmedPreCommitFailure = [
    "destination exists",
    "destination path rejected",
    "destination escaped project root",
    "project root unavailable",
    "destination parent unavailable",
    "destination symlink rejected",
    "remote temporary file unavailable",
    "remote byte count mismatch",
    "remote SHA-256 tool is unavailable",
    "remote SHA-256 mismatch",
    "atomic no-replace link failed"
  ].some((detail) => result.stderr.includes(detail));
  if (result.failure_kind === "output_limit") {
    if (confirmedPreCommitFailure && !confirmed) {
      return result;
    }
    return bridgeResult(result.operation, "outcome_unknown", {
      ...result,
      evidence: {
        ...evidence,
        cause: "output_limit",
        stream: ssh.outputLimit!,
        limit: capturedTextLimit
      }
    });
  }
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

export async function runGet(
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
      sshExecutable: runtime.sshExecutable,
      timeoutMs: operationTimeoutMs("get-file", runtime)
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

import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { finished } from "node:stream/promises";
import process from "node:process";
import { processTerminator } from "./runtime-ssh-process.ts";
import {
  bridgeResult,
  capturedTextLimit,
  shellQuote,
  type BridgeConfig,
  type BridgeResult,
  type FailureKind
} from "./shared.ts";
import type { SshResult } from "./runtime-contract.ts";
import { outputCollector } from "./runtime-ssh-output.ts";
import { wireSshIo } from "./runtime-ssh-io.ts";

export function remoteCommand(script: string, args: readonly string[]): string {
  return `/bin/sh -c ${shellQuote(script)} sh ${args.map(shellQuote).join(" ")}`;
}

export async function runSsh(
  options: Readonly<{
    config: BridgeConfig;
    input?: Buffer | ReturnType<typeof createReadStream>;
    output?: ReturnType<typeof createWriteStream>;
    remoteCommand: string;
    sshExecutable?: string;
    timeoutMs: number;
  }>
): Promise<SshResult> {
  const child = spawn(
    options.sshExecutable ?? "ssh",
    ["-T", options.config.backendHandle, options.remoteCommand],
    { detached: process.platform !== "win32" }
  );
  let spawnError: string | null = null;
  const terminator = processTerminator(child, 50);
  const collector = outputCollector(terminator.terminate);
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    terminator.terminate();
  }, options.timeoutMs);
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
  wireSshIo(child, options, collector);

  const exitCode = await closed;
  clearTimeout(timeout);
  terminator.clear();
  if (options.output !== undefined) {
    await finished(options.output);
  }
  return { exitCode, spawnError, timedOut, ...collector.result() };
}

function sshFailureKind(
  result: SshResult,
  targetExitCode: number | null = null
): FailureKind | null {
  if (result.outputLimit !== null) {
    return "output_limit";
  }
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

export function resultFromSsh(
  operation: BridgeResult["operation"],
  result: SshResult,
  targetExitCode: number | null = null,
  evidence?: Readonly<Record<string, boolean | number | string>>
): BridgeResult {
  const failureKind = sshFailureKind(result, targetExitCode);
  if (failureKind === "output_limit") {
    return bridgeResult(operation, failureKind, {
      evidence: { stream: result.outputLimit!, limit: capturedTextLimit },
      stderr: result.stderr.toString("utf8"),
      stdout: result.stdout.toString("utf8"),
      target: { exit_code: null, timed_out: false }
    });
  }
  return bridgeResult(operation, failureKind, {
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

export function remoteStatusInvocation(
  script: string,
  projectRoot: string
): Readonly<{ marker: string; remoteCommand: string }> {
  const marker = randomBytes(16).toString("hex");
  return {
    marker,
    remoteCommand: remoteCommand(script, [projectRoot, marker])
  };
}

export function resultFromTargetStatus(
  operation: BridgeResult["operation"],
  ssh: SshResult,
  marker: string
): BridgeResult {
  if (ssh.outputLimit !== null) {
    return resultFromSsh(operation, ssh);
  }
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

import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import type { CheckResult } from "@zxyycom/vibe-check";
import { diagnosticMessages, truncateDiagnostic } from "./diagnostics.ts";

export type GateCommand = Readonly<{
  args: readonly string[];
  command: "bun" | "node";
}>;

export type GateCommandInvocation = Readonly<{
  args: readonly string[];
  artifactDirectory?: string | null;
  command: "bun" | "node";
  cwd: string;
  signal: AbortSignal;
}>;

export type GateCommandUnavailableReason =
  | "gate-command-cancelled"
  | "gate-command-exit-unavailable"
  | "gate-command-start-failed"
  | "gate-command-transcript-unavailable";

type PackageScriptUnavailableReason =
  | "package-script-cancelled"
  | "package-script-exit-unavailable"
  | "package-script-start-failed"
  | "package-script-transcript-unavailable";

export type GateCommandRunResult =
  | Readonly<{
      exitCode: number;
      output: string;
      status: "completed";
      transcript?: string;
    }>
  | Readonly<{
      output: string;
      reason: GateCommandUnavailableReason;
      status: "unavailable";
      transcript?: string;
    }>;

export type GateCommandRunner = (
  invocation: GateCommandInvocation
) => Promise<GateCommandRunResult>;

type GateCommandContext =
  | Readonly<{ kind: "package-script"; script: string }>
  | Readonly<{ kind: "semantic" }>;

function quoteCommandArgument(argument: string): string {
  return /^[A-Za-z0-9_./,:=@+%-]+$/u.test(argument)
    ? argument
    : `'${argument.replaceAll("'", `'"'"'`)}'`;
}

export function commandText(
  invocation: Pick<GateCommandInvocation, "args" | "command">
): string {
  return [invocation.command, ...invocation.args]
    .map(quoteCommandArgument)
    .join(" ");
}

function contextReason(
  context: GateCommandContext,
  reason: GateCommandUnavailableReason
): GateCommandUnavailableReason | PackageScriptUnavailableReason {
  if (context.kind === "semantic") return reason;
  switch (reason) {
    case "gate-command-cancelled":
      return "package-script-cancelled";
    case "gate-command-exit-unavailable":
      return "package-script-exit-unavailable";
    case "gate-command-start-failed":
      return "package-script-start-failed";
    case "gate-command-transcript-unavailable":
      return "package-script-transcript-unavailable";
  }
}

function unavailableCommandResult(
  invocation: GateCommandInvocation,
  context: GateCommandContext,
  reason: GateCommandUnavailableReason,
  output: string,
  transcript?: string
) {
  const code = contextReason(context, reason);
  const primary = `Could not run ${commandText(invocation)}.${transcript === undefined ? ` Confirm the command is available, then run ${commandText(invocation)} directly.` : ` Full transcript: ${transcript}.`}`;
  return {
    status: "unavailable" as const,
    reason: { code },
    messages: diagnosticMessages(code, primary, output)
  };
}

function settleGateCommand(
  invocation: GateCommandInvocation,
  context: GateCommandContext,
  result: GateCommandRunResult
) {
  if (result.status === "unavailable") {
    return unavailableCommandResult(
      invocation,
      context,
      result.reason,
      result.output,
      result.transcript
    );
  }
  const data =
    context.kind === "semantic"
      ? {
          args: invocation.args,
          command: invocation.command,
          exitCode: result.exitCode,
          ...(result.transcript === undefined
            ? {}
            : { transcript: result.transcript })
        }
      : {
          exitCode: result.exitCode,
          script: context.script,
          ...(result.transcript === undefined
            ? {}
            : { transcript: result.transcript })
        };
  if (result.exitCode === 0) return { status: "passed" as const, data };
  const code =
    context.kind === "semantic"
      ? "gate-command-exit-nonzero"
      : "package-script-exit-nonzero";
  const primary = `${commandText(invocation)} exited with code ${result.exitCode}.${result.transcript === undefined ? ` Run ${commandText(invocation)} directly for its full diagnostic.` : ` Full transcript: ${result.transcript}.`}`;
  return {
    status: "failed" as const,
    data,
    messages: diagnosticMessages(code, primary, result.output)
  };
}

export async function runGateCommand(
  invocation: GateCommandInvocation
): Promise<GateCommandRunResult> {
  const { args, artifactDirectory, command, cwd, signal } = invocation;
  if (signal.aborted) {
    return {
      output: "",
      reason: "gate-command-cancelled",
      status: "unavailable"
    };
  }
  const transcriptPath =
    artifactDirectory === undefined || artifactDirectory === null
      ? null
      : path.join(artifactDirectory, "process.log");
  const transcriptReference =
    transcriptPath === null
      ? undefined
      : path.posix.join(
          "checks",
          path.basename(path.dirname(transcriptPath)),
          path.basename(transcriptPath)
        );
  let transcript: Awaited<ReturnType<typeof fs.open>> | null = null;
  if (transcriptPath !== null) {
    try {
      await fs.mkdir(path.dirname(transcriptPath), { recursive: true });
      transcript = await fs.open(transcriptPath, "wx");
      await transcript.writeFile(
        `command: ${commandText(invocation)}\nstatus: running\n`,
        "utf8"
      );
    } catch {
      await transcript?.close().catch(() => undefined);
      return {
        output: "",
        reason: "gate-command-transcript-unavailable",
        status: "unavailable"
      };
    }
  }

  return await new Promise((resolve) => {
    let output = "";
    let settled = false;
    let transcriptWriteFailed = false;
    let transcriptWrites = Promise.resolve();
    const child = spawn(command, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true
    });
    const appendOutput = (
      channel: "stderr" | "stdout",
      chunk: string
    ): void => {
      output = truncateDiagnostic(`${output}${chunk}`);
      if (transcript !== null) {
        transcriptWrites = transcriptWrites.then(async () => {
          if (transcriptWriteFailed) return;
          try {
            await transcript?.writeFile(
              `\n--- ${channel} ---\n${chunk}`,
              "utf8"
            );
          } catch {
            transcriptWriteFailed = true;
          }
        });
      }
    };
    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string) => appendOutput("stdout", chunk));
    child.stderr?.on("data", (chunk: string) => appendOutput("stderr", chunk));
    const unavailable = (reason: GateCommandUnavailableReason) => ({
      output,
      reason,
      status: "unavailable" as const
    });
    const finish = (result: GateCommandRunResult): void => {
      if (settled) return;
      settled = true;
      signal.removeEventListener("abort", abort);
      void (async () => {
        try {
          await transcriptWrites;
          if (transcriptWriteFailed) {
            throw new Error("Gate command transcript write failed");
          }
          if (transcript !== null) {
            await transcript.writeFile(
              `\nstatus: ${result.status === "completed" ? `exited ${result.exitCode}` : result.reason}\n`,
              "utf8"
            );
            await transcript.close();
          }
          resolve(
            transcriptReference === undefined
              ? result
              : { ...result, transcript: transcriptReference }
          );
        } catch {
          await transcript?.close().catch(() => undefined);
          resolve({
            output,
            reason: "gate-command-transcript-unavailable",
            status: "unavailable"
          });
        }
      })();
    };
    const abort = (): void => {
      child.kill("SIGTERM");
    };
    signal.addEventListener("abort", abort, { once: true });
    child.once("error", (error: Error) => {
      appendOutput("stderr", error.message);
      finish(
        unavailable(
          signal.aborted
            ? "gate-command-cancelled"
            : "gate-command-start-failed"
        )
      );
    });
    child.once("close", (exitCode) => {
      if (signal.aborted) {
        finish(unavailable("gate-command-cancelled"));
        return;
      }
      if (exitCode === null) {
        finish(unavailable("gate-command-exit-unavailable"));
        return;
      }
      finish({ exitCode, output, status: "completed" });
    });
  });
}

export async function executeGateCommand(
  input: Readonly<{
    artifactDirectory: string | null;
    command: GateCommand;
    context: GateCommandContext;
    projectRoot: string;
    runner: GateCommandRunner;
    signal: AbortSignal;
  }>
): Promise<CheckResult> {
  const invocation: GateCommandInvocation = {
    ...input.command,
    artifactDirectory: input.artifactDirectory,
    cwd: input.projectRoot,
    signal: input.signal
  };
  if (input.signal.aborted) {
    return unavailableCommandResult(
      invocation,
      input.context,
      "gate-command-cancelled",
      ""
    );
  }
  try {
    const result = await input.runner(invocation);
    if (input.signal.aborted) {
      return unavailableCommandResult(
        invocation,
        input.context,
        "gate-command-cancelled",
        result.output
      );
    }
    return settleGateCommand(invocation, input.context, result);
  } catch (error) {
    return unavailableCommandResult(
      invocation,
      input.context,
      "gate-command-start-failed",
      error instanceof Error ? error.message : String(error)
    );
  }
}

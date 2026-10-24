/*
 * Synced TypeScript runtime; repository maintenance edits tools/video-understanding/src/media-process.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/video-understanding/src/media-process.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/video-understanding/src/media-process.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/video-understanding
 * Rebuild: bun run sync:video-understanding-cli
 */
import { spawn, type ChildProcessByStdio } from "node:child_process";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import type { Readable } from "node:stream";
import {
  boundaryFailure,
  errorCode,
  failure,
  safeDiagnostic,
  type Stage
} from "./failure.ts";

interface ProcessRequest {
  readonly command: {
    readonly program: string;
    readonly args: readonly string[];
  };
  readonly env: NodeJS.ProcessEnv;
  readonly stage: Stage;
  readonly diagnostic: string;
  readonly timeout: number;
  readonly capture?: boolean;
  readonly cwd?: string;
}
interface ProcessResult {
  stdout: string;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
}
type StopKind = "timeout" | "cancelled" | "protocol";
function processOutcome(
  result: ProcessResult,
  launchCode: string | undefined,
  stopped: StopKind | undefined
) {
  if (launchCode)
    return {
      reason: `process start ${launchCode}`,
      kind: "environment",
      failed: true
    } as const;
  if (stopped) {
    const reason =
      stopped === "protocol"
        ? "stdout exceeded 8 MiB protocol limit"
        : `process ${stopped}`;
    return { reason, kind: stopped, failed: true } as const;
  }
  return {
    reason: `exit=${result.exitCode} signal=${result.signal ?? "none"}`,
    kind: "process",
    failed: result.exitCode !== 0 || result.signal !== null
  } as const;
}
async function saveStageDiagnostic(
  diagnostic: string,
  stage: Stage,
  reason: string,
  stderr: string
): Promise<void> {
  try {
    await writeFile(diagnostic, `${stage}: ${reason}\n${stderr}`, {
      flag: "wx"
    });
  } catch (error) {
    const mapped = boundaryFailure(error, { stage, target: diagnostic });
    console.error(
      safeDiagnostic(
        `stage diagnostic unavailable; media result unchanged; diagnostic may not be saved: ${mapped.message}`
      )
    );
  }
}

/** Owns bounded output collection and cancellation for one already-started child. */
function observeProcess(
  child: ChildProcessByStdio<null, Readable, Readable>,
  { env, timeout, capture = true }: ProcessRequest
) {
  let stdout = "";
  let stderr = "";
  let stdoutBytes = 0;
  let stderrBytes = 0;
  let stderrOverflow = false;
  let stopped: StopKind | undefined;
  let launchCode: string | undefined;
  let termination: Promise<void> | undefined;
  const stop = (kind: StopKind) => {
    if (stopped) return;
    stopped = kind;
    termination = terminateTree(child.pid, env);
  };
  const cancel = () => stop("cancelled");
  const timer = timeout
    ? setTimeout(() => stop("timeout"), timeout * 1000)
    : undefined;
  process.once("SIGINT", cancel);
  process.once("SIGTERM", cancel);
  child.stdout.setEncoding("utf8").on("data", (chunk: string) => {
    if (!capture || stopped) return;
    stdoutBytes += Buffer.byteLength(chunk, "utf8");
    if (stdoutBytes > 8 * 1024 * 1024) stop("protocol");
    else stdout += chunk;
  });
  child.stderr.setEncoding("utf8").on("data", (chunk: string) => {
    if (stderrOverflow) return;
    stderrBytes += Buffer.byteLength(chunk, "utf8");
    if (stderrBytes > 64 * 1024) {
      stderr = "";
      stderrOverflow = true;
    } else stderr += chunk;
  });
  return {
    finish: async () => {
      const result = await new Promise<ProcessResult>((resolve) => {
        child.once("error", (error) => {
          launchCode = errorCode(error) ?? "START_FAILED";
        });
        child.once("close", (exitCode, signal) =>
          resolve({ stdout, exitCode, signal })
        );
      });
      await termination;
      return {
        result,
        outcome: processOutcome(result, launchCode, stopped),
        stderr: stderrOverflow
          ? "stderr exceeded 64 KiB; text withheld\n"
          : safeDiagnostic(stderr)
      };
    },
    dispose: () => {
      clearTimeout(timer);
      process.removeListener("SIGINT", cancel);
      process.removeListener("SIGTERM", cancel);
    }
  };
}

export async function processOutput(request: ProcessRequest): Promise<string> {
  const { command, env, stage, diagnostic, cwd } = request;
  const { program, args } = command;
  const child = spawn(program, args, {
    env,
    cwd,
    detached: process.platform !== "win32",
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"]
  });
  const observation = observeProcess(child, request);
  try {
    const { result, outcome, stderr } = await observation.finish();
    await saveStageDiagnostic(diagnostic, stage, outcome.reason, stderr);
    if (outcome.failed) {
      throw failure(
        {
          kind: outcome.kind,
          stage,
          target: path.basename(program),
          reason: outcome.reason
        },
        `inspect ${diagnostic}; resolve the local runtime/input failure before explicitly retrying this operation`
      );
    }
    return result.stdout;
  } catch (error) {
    throw boundaryFailure(error, { stage, target: diagnostic });
  } finally {
    observation.dispose();
  }
}
async function terminateTree(
  pid: number | undefined,
  env: NodeJS.ProcessEnv
): Promise<void> {
  if (!pid) return;
  if (process.platform !== "win32") {
    try {
      process.kill(-pid, "SIGKILL");
    } catch (error) {
      if (errorCode(error) !== "ESRCH") throw error;
    }
    return;
  }
  const root = env.SystemRoot ?? env.SYSTEMROOT;
  if (!root)
    throw failure({
      kind: "environment",
      stage: "runtime",
      target: "process tree",
      reason: "SystemRoot missing for process-tree cancellation"
    });
  await new Promise<void>((resolve, reject) => {
    const killer = spawn(
      path.join(root, "System32", "taskkill.exe"),
      ["/PID", String(pid), "/T", "/F"],
      { env, windowsHide: true, stdio: "ignore" }
    );
    killer.once("error", reject);
    killer.once("close", (code) =>
      code === 0 || code === 128
        ? resolve()
        : reject(
            failure({
              kind: "environment",
              stage: "runtime",
              target: String(pid),
              reason:
                "process-tree cancellation failed; inspect residual processes"
            })
          )
    );
  });
}

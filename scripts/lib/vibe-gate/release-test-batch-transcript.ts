import fs from "node:fs/promises";
import path from "node:path";
import {
  commandText,
  type GateCommandInvocation,
  type GateCommandRunResult
} from "./command-runner.ts";

export type ReleaseTestBatchWorkerTranscript = Readonly<{
  artifactDirectory: string | null;
  index: number;
  invocation: GateCommandInvocation;
  result: GateCommandRunResult;
}>;

export async function writeSharedReleaseTestBatchTranscript(
  artifactDirectory: string | null | undefined,
  executions: readonly ReleaseTestBatchWorkerTranscript[]
): Promise<string | undefined> {
  if (artifactDirectory === undefined || artifactDirectory === null) {
    return undefined;
  }
  const transcriptPath = path.join(artifactDirectory, "process.log");
  const sections = await Promise.all(
    executions.map(
      async ({ artifactDirectory: workerDirectory, invocation, result }) => {
        if (workerDirectory !== null && result.transcript !== undefined) {
          return await fs.readFile(
            path.join(workerDirectory, "process.log"),
            "utf8"
          );
        }
        return [
          `command: ${commandText(invocation)}`,
          result.output.length === 0
            ? ""
            : `\n--- output ---\n${result.output}`,
          `\nstatus: ${result.status === "completed" ? `exited ${result.exitCode}` : result.reason}`
        ].join("\n");
      }
    )
  );
  await fs.mkdir(artifactDirectory, { recursive: true });
  await fs.writeFile(
    transcriptPath,
    [
      `release test batch workers: ${executions.length}`,
      ...sections.map(
        (section, index) => `\n=== worker ${index + 1} ===\n${section}`
      ),
      ""
    ].join("\n"),
    { encoding: "utf8", flag: "wx" }
  );
  return path.posix.join(
    "checks",
    path.basename(artifactDirectory),
    "process.log"
  );
}

export async function writeReleaseTestBatchProjectionTranscript(
  invocation: GateCommandInvocation,
  batchCommand: string,
  result: GateCommandRunResult
): Promise<GateCommandRunResult> {
  if (
    invocation.artifactDirectory === undefined ||
    invocation.artifactDirectory === null
  ) {
    return result;
  }
  const transcriptPath = path.join(invocation.artifactDirectory, "process.log");
  const transcriptReference = path.posix.join(
    "checks",
    path.basename(invocation.artifactDirectory),
    "process.log"
  );
  try {
    await fs.mkdir(invocation.artifactDirectory, { recursive: true });
    await fs.writeFile(
      transcriptPath,
      [
        `command: ${commandText(invocation)}`,
        `shared release test batch: ${batchCommand}`,
        ...(result.transcript === undefined
          ? []
          : [`complete shared transcript: ${result.transcript}`]),
        result.output.length === 0
          ? ""
          : `\n--- batch output ---\n${result.output}`,
        `\nstatus: ${result.status === "completed" ? `exited ${result.exitCode}` : result.reason}`,
        ""
      ].join("\n"),
      { encoding: "utf8", flag: "wx" }
    );
    return { ...result, transcript: transcriptReference };
  } catch {
    return {
      output: result.output,
      reason: "gate-command-transcript-unavailable",
      status: "unavailable"
    };
  }
}

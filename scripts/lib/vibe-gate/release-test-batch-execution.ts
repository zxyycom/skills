import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  type GateCommandInvocation,
  type GateCommandRunner,
  type GateCommandRunResult
} from "./command-runner.ts";
import {
  parseReleaseTestBatchReport,
  projectReleaseTestBatchResults,
  type ParsedReleaseTestSuite
} from "./release-test-batch-report.ts";
import {
  hasReusableReleaseTestBatchProof,
  publishReleaseTestBatchProof,
  reusedReleaseTestBatchResults
} from "./release-test-batch-proof.ts";
import type {
  ReleaseTestBatchGroup,
  ReleaseTestBatchProofOptions
} from "./release-test-batch.ts";
import {
  writeSharedReleaseTestBatchTranscript,
  type ReleaseTestBatchWorkerTranscript
} from "./release-test-batch-transcript.ts";

export type ReleaseTestBatchState =
  | Readonly<{
      kind: "completed";
      output: string;
      results: ReadonlyMap<string, GateCommandRunResult>;
    }>
  | Readonly<{
      kind: "unavailable";
      output: string;
      reason: Extract<
        GateCommandRunResult,
        { status: "unavailable" }
      >["reason"];
      transcript?: string;
    }>;

type BatchWorkerExecution = ReleaseTestBatchWorkerTranscript &
  Readonly<{
    files: readonly string[];
    reportPath: string;
  }>;

type ReleaseTestBatchExecutionOptions = Readonly<{
  artifactDirectory: string | null | undefined;
  files: readonly string[];
  groups: readonly ReleaseTestBatchGroup[];
  projectRoot: string;
  proofOptions: ReleaseTestBatchProofOptions | undefined;
  runner: GateCommandRunner;
  signal: AbortSignal;
  workerCount: number;
}>;

function partitionBatchFiles(
  files: readonly string[],
  workerCount: number
): readonly string[][] {
  const partitions = Array.from(
    { length: Math.min(workerCount, files.length) },
    () => [] as string[]
  );
  files.forEach((file, index) =>
    partitions[index % partitions.length]?.push(file)
  );
  return partitions;
}

function combinedWorkerOutput(
  executions: readonly BatchWorkerExecution[]
): string {
  return executions
    .map(
      ({ index, result }) =>
        `worker ${index + 1}/${executions.length}:\n${result.output}`
    )
    .join("\n");
}

function unavailableState(
  output: string,
  reason: Extract<GateCommandRunResult, { status: "unavailable" }>["reason"],
  transcript: string | undefined
): ReleaseTestBatchState {
  return {
    kind: "unavailable",
    output,
    reason,
    ...(transcript === undefined ? {} : { transcript })
  };
}

export async function executeReleaseTestBatch(
  options: ReleaseTestBatchExecutionOptions
): Promise<ReleaseTestBatchState> {
  if (
    options.proofOptions !== undefined &&
    (await hasReusableReleaseTestBatchProof(
      options.proofOptions,
      options.groups,
      options.workerCount
    ))
  ) {
    options.proofOptions.onReuse?.();
    return {
      kind: "completed",
      output: "Reused release test batch proof.",
      results: reusedReleaseTestBatchResults(options.groups)
    };
  }
  const temporaryRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "skills-release-test-batch-")
  );
  let sharedOutput = "";
  let sharedTranscript: string | undefined;
  try {
    const partitions = partitionBatchFiles(options.files, options.workerCount);
    const executions = await Promise.all(
      partitions.map(
        async (partition, index): Promise<BatchWorkerExecution> => {
          const reportPath = path.join(temporaryRoot, `junit-${index}.xml`);
          const workerArtifactDirectory =
            options.artifactDirectory === undefined ||
            options.artifactDirectory === null
              ? null
              : path.join(
                  options.artifactDirectory,
                  "workers",
                  `worker-${index + 1}`
                );
          const invocation: GateCommandInvocation = {
            args: [
              "test",
              ...partition,
              "--reporter=junit",
              `--reporter-outfile=${reportPath}`
            ],
            artifactDirectory: workerArtifactDirectory,
            command: "bun",
            cwd: options.projectRoot,
            signal: options.signal
          };
          const result = await options
            .runner(invocation)
            .catch((error): GateCommandRunResult => ({
              output: error instanceof Error ? error.message : String(error),
              reason: "gate-command-start-failed",
              status: "unavailable"
            }));
          return {
            artifactDirectory: workerArtifactDirectory,
            files: partition,
            index,
            invocation,
            reportPath,
            result
          };
        }
      )
    );
    sharedOutput = combinedWorkerOutput(executions);
    sharedTranscript = await writeSharedReleaseTestBatchTranscript(
      options.artifactDirectory,
      executions
    );
    const unavailable = executions.find(
      ({ result }) => result.status === "unavailable"
    )?.result;
    if (unavailable?.status === "unavailable") {
      return unavailableState(
        sharedOutput,
        unavailable.reason,
        sharedTranscript
      );
    }
    const suites = new Map<string, ParsedReleaseTestSuite>();
    for (const execution of executions) {
      let workerSuites: ReturnType<typeof parseReleaseTestBatchReport>;
      try {
        const report = await fs.readFile(execution.reportPath, "utf8");
        workerSuites = parseReleaseTestBatchReport(report, execution.files);
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        return unavailableState(
          `${sharedOutput}\nworker ${execution.index + 1} JUnit report ${execution.reportPath}: ${detail}`,
          "gate-command-exit-unavailable",
          sharedTranscript
        );
      }
      if (
        execution.result.status !== "completed" ||
        (execution.result.exitCode !== 0 &&
          ![...workerSuites.values()].some(({ failed }) => failed))
      ) {
        return unavailableState(
          `${sharedOutput}\nBun test batch worker ${execution.index + 1} exited nonzero without a failing JUnit suite`,
          "gate-command-exit-unavailable",
          sharedTranscript
        );
      }
      for (const [file, suite] of workerSuites) suites.set(file, suite);
    }
    const results = new Map(
      [
        ...projectReleaseTestBatchResults(options.groups, suites, sharedOutput)
      ].map(([checkId, groupResult]) => [
        checkId,
        sharedTranscript === undefined
          ? groupResult
          : { ...groupResult, transcript: sharedTranscript }
      ])
    );
    if (
      options.proofOptions !== undefined &&
      executions.every(
        ({ result }) => result.status === "completed" && result.exitCode === 0
      ) &&
      [...results.values()].every(
        (groupResult) =>
          groupResult.status === "completed" && groupResult.exitCode === 0
      )
    ) {
      await publishReleaseTestBatchProof(
        options.proofOptions,
        options.groups,
        options.projectRoot,
        options.workerCount
      );
    }
    return {
      kind: "completed",
      output: sharedOutput,
      results
    };
  } catch (error) {
    return unavailableState(
      `${sharedOutput}\n${error instanceof Error ? error.message : String(error)}`,
      "gate-command-exit-unavailable",
      sharedTranscript
    );
  } finally {
    await fs.rm(temporaryRoot, { force: true, recursive: true });
  }
}

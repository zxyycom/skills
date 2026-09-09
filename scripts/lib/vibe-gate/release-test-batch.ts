import {
  packageScriptCheckId,
  releaseBunTestPackageFiles
} from "./checks/package-script.ts";
import { semanticGateChecks } from "./checks/semantic.ts";
import type {
  GateCommandRunner,
  GateCommandRunResult
} from "./command-runner.ts";
import { executeReleaseTestBatch } from "./release-test-batch-execution.ts";
import { writeReleaseTestBatchProjectionTranscript } from "./release-test-batch-transcript.ts";

export { parseReleaseTestBatchReport } from "./release-test-batch-report.ts";

export type ReleaseTestBatchGroup = Readonly<{
  checkId: string;
  files: readonly string[];
}>;

export type ReleaseTestBatchProofOptions = Readonly<{
  cacheDirectory: string;
  cold: boolean;
  initialWorkspaceFingerprint: string;
  captureWorkspaceFingerprint?: (projectRoot: string) => Promise<string>;
  onReuse?: () => void;
}>;

const releaseTestBatchWorkerCount = 4;

export const releaseTestBatchGroups: readonly ReleaseTestBatchGroup[] =
  Object.freeze([
    ...semanticGateChecks
      .filter(
        (check) => check.command.command === "bun" && !("dependsOn" in check)
      )
      .map(({ checkId, command }) =>
        Object.freeze({
          checkId,
          files: Object.freeze([requiredTestFile(command.args)])
        })
      ),
    ...Object.entries(releaseBunTestPackageFiles).map(([script, files]) =>
      Object.freeze({
        checkId: packageScriptCheckId(
          script as keyof typeof releaseBunTestPackageFiles
        ),
        files: Object.freeze([...files])
      })
    )
  ]);

export const releaseTestBatchLeaderCheckId =
  releaseTestBatchGroups[0]?.checkId ?? "";

export const releaseTestBatchResourceClaim = {
  "cpu-work": releaseTestBatchWorkerCount,
  "external-process": 1
} as const;

function requiredTestFile(args: readonly string[]): string {
  if (
    args.length !== 2 ||
    args[0] !== "test" ||
    args[1] === undefined ||
    !args[1].startsWith("./")
  ) {
    throw new Error("Release Bun semantic Check must name one test container");
  }
  return args[1];
}

function batchFiles(
  groups: readonly ReleaseTestBatchGroup[]
): readonly string[] {
  return Object.freeze([...new Set(groups.flatMap(({ files }) => [...files]))]);
}

export type ReleaseTestBatchSession = Readonly<{
  has: (checkId: string) => boolean;
  runnerFor: (checkId: string) => GateCommandRunner;
}>;

export function createReleaseTestBatchSession(
  runner: GateCommandRunner,
  groups: readonly ReleaseTestBatchGroup[] = releaseTestBatchGroups,
  proofOptions?: ReleaseTestBatchProofOptions
): ReleaseTestBatchSession {
  const groupIds = new Set(groups.map(({ checkId }) => checkId));
  const leaderCheckId = groups[0]?.checkId ?? "";
  const files = batchFiles(groups);
  const actualWorkerCount = Math.min(releaseTestBatchWorkerCount, files.length);
  const batchCommand = `${actualWorkerCount} partitioned bun test workers over ${files.join(" ")}`;
  let state: ReturnType<typeof executeReleaseTestBatch> | undefined;
  return Object.freeze({
    has: (checkId) => groupIds.has(checkId),
    runnerFor: (checkId) => async (invocation) => {
      if (!groupIds.has(checkId)) {
        return {
          output: `Unknown release test batch Check: ${checkId}`,
          reason: "gate-command-start-failed",
          status: "unavailable"
        };
      }
      state ??= executeReleaseTestBatch({
        artifactDirectory: invocation.artifactDirectory,
        files,
        groups,
        projectRoot: invocation.cwd,
        proofOptions,
        runner,
        signal: invocation.signal,
        workerCount: releaseTestBatchWorkerCount
      });
      const settled = await state;
      const result: GateCommandRunResult =
        settled.kind === "unavailable"
          ? {
              output: settled.output,
              reason: settled.reason,
              status: "unavailable",
              ...(settled.transcript === undefined
                ? {}
                : { transcript: settled.transcript })
            }
          : (settled.results.get(checkId) ?? {
              output: `Release test batch did not produce ${checkId}`,
              reason: "gate-command-exit-unavailable",
              status: "unavailable"
            });
      return checkId === leaderCheckId && result.transcript !== undefined
        ? result
        : await writeReleaseTestBatchProjectionTranscript(
            invocation,
            batchCommand,
            result
          );
    }
  });
}

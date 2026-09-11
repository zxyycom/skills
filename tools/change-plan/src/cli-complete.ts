import { completeChangePlanDirectory } from "./complete.ts";
import type { ChangePlanCliIo } from "./cli.ts";

export async function runComplete(
  directory: string,
  preflight: boolean,
  json: boolean,
  io: ChangePlanCliIo
): Promise<number> {
  const result = await completeChangePlanDirectory(directory, { preflight });
  const successfulOutcome =
    result.outcome === "preflight" ||
    result.outcome === "completed" ||
    result.outcome === "committed-cleanup-pending";
  if (json) {
    writeLine(io.stdout, JSON.stringify(result, null, 2));
    return successfulOutcome ? 0 : 1;
  }
  if (result.outcome === "committed-cleanup-pending")
    return writeCleanupPending(result, io);
  if (result.error !== null) return writeFailure(result, io);
  if (result.outcome === "preflight") {
    writeLine(
      io.stdout,
      `Change plan completion preflight passed (${result.sourceDirectory}; HEAD ${result.headCommit}; ${result.memberCount} members).`
    );
    return 0;
  }
  writeLine(
    io.stdout,
    `Change plan ${result.outcome} (${result.sourceDirectory}; HEAD recovery ${result.headCommit}; ${result.memberCount} members).`
  );
  return 0;
}
function writeCleanupPending(
  result: Awaited<ReturnType<typeof completeChangePlanDirectory>>,
  io: ChangePlanCliIo
): number {
  writeLine(
    io.stdout,
    `Change plan committed-cleanup-pending (${result.sourceDirectory}; HEAD recovery ${result.headCommit}; ${result.memberCount} members).`
  );
  writeLine(
    io.stdout,
    `Tombstone requires cleanup: ${result.tombstoneDirectory ?? "[unavailable]"}`
  );
  if (result.error !== null)
    writeLine(io.stderr, `Cleanup diagnostic: ${result.error}`);
  return 0;
}
function writeFailure(
  result: Awaited<ReturnType<typeof completeChangePlanDirectory>>,
  io: ChangePlanCliIo
): number {
  writeLine(io.stderr, `Change plan complete failed: ${result.error}`);
  if (result.tombstoneDirectory !== null)
    writeLine(
      io.stderr,
      `Tombstone requires inspection: ${result.tombstoneDirectory}`
    );
  return 1;
}
function writeLine(writer: (text: string) => void, text: string): void {
  writer(`${text}\n`);
}

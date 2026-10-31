import {
  access,
  mkdir,
  readdir,
  realpath,
  rm,
  type FileHandle
} from "node:fs/promises";
import path from "node:path";
import type { SourceStamp } from "../evidence/evidence.ts";
import {
  boundaryFailure,
  errorCode,
  failure,
  safeDiagnostic,
  VideoFailure
} from "../failure.ts";
import { isAbsoluteLocalPath } from "../location.ts";

export async function localOutput(output: string): Promise<void> {
  const check = (file: string) => {
    if (!isAbsoluteLocalPath(file))
      throw failure({
        kind: "input",
        stage: "output",
        target: output,
        reason: "output and resolved parent must remain local (no UNC)"
      });
  };
  check(output);
  try {
    check(await realpath(path.dirname(output)));
    try {
      check(await realpath(output));
    } catch (error) {
      if (errorCode(error) !== "ENOENT") throw error;
    }
  } catch (error) {
    throw boundaryFailure(error, { stage: "output", target: output });
  }
}
export function reportCleanupFailure(
  operationFailed: boolean,
  cleanupFailure: VideoFailure
): void {
  if (!operationFailed) throw cleanupFailure;
  console.error(
    safeDiagnostic(
      `cleanup failed; primary error retained: ${cleanupFailure.message}; inspect residual resources before retrying`
    )
  );
}
export async function openDirectory(
  output: string,
  source?: SourceStamp
): Promise<boolean> {
  await localOutput(output);
  if (source) {
    try {
      await mkdir(output);
      return true;
    } catch (error) {
      if (errorCode(error) !== "EEXIST")
        throw boundaryFailure(error, { stage: "output", target: output });
    }
  }
  try {
    await access(path.join(output, "evidence.json"));
  } catch (error) {
    if (errorCode(error) !== "ENOENT")
      throw boundaryFailure(error, { stage: "output", target: output });
    return initializableDirectory(output, source);
  }
  return false;
}
async function initializableDirectory(
  output: string,
  source?: SourceStamp
): Promise<boolean> {
  try {
    await access(path.join(output, ".write-lock"));
  } catch (error) {
    if (errorCode(error) !== "ENOENT")
      throw boundaryFailure(error, { stage: "lock", target: output });
    if (source && (await readdir(output)).length === 0) return true;
    throw failure(
      {
        kind: "input",
        stage: "output",
        target: output,
        reason:
          "unknown directory; only absent or completely empty directories may be initialized"
      },
      "inspect and preserve needed data; explicit cleanup approval is required before rebuilding at this location"
    );
  }
  throw failure(
    {
      kind: "inconsistent",
      stage: "lock",
      target: output,
      reason: "writer or residual lock present"
    },
    "wait for the writer; residual lock recovery requires explicit inspection"
  );
}
export async function releaseLock(
  lock: FileHandle,
  lockFile: string,
  operationFailed: boolean
): Promise<void> {
  let cleanupFailure: VideoFailure | undefined;
  try {
    await lock.close();
  } catch (error) {
    cleanupFailure = boundaryFailure(error, {
      stage: "lock",
      target: lockFile
    });
  }
  try {
    await rm(lockFile);
  } catch (error) {
    cleanupFailure ??= boundaryFailure(error, {
      stage: "lock",
      target: lockFile
    });
  }
  if (cleanupFailure) reportCleanupFailure(operationFailed, cleanupFailure);
}

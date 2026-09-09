import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import * as v from "valibot";
import type { GateCommandRunResult } from "./command-runner.ts";
import { captureGateWorkspaceSnapshot } from "./impact.ts";
import type {
  ReleaseTestBatchGroup,
  ReleaseTestBatchProofOptions
} from "./release-test-batch.ts";

const batchPartitionVersion = 1;
const proofFormatVersion = 1;
const proofFileName = "success.json";
const fingerprintSchema = v.pipe(
  v.string(),
  v.regex(/^[a-f0-9]{64}$/u, "must be a lowercase SHA-256 digest")
);
const releaseTestBatchProofSchema = v.strictObject({
  catalogFingerprint: fingerprintSchema,
  formatVersion: v.literal(proofFormatVersion),
  outcome: v.literal("passed"),
  workspaceFingerprint: fingerprintSchema
});

type ReleaseTestBatchProof = v.InferOutput<typeof releaseTestBatchProofSchema>;

function batchCatalogFingerprint(
  groups: readonly ReleaseTestBatchGroup[],
  workerCount: number
): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        groups: groups.map(({ checkId, files }) => ({ checkId, files })),
        partitionVersion: batchPartitionVersion,
        proofFormatVersion,
        workerCount
      })
    )
    .digest("hex");
}

export async function hasReusableReleaseTestBatchProof(
  options: ReleaseTestBatchProofOptions,
  groups: readonly ReleaseTestBatchGroup[],
  workerCount: number
): Promise<boolean> {
  if (options.cold) return false;
  try {
    const parsed: unknown = JSON.parse(
      await fs.readFile(
        path.join(options.cacheDirectory, proofFileName),
        "utf8"
      )
    );
    const validated = v.safeParse(releaseTestBatchProofSchema, parsed);
    return (
      validated.success &&
      validated.output.catalogFingerprint ===
        batchCatalogFingerprint(groups, workerCount) &&
      validated.output.workspaceFingerprint ===
        options.initialWorkspaceFingerprint
    );
  } catch {
    // A missing, unreadable, or malformed optimization proof is a cache miss.
    return false;
  }
}

export async function publishReleaseTestBatchProof(
  options: ReleaseTestBatchProofOptions,
  groups: readonly ReleaseTestBatchGroup[],
  projectRoot: string,
  workerCount: number
): Promise<void> {
  try {
    const finalWorkspaceFingerprint =
      await (options.captureWorkspaceFingerprint?.(projectRoot) ??
        captureGateWorkspaceSnapshot(projectRoot).then(
          ({ workspaceFingerprint }) => workspaceFingerprint
        ));
    if (finalWorkspaceFingerprint !== options.initialWorkspaceFingerprint) {
      return;
    }
    await fs.mkdir(options.cacheDirectory, { recursive: true });
    const target = path.join(options.cacheDirectory, proofFileName);
    const temporary = path.join(
      options.cacheDirectory,
      `.${proofFileName}.${process.pid}.${randomUUID()}.tmp`
    );
    const proof: ReleaseTestBatchProof = {
      catalogFingerprint: batchCatalogFingerprint(groups, workerCount),
      formatVersion: proofFormatVersion,
      outcome: "passed",
      workspaceFingerprint: options.initialWorkspaceFingerprint
    };
    try {
      await fs.writeFile(temporary, `${JSON.stringify(proof, null, 2)}\n`, {
        mode: 0o600
      });
      await fs.rename(temporary, target);
    } catch (error) {
      await fs.rm(temporary, { force: true }).catch(() => undefined);
      throw error;
    }
  } catch {
    // Proof publication is an optimization. Its failure cannot replace a
    // freshly successful test result with an infrastructure failure.
  }
}

export function reusedReleaseTestBatchResults(
  groups: readonly ReleaseTestBatchGroup[]
): ReadonlyMap<string, GateCommandRunResult> {
  const output =
    "Reused the exact content/toolchain/environment-addressed successful release test batch proof.";
  return new Map(
    groups.map(({ checkId }) => [
      checkId,
      { exitCode: 0, output, status: "completed" as const }
    ])
  );
}

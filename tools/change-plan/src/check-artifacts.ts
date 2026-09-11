import fs from "node:fs/promises";
import path from "node:path";
import { inspectPlanVersionControl } from "./git-distance.ts";
import { validateChangePlanArtifact } from "./markdown.ts";
import { artifactContractsByStage } from "./check-contracts.ts";
import {
  emptyArtifactProgress,
  errorMessage,
  fileDiagnostic,
  lstatOrNull,
  type ArtifactProgress
} from "./check-support.ts";
import {
  changePlanMetadataName,
  type ArtifactStructureContract,
  type ChangePlanDiagnostic,
  type ChangePlanMetadata,
  type ChangePlanStage,
  type GitDistanceEvidence
} from "./types.ts";

export function addArtifactProgress(
  progress: ArtifactProgress,
  validation: ReturnType<typeof validateChangePlanArtifact>
): void {
  progress.taskCount += validation.taskCount;
  progress.completedTaskCount += validation.completedTaskCount;
  for (const section of [
    "readiness",
    "implementation",
    "verification"
  ] as const) {
    progress.taskProgress[section].taskCount +=
      validation.taskProgress[section].taskCount;
    progress.taskProgress[section].completedTaskCount +=
      validation.taskProgress[section].completedTaskCount;
  }
}
export async function validateArtifacts(
  changeDirectory: string,
  stage: ChangePlanStage,
  diagnostics: ChangePlanDiagnostic[]
): Promise<ArtifactProgress> {
  const progress = emptyArtifactProgress();
  for (const contract of artifactContractsByStage[stage]) {
    const validation = await validateArtifact(
      changeDirectory,
      contract,
      diagnostics
    );
    if (validation !== null) {
      diagnostics.push(...validation.diagnostics);
      addArtifactProgress(progress, validation);
    }
  }
  return progress;
}
async function validateArtifact(
  changeDirectory: string,
  contract: ArtifactStructureContract,
  diagnostics: ChangePlanDiagnostic[]
) {
  const artifactPath = path.join(changeDirectory, contract.file);
  const available = await readableArtifact(
    artifactPath,
    contract.file,
    diagnostics
  );
  if (!available) return null;
  try {
    return validateChangePlanArtifact(
      await fs.readFile(artifactPath, "utf8"),
      contract
    );
  } catch (error) {
    diagnostics.push(
      fileDiagnostic(
        contract.file,
        "file-read-failed",
        `cannot read or parse ${contract.file}: ${errorMessage(error)}`
      )
    );
    return null;
  }
}
async function readableArtifact(
  artifactPath: string,
  file: ArtifactStructureContract["file"],
  diagnostics: ChangePlanDiagnostic[]
): Promise<boolean> {
  let stat;
  try {
    stat = await lstatOrNull(artifactPath);
  } catch (error) {
    diagnostics.push(
      fileDiagnostic(
        file,
        "file-read-failed",
        `cannot inspect ${file}: ${errorMessage(error)}`
      )
    );
    return false;
  }
  if (stat === null) {
    diagnostics.push(
      fileDiagnostic(file, "missing-required-file", `${file} is required`)
    );
    return false;
  }
  if (stat.isSymbolicLink() || !stat.isFile()) {
    diagnostics.push(
      fileDiagnostic(
        file,
        "required-path-not-file",
        `${file} must be a regular file and not a symbolic link`
      )
    );
    return false;
  }
  return true;
}
export async function inspectGitDistance(
  changeDirectory: string,
  activeMetadata: Extract<ChangePlanMetadata, { stage: "plan" }>,
  diagnostics: ChangePlanDiagnostic[]
): Promise<GitDistanceEvidence | null> {
  try {
    const inspection = await inspectPlanVersionControl(
      changeDirectory,
      activeMetadata.baseCommit
    );
    if (inspection.outcome === "measured") return inspection.evidence;
    diagnostics.push(
      fileDiagnostic(
        changePlanMetadataName,
        "base-commit-unavailable",
        "plan baseCommit is unavailable; review the plan and run plan to record a new Git baseline"
      )
    );
  } catch (error) {
    diagnostics.push(
      fileDiagnostic(
        changePlanMetadataName,
        "version-control-failed",
        `cannot measure plan distance against version control: ${errorMessage(error)}`
      )
    );
  }
  return null;
}

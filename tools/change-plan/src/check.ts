import path from "node:path";
import {
  activeChangeDirectoryError,
  directChangeDirectoryError
} from "./active-directory.ts";
import { inspectGitDistance, validateArtifacts } from "./check-artifacts.ts";
import {
  addChangeNameDiagnostic,
  directoryDiagnostic,
  emptyArtifactProgress,
  inspectChangeDirectory,
  readActiveMetadata,
  sortDiagnostics,
  type ArtifactProgress
} from "./check-support.ts";
import type {
  ChangePlanCheckResult,
  ChangePlanDiagnostic,
  ChangePlanMetadata,
  ChangePlanStage,
  GitDistanceEvidence
} from "./types.ts";

type ChangePlanCheckOptions = {
  artifactStage?: ChangePlanStage;
  inspectGitDistance: boolean;
};
type CheckState = Readonly<{
  changeDirectory: string;
  diagnostics: readonly ChangePlanDiagnostic[];
  metadata: ChangePlanMetadata | null;
  stage: ChangePlanStage | null;
  distance: GitDistanceEvidence | null;
  progress: ArtifactProgress;
}>;
function checkResult(state: CheckState): ChangePlanCheckResult {
  const diagnostics = sortDiagnostics(state.diagnostics);
  return {
    changeDirectory: state.changeDirectory,
    changeName: path.basename(state.changeDirectory),
    ...state.progress,
    diagnostics,
    distance: state.distance,
    metadata: state.metadata,
    stage: state.stage,
    valid: diagnostics.length === 0
  };
}
async function checkChangePlanDirectoryWithOptions(
  changeDirectoryInput: string,
  options: ChangePlanCheckOptions,
  requiredChangeRoot?: string
): Promise<ChangePlanCheckResult> {
  const changeDirectory = path.resolve(changeDirectoryInput);
  const diagnostics: ChangePlanDiagnostic[] = [];
  const scopeError = await scopeErrorFor(changeDirectory, requiredChangeRoot);
  if (scopeError !== null)
    return failedScope(changeDirectory, diagnostics, scopeError);
  addChangeNameDiagnostic(changeDirectory, diagnostics);
  if (!(await inspectChangeDirectory(changeDirectory, diagnostics)))
    return failedScope(changeDirectory, diagnostics, null);
  return await inspectActiveChange(changeDirectory, diagnostics, options);
}
async function scopeErrorFor(
  changeDirectory: string,
  requiredChangeRoot?: string
): Promise<string | null> {
  return requiredChangeRoot === undefined
    ? await activeChangeDirectoryError(changeDirectory)
    : directChangeDirectoryError(changeDirectory, requiredChangeRoot);
}
function failedScope(
  changeDirectory: string,
  diagnostics: ChangePlanDiagnostic[],
  scopeError: string | null
): ChangePlanCheckResult {
  if (scopeError !== null)
    diagnostics.push(
      directoryDiagnostic("change-directory-not-active-member", scopeError)
    );
  return checkResult({
    changeDirectory,
    diagnostics,
    metadata: null,
    stage: null,
    distance: null,
    progress: emptyArtifactProgress()
  });
}
async function inspectActiveChange(
  changeDirectory: string,
  diagnostics: ChangePlanDiagnostic[],
  options: ChangePlanCheckOptions
): Promise<ChangePlanCheckResult> {
  const metadata = await readActiveMetadata(changeDirectory, diagnostics);
  const stage = metadata?.stage ?? null;
  const progress = await artifactProgress(
    changeDirectory,
    stage,
    options,
    diagnostics
  );
  const distance = await distanceEvidence(
    changeDirectory,
    metadata,
    options,
    diagnostics
  );
  return checkResult({
    changeDirectory,
    diagnostics,
    metadata,
    stage,
    distance,
    progress
  });
}
async function artifactProgress(
  changeDirectory: string,
  stage: ChangePlanStage | null,
  options: ChangePlanCheckOptions,
  diagnostics: ChangePlanDiagnostic[]
): Promise<ArtifactProgress> {
  const targetStage = options.artifactStage ?? stage;
  return targetStage === null
    ? emptyArtifactProgress()
    : await validateArtifacts(changeDirectory, targetStage, diagnostics);
}
async function distanceEvidence(
  changeDirectory: string,
  metadata: ChangePlanMetadata | null,
  options: ChangePlanCheckOptions,
  diagnostics: ChangePlanDiagnostic[]
): Promise<GitDistanceEvidence | null> {
  return options.inspectGitDistance && metadata?.stage === "plan"
    ? await inspectGitDistance(changeDirectory, metadata, diagnostics)
    : null;
}
export async function checkChangePlanDirectory(
  changeDirectoryInput: string
): Promise<ChangePlanCheckResult> {
  return await checkChangePlanDirectoryWithOptions(changeDirectoryInput, {
    inspectGitDistance: true
  });
}
export async function checkChangePlanDirectoryForPlan(
  changeDirectoryInput: string
): Promise<ChangePlanCheckResult> {
  return await checkChangePlanDirectoryWithOptions(changeDirectoryInput, {
    artifactStage: "plan",
    inspectGitDistance: false
  });
}
export async function checkChangePlanDirectoryInRoot(
  changeDirectoryInput: string,
  changeRootInput: string
): Promise<ChangePlanCheckResult> {
  return await checkChangePlanDirectoryWithOptions(
    changeDirectoryInput,
    { inspectGitDistance: true },
    changeRootInput
  );
}

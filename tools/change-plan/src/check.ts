import type { Stats } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { changePlanStatusFromDirectory } from "./change-directory.ts";
import { inspectPlanVersionControl } from "./git-distance.ts";
import { validateChangePlanArtifact } from "./markdown.ts";
import { ChangePlanMetadataError, readChangePlanMetadata } from "./metadata.ts";
import {
  changePlanMetadataName,
  type ArtifactSubsectionContract,
  type ArtifactStructureContract,
  type ChangePlanCheckResult,
  type ChangePlanDiagnostic,
  type ChangePlanFileName,
  type ChangePlanMetadata,
  type ChangePlanStage,
  type GitDistanceEvidence,
  type ChangePlanTaskProgress
} from "./types.ts";

const kebabCasePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

const requiredChangeSubsections = [
  "Intended Change",
  "Resulting Impacts"
] as const;

const scopeSubsectionContract = {
  ownerSection: "Scope",
  requiredSubsections: requiredChangeSubsections
} as const satisfies ArtifactSubsectionContract;

const decisionsSubsectionContract = {
  ownerSection: "Decisions",
  requiredSubsections: requiredChangeSubsections
} as const satisfies ArtifactSubsectionContract;

const designArtifactContract = {
  file: "design.md",
  h1: "Design",
  requiredSections: [
    "Context",
    "Goals / Non-Goals",
    "Decisions",
    "Risks / Trade-offs",
    "Open Questions"
  ],
  subsectionContracts: [decisionsSubsectionContract]
} as const satisfies ArtifactStructureContract;

const planArtifactContracts = [
  {
    file: "proposal.md",
    h1: "Proposal",
    requiredSections: [
      "Why",
      "Outcome",
      "Scope",
      "Success Criteria",
      "Affected Owners"
    ],
    subsectionContracts: [scopeSubsectionContract]
  },
  designArtifactContract,
  {
    file: "tasks.md",
    h1: "Tasks",
    requiredSections: ["Readiness", "Implementation", "Verification"],
    taskSections: ["Readiness", "Implementation", "Verification"]
  }
] as const satisfies readonly ArtifactStructureContract[];

const draftArtifactContracts = [
  {
    file: "proposal.md",
    h1: "Proposal",
    requiredSections: ["Why", "Outcome"],
    subsectionContracts: [scopeSubsectionContract]
  },
  designArtifactContract
] as const satisfies readonly ArtifactStructureContract[];

const artifactContractsByStage = {
  draft: draftArtifactContracts,
  plan: planArtifactContracts
} as const satisfies Readonly<
  Record<ChangePlanStage, readonly ArtifactStructureContract[]>
>;

type ArtifactProgress = {
  completedTaskCount: number;
  taskCount: number;
  taskProgress: ChangePlanTaskProgress;
};

type ChangePlanCheckOptions = {
  artifactStage?: ChangePlanStage;
  inspectGitDistance: boolean;
};

function emptyTaskProgress(): ChangePlanTaskProgress {
  return {
    implementation: { completedTaskCount: 0, taskCount: 0 },
    readiness: { completedTaskCount: 0, taskCount: 0 },
    verification: { completedTaskCount: 0, taskCount: 0 }
  };
}

function emptyArtifactProgress(): ArtifactProgress {
  return {
    completedTaskCount: 0,
    taskCount: 0,
    taskProgress: emptyTaskProgress()
  };
}

async function lstatOrNull(targetPath: string): Promise<Stats | null> {
  try {
    return await fs.lstat(targetPath);
  } catch (error) {
    if (
      error !== null &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return null;
    }
    throw error;
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function directoryDiagnostic(
  code: ChangePlanDiagnostic["code"],
  message: string
): ChangePlanDiagnostic {
  return { code, file: null, message };
}

function fileDiagnostic(
  file: ChangePlanFileName,
  code: ChangePlanDiagnostic["code"],
  message: string
): ChangePlanDiagnostic {
  return { code, file, message };
}

function sortDiagnostics(
  diagnostics: readonly ChangePlanDiagnostic[]
): ChangePlanDiagnostic[] {
  return [...diagnostics].sort(
    (left, right) =>
      (left.file ?? "").localeCompare(right.file ?? "") ||
      (left.line ?? 0) - (right.line ?? 0) ||
      left.code.localeCompare(right.code) ||
      left.message.localeCompare(right.message)
  );
}

function addChangeNameDiagnostic(
  changeDirectory: string,
  diagnostics: ChangePlanDiagnostic[]
): void {
  const changeName = path.basename(changeDirectory);
  if (!kebabCasePattern.test(changeName)) {
    diagnostics.push(
      directoryDiagnostic(
        "invalid-change-name",
        `change directory name must use kebab-case: ${changeName || "<empty>"}`
      )
    );
  }
}

async function inspectChangeDirectory(
  changeDirectory: string,
  diagnostics: ChangePlanDiagnostic[]
): Promise<boolean> {
  let directoryStat: Stats | null;
  try {
    directoryStat = await lstatOrNull(changeDirectory);
  } catch (error) {
    diagnostics.push(
      directoryDiagnostic(
        "change-directory-read-failed",
        `cannot inspect change directory ${changeDirectory}: ${errorMessage(error)}`
      )
    );
    return false;
  }
  if (directoryStat === null) {
    diagnostics.push(
      directoryDiagnostic(
        "change-directory-not-found",
        `change directory does not exist: ${changeDirectory}`
      )
    );
    return false;
  }
  if (directoryStat.isSymbolicLink() || !directoryStat.isDirectory()) {
    diagnostics.push(
      directoryDiagnostic(
        "change-path-not-directory",
        `change path must be a regular directory and not a symbolic link: ${changeDirectory}`
      )
    );
    return false;
  }
  return true;
}

function metadataDiagnostic(error: unknown): ChangePlanDiagnostic {
  if (!(error instanceof ChangePlanMetadataError)) {
    return fileDiagnostic(
      changePlanMetadataName,
      "file-read-failed",
      `cannot read ${changePlanMetadataName}: ${errorMessage(error)}`
    );
  }
  switch (error.code) {
    case "missing":
      return fileDiagnostic(
        changePlanMetadataName,
        "missing-required-file",
        error.message
      );
    case "invalid":
      return fileDiagnostic(
        changePlanMetadataName,
        "invalid-metadata",
        error.message
      );
    case "invalid-path":
      return fileDiagnostic(
        changePlanMetadataName,
        "required-path-not-file",
        error.message
      );
    case "io":
      return fileDiagnostic(
        changePlanMetadataName,
        "file-read-failed",
        error.message
      );
  }
}

async function readActiveMetadata(
  changeDirectory: string,
  diagnostics: ChangePlanDiagnostic[]
): Promise<ChangePlanMetadata | null> {
  try {
    return await readChangePlanMetadata(changeDirectory);
  } catch (error) {
    diagnostics.push(metadataDiagnostic(error));
    return null;
  }
}

function addArtifactProgress(
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

async function validateArtifact(
  changeDirectory: string,
  contract: ArtifactStructureContract,
  diagnostics: ChangePlanDiagnostic[]
): Promise<ReturnType<typeof validateChangePlanArtifact> | null> {
  const artifactPath = path.join(changeDirectory, contract.file);
  let artifactStat: Stats | null;
  try {
    artifactStat = await lstatOrNull(artifactPath);
  } catch (error) {
    diagnostics.push(
      fileDiagnostic(
        contract.file,
        "file-read-failed",
        `cannot inspect ${contract.file}: ${errorMessage(error)}`
      )
    );
    return null;
  }
  if (artifactStat === null) {
    diagnostics.push(
      fileDiagnostic(
        contract.file,
        "missing-required-file",
        `${contract.file} is required`
      )
    );
    return null;
  }
  if (artifactStat.isSymbolicLink() || !artifactStat.isFile()) {
    diagnostics.push(
      fileDiagnostic(
        contract.file,
        "required-path-not-file",
        `${contract.file} must be a regular file and not a symbolic link`
      )
    );
    return null;
  }

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

async function validateArtifacts(
  changeDirectory: string,
  stage: ChangePlanStage,
  diagnostics: ChangePlanDiagnostic[]
): Promise<ArtifactProgress> {
  const progress = emptyArtifactProgress();
  const artifactContracts = artifactContractsByStage[stage];

  for (const contract of artifactContracts) {
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

async function inspectGitDistance(
  changeDirectory: string,
  activeMetadata: Extract<ChangePlanMetadata, { stage: "plan" }>,
  diagnostics: ChangePlanDiagnostic[]
): Promise<GitDistanceEvidence | null> {
  try {
    const inspection = await inspectPlanVersionControl(
      changeDirectory,
      activeMetadata.baseCommit
    );
    if (inspection.outcome === "measured") {
      return inspection.evidence;
    }
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

function checkResult(
  changeDirectory: string,
  diagnostics: readonly ChangePlanDiagnostic[],
  metadata: ChangePlanMetadata | null,
  stage: ChangePlanStage | null,
  distance: GitDistanceEvidence | null,
  progress: ArtifactProgress
): ChangePlanCheckResult {
  const sortedDiagnostics = sortDiagnostics(diagnostics);
  return {
    changeDirectory,
    changeName: path.basename(changeDirectory),
    ...progress,
    diagnostics: sortedDiagnostics,
    distance,
    metadata,
    stage,
    valid: sortedDiagnostics.length === 0
  };
}

async function checkChangePlanDirectoryWithOptions(
  changeDirectoryInput: string,
  options: ChangePlanCheckOptions
): Promise<ChangePlanCheckResult> {
  const changeDirectory = path.resolve(changeDirectoryInput);
  const diagnostics: ChangePlanDiagnostic[] = [];
  if (changePlanStatusFromDirectory(changeDirectory) === "archived") {
    diagnostics.push(
      directoryDiagnostic(
        "archived-change-not-checkable",
        "archived changes are historical records and cannot be checked; use show to read the archived artifacts"
      )
    );
    return checkResult(
      changeDirectory,
      diagnostics,
      null,
      null,
      null,
      emptyArtifactProgress()
    );
  }
  addChangeNameDiagnostic(changeDirectory, diagnostics);
  if (!(await inspectChangeDirectory(changeDirectory, diagnostics))) {
    return checkResult(
      changeDirectory,
      diagnostics,
      null,
      null,
      null,
      emptyArtifactProgress()
    );
  }

  const activeMetadata = await readActiveMetadata(changeDirectory, diagnostics);
  const stage = activeMetadata?.stage ?? null;
  const artifactStage = options.artifactStage ?? stage ?? undefined;
  const progress =
    artifactStage === undefined
      ? emptyArtifactProgress()
      : await validateArtifacts(changeDirectory, artifactStage, diagnostics);

  let distance: GitDistanceEvidence | null = null;
  if (options.inspectGitDistance && activeMetadata?.stage === "plan") {
    distance = await inspectGitDistance(
      changeDirectory,
      activeMetadata,
      diagnostics
    );
  }

  return checkResult(
    changeDirectory,
    diagnostics,
    activeMetadata,
    stage,
    distance,
    progress
  );
}

export async function checkChangePlanDirectory(
  changeDirectoryInput: string
): Promise<ChangePlanCheckResult> {
  return await checkChangePlanDirectoryWithOptions(changeDirectoryInput, {
    inspectGitDistance: true
  });
}

/** @internal Plan write gate; validates target artifacts without old Git state. */
export async function checkChangePlanDirectoryForPlan(
  changeDirectoryInput: string
): Promise<ChangePlanCheckResult> {
  return await checkChangePlanDirectoryWithOptions(changeDirectoryInput, {
    artifactStage: "plan",
    inspectGitDistance: false
  });
}

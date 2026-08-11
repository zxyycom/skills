import type { Stats } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { assessChangePlan } from "./assessment.ts";
import { validateChangePlanArtifact } from "./markdown.ts";
import {
  ChangePlanMetadataError,
  readChangePlanMetadata
} from "./metadata.ts";
import {
  changePlanMetadataName,
  type ArtifactStructureContract,
  type ChangePlanAssessment,
  type ChangePlanCheckResult,
  type ChangePlanDiagnostic,
  type ChangePlanFileName,
  type ChangePlanMetadata,
  type ChangePlanStage,
  type ChangePlanTaskProgress
} from "./types.ts";

const kebabCasePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

const fullArtifactContracts: readonly ArtifactStructureContract[] = [
  {
    file: "proposal.md",
    h1: "Proposal",
    requiredSections: [
      "Why",
      "Outcome",
      "Scope",
      "Success Criteria",
      "Affected Owners"
    ]
  },
  {
    file: "design.md",
    h1: "Design",
    requiredSections: [
      "Context",
      "Goals / Non-Goals",
      "Decisions",
      "Risks / Trade-offs",
      "Open Questions"
    ]
  },
  {
    file: "tasks.md",
    h1: "Tasks",
    requiredSections: [
      "Readiness",
      "Implementation",
      "Verification"
    ],
    taskSections: [
      "Readiness",
      "Implementation",
      "Verification"
    ]
  }
];

const draftArtifactContracts: readonly ArtifactStructureContract[] = [
  {
    file: "proposal.md",
    h1: "Proposal",
    requiredSections: ["Why", "Outcome"]
  }
];

type ArtifactProgress = {
  completedTaskCount: number;
  taskCount: number;
  taskProgress: ChangePlanTaskProgress;
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
      error !== null
      && typeof error === "object"
      && "code" in error
      && error.code === "ENOENT"
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
  return [...diagnostics].sort((left, right) => (
    (left.file ?? "").localeCompare(right.file ?? "")
    || (left.line ?? 0) - (right.line ?? 0)
    || left.code.localeCompare(right.code)
    || left.message.localeCompare(right.message)
  ));
}

function isArchivedChangeDirectory(changeDirectory: string): boolean {
  return path.basename(path.dirname(changeDirectory)) === "archive";
}

function addChangeNameDiagnostic(
  changeDirectory: string,
  diagnostics: ChangePlanDiagnostic[]
): void {
  const changeName = path.basename(changeDirectory);
  if (!kebabCasePattern.test(changeName)) {
    diagnostics.push(directoryDiagnostic(
      "invalid-change-name",
      `change directory name must use kebab-case: ${changeName || "<empty>"}`
    ));
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
    diagnostics.push(directoryDiagnostic(
      "change-directory-read-failed",
      `cannot inspect change directory ${changeDirectory}: ${errorMessage(error)}`
    ));
    return false;
  }
  if (directoryStat === null) {
    diagnostics.push(directoryDiagnostic(
      "change-directory-not-found",
      `change directory does not exist: ${changeDirectory}`
    ));
    return false;
  }
  if (directoryStat.isSymbolicLink() || !directoryStat.isDirectory()) {
    diagnostics.push(directoryDiagnostic(
      "change-path-not-directory",
      `change path must be a regular directory and not a symbolic link: ${changeDirectory}`
    ));
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

async function validateArtifacts(
  changeDirectory: string,
  stage: ChangePlanStage,
  diagnostics: ChangePlanDiagnostic[]
): Promise<ArtifactProgress> {
  const progress = emptyArtifactProgress();
  const artifactContracts = stage === "draft"
    ? draftArtifactContracts
    : fullArtifactContracts;

  for (const contract of artifactContracts) {
    const artifactPath = path.join(changeDirectory, contract.file);
    let artifactStat: Stats | null;
    try {
      artifactStat = await lstatOrNull(artifactPath);
    } catch (error) {
      diagnostics.push(fileDiagnostic(
        contract.file,
        "file-read-failed",
        `cannot inspect ${contract.file}: ${errorMessage(error)}`
      ));
      continue;
    }
    if (artifactStat === null) {
      diagnostics.push(fileDiagnostic(
        contract.file,
        "missing-required-file",
        `${contract.file} is required`
      ));
      continue;
    }
    if (artifactStat.isSymbolicLink() || !artifactStat.isFile()) {
      diagnostics.push(fileDiagnostic(
        contract.file,
        "required-path-not-file",
        `${contract.file} must be a regular file and not a symbolic link`
      ));
      continue;
    }

    try {
      const validation = validateChangePlanArtifact(
        await fs.readFile(artifactPath, "utf8"),
        contract
      );
      diagnostics.push(...validation.diagnostics);
      progress.taskCount += validation.taskCount;
      progress.completedTaskCount += validation.completedTaskCount;
      for (const section of [
        "readiness",
        "implementation",
        "verification"
      ] as const) {
        progress.taskProgress[section].taskCount += (
          validation.taskProgress[section].taskCount
        );
        progress.taskProgress[section].completedTaskCount += (
          validation.taskProgress[section].completedTaskCount
        );
      }
    } catch (error) {
      diagnostics.push(fileDiagnostic(
        contract.file,
        "file-read-failed",
        `cannot read or parse ${contract.file}: ${errorMessage(error)}`
      ));
    }
  }
  return progress;
}

function checkResult(
  changeDirectory: string,
  diagnostics: readonly ChangePlanDiagnostic[],
  metadata: ChangePlanMetadata | null,
  assessment: ChangePlanAssessment | null,
  progress: ArtifactProgress
): ChangePlanCheckResult {
  const sortedDiagnostics = sortDiagnostics(diagnostics);
  return {
    assessment,
    changeDirectory,
    changeName: path.basename(changeDirectory),
    ...progress,
    diagnostics: sortedDiagnostics,
    metadata,
    stage: metadata?.stage ?? null,
    valid: sortedDiagnostics.length === 0
  };
}

export async function checkChangePlanDirectory(
  changeDirectoryInput: string,
  artifactStageOverride?: ChangePlanStage
): Promise<ChangePlanCheckResult> {
  const changeDirectory = path.resolve(changeDirectoryInput);
  const diagnostics: ChangePlanDiagnostic[] = [];
  addChangeNameDiagnostic(changeDirectory, diagnostics);
  if (!await inspectChangeDirectory(changeDirectory, diagnostics)) {
    return checkResult(
      changeDirectory,
      diagnostics,
      null,
      null,
      emptyArtifactProgress()
    );
  }

  const archived = isArchivedChangeDirectory(changeDirectory);
  const metadata = archived
    ? null
    : await readActiveMetadata(changeDirectory, diagnostics);
  const artifactStage = archived
    ? "implementation"
    : artifactStageOverride ?? metadata?.stage;
  const progress = artifactStage === undefined
    ? emptyArtifactProgress()
    : await validateArtifacts(changeDirectory, artifactStage, diagnostics);

  let assessment: ChangePlanAssessment | null = archived
    ? { assessment: "not-applicable" }
    : null;
  if (!archived && metadata !== null) {
    try {
      assessment = await assessChangePlan(changeDirectory, metadata);
    } catch (error) {
      assessment = null;
      diagnostics.push(fileDiagnostic(
        changePlanMetadataName,
        "version-control-failed",
        `cannot assess plan against version control: ${errorMessage(error)}`
      ));
    }
  }
  if (assessment?.assessment === "plan-review-required") {
    diagnostics.push(fileDiagnostic(
      changePlanMetadataName,
      "plan-review-required",
      "plan baseCommit is unavailable; review the plan and record a new Git baseline"
    ));
  }

  return checkResult(
    changeDirectory,
    diagnostics,
    metadata,
    assessment,
    progress
  );
}

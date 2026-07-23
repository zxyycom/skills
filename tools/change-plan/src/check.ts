import type { Stats } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { validateChangePlanArtifact } from "./markdown.ts";
import {
  changePlanArtifactNames,
  type ArtifactStructureContract,
  type ChangePlanArtifactName,
  type ChangePlanCheckResult,
  type ChangePlanDiagnostic
} from "./types.ts";

const kebabCasePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

const artifactContracts: readonly ArtifactStructureContract[] = [
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

async function statOrNull(targetPath: string): Promise<Stats | null> {
  try {
    return await fs.stat(targetPath);
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

function directoryDiagnostic(
  code: ChangePlanDiagnostic["code"],
  message: string
): ChangePlanDiagnostic {
  return { code, file: null, message };
}

function fileDiagnostic(
  file: ChangePlanArtifactName,
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

function result(
  changeDirectory: string,
  diagnostics: readonly ChangePlanDiagnostic[],
  taskCount: number,
  completedTaskCount: number
): ChangePlanCheckResult {
  const sortedDiagnostics = sortDiagnostics(diagnostics);
  return {
    changeDirectory,
    changeName: path.basename(changeDirectory),
    completedTaskCount,
    diagnostics: sortedDiagnostics,
    taskCount,
    valid: sortedDiagnostics.length === 0
  };
}

export async function checkChangePlanDirectory(
  changeDirectoryInput: string
): Promise<ChangePlanCheckResult> {
  const changeDirectory = path.resolve(changeDirectoryInput);
  const diagnostics: ChangePlanDiagnostic[] = [];
  const changeName = path.basename(changeDirectory);
  let taskCount = 0;
  let completedTaskCount = 0;

  if (!kebabCasePattern.test(changeName)) {
    diagnostics.push(directoryDiagnostic(
      "invalid-change-name",
      `change directory name must use kebab-case: ${changeName || "<empty>"}`
    ));
  }

  const directoryStat = await statOrNull(changeDirectory);
  if (directoryStat === null) {
    diagnostics.push(directoryDiagnostic(
      "change-directory-not-found",
      `change directory does not exist: ${changeDirectory}`
    ));
    return result(changeDirectory, diagnostics, taskCount, completedTaskCount);
  }
  if (!directoryStat.isDirectory()) {
    diagnostics.push(directoryDiagnostic(
      "change-path-not-directory",
      `change path must be a directory: ${changeDirectory}`
    ));
    return result(changeDirectory, diagnostics, taskCount, completedTaskCount);
  }

  for (const contract of artifactContracts) {
    const artifactPath = path.join(changeDirectory, contract.file);
    const artifactStat = await statOrNull(artifactPath);
    if (artifactStat === null) {
      diagnostics.push(fileDiagnostic(
        contract.file,
        "missing-required-file",
        `${contract.file} is required`
      ));
      continue;
    }
    if (!artifactStat.isFile()) {
      diagnostics.push(fileDiagnostic(
        contract.file,
        "required-path-not-file",
        `${contract.file} must be a regular file`
      ));
      continue;
    }

    try {
      const validation = validateChangePlanArtifact(
        await fs.readFile(artifactPath, "utf8"),
        contract
      );
      diagnostics.push(...validation.diagnostics);
      taskCount += validation.taskCount;
      completedTaskCount += validation.completedTaskCount;
    } catch (error) {
      diagnostics.push(fileDiagnostic(
        contract.file,
        "file-read-failed",
        `cannot read or parse ${contract.file}: ${
          error instanceof Error ? error.message : String(error)
        }`
      ));
    }
  }

  for (const file of changePlanArtifactNames) {
    if (!artifactContracts.some((contract) => contract.file === file)) {
      throw new Error(`Missing structure contract for ${file}`);
    }
  }
  return result(changeDirectory, diagnostics, taskCount, completedTaskCount);
}

import type { Dirent } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { sanitizeInvestigationDiagnosticText } from "./diagnostics.ts";
import {
  investigationCandidateIdFromFileName,
  isReservedInvestigationCandidateFileName
} from "./candidate-path.ts";
import { investigationIdFromMarkdown } from "./markdown.ts";
import {
  investigationIndexFileName,
  isInvestigationSourcePath
} from "./report-path.ts";
import { investigationResourcesDirectoryName } from "./resource-reference.ts";
import type { InvestigationSource } from "./types.ts";

export type InvestigationLayoutScan = Readonly<{
  candidateErrors: string[];
  candidateIds: string[];
  errors: string[];
  formalSources: InvestigationSource[];
}>;

export async function inspectInvestigationLayoutEntry(
  entry: Dirent<string>,
  investigationsDirectory: string,
  scan: InvestigationLayoutScan
): Promise<void> {
  if (inspectReservedRootEntry(entry, scan.errors)) return;
  if (entry.isSymbolicLink()) {
    recordSymbolicLink(entry.name, scan);
    return;
  }
  if (!entry.isFile()) {
    scan.errors.push(`${entry.name} is not allowed at the investigation root`);
    return;
  }
  const candidateId = investigationCandidateIdFromFileName(entry.name);
  if (candidateId !== null) {
    await inspectCandidateRootEntry(entry.name, investigationsDirectory, scan);
    return;
  }
  if (isReservedInvestigationCandidateFileName(entry.name)) {
    recordInvalidCandidateFileName(entry.name, scan);
    return;
  }
  if (!isInvestigationSourcePath(entry.name)) {
    scan.errors.push(
      `${entry.name} must be a root-level Investigation Markdown source path`
    );
    return;
  }
  await inspectFormalRootEntry(entry.name, investigationsDirectory, scan);
}

function inspectReservedRootEntry(
  entry: Dirent<string>,
  errors: string[]
): boolean {
  if (entry.name === investigationResourcesDirectoryName) {
    if (entry.isSymbolicLink() || !entry.isDirectory())
      errors.push(
        `${investigationResourcesDirectoryName} must be a directory and not a symbolic link`
      );
    return true;
  }
  if (entry.name === investigationIndexFileName) {
    if (entry.isSymbolicLink() || !entry.isFile())
      errors.push(
        `${investigationIndexFileName} must be a regular non-symbolic-link file`
      );
    return true;
  }
  return false;
}

async function inspectCandidateRootEntry(
  name: string,
  investigationsDirectory: string,
  scan: InvestigationLayoutScan
): Promise<void> {
  try {
    const candidateText = await fs.readFile(
      path.join(investigationsDirectory, name),
      "utf8"
    );
    const declaredId = investigationIdFromMarkdown(candidateText);
    if (declaredId === null) {
      recordCandidateError(
        `${name} must declare a valid frontmatter Investigation ID`,
        scan
      );
    } else scan.candidateIds.push(declaredId);
  } catch (error) {
    recordCandidateError(
      `${name} could not be read: ${errorText(error)}`,
      scan
    );
  }
}

async function inspectFormalRootEntry(
  name: string,
  investigationsDirectory: string,
  scan: InvestigationLayoutScan
): Promise<void> {
  try {
    const text = await fs.readFile(
      path.join(investigationsDirectory, name),
      "utf8"
    );
    const id = investigationIdFromMarkdown(text);
    if (id === null) {
      scan.errors.push(
        `${name} must declare a valid frontmatter Investigation ID`
      );
      return;
    }
    scan.formalSources.push({ id, sourcePath: name, text });
  } catch (error) {
    scan.errors.push(`${name} could not be read: ${errorText(error)}`);
  }
}

function recordSymbolicLink(name: string, scan: InvestigationLayoutScan): void {
  const error = `${name} must not be a symbolic link`;
  scan.errors.push(error);
  if (isReservedInvestigationCandidateFileName(name))
    scan.candidateErrors.push(error);
}

function recordInvalidCandidateFileName(
  name: string,
  scan: InvestigationLayoutScan
): void {
  recordCandidateError(
    `${name} must use the reserved _candidate.<investigation-id> file name`,
    scan
  );
}

function recordCandidateError(
  error: string,
  scan: InvestigationLayoutScan
): void {
  scan.candidateErrors.push(error);
  scan.errors.push(error);
}

function errorText(error: unknown): string {
  return sanitizeInvestigationDiagnosticText(error);
}

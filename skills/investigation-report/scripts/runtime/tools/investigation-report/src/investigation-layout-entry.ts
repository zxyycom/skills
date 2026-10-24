/*
 * Synced TypeScript runtime; repository maintenance edits tools/investigation-report/src/investigation-layout-entry.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/investigation-report/src/investigation-layout-entry.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/investigation-report/src/investigation-layout-entry.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/investigation-report
 * Rebuild: bun run sync:investigation-report-check
 */
import type { RecordReadResult } from "../../record-operations/src/reader-batch.ts";
import path from "node:path";
import type { InvestigationPreparation } from "./strict-preparation.ts";
import type { Dirent } from "node:fs";
import { readRecordText } from "../../record-operations/src/source.ts";
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

export type InvestigationLayoutOptions = Readonly<{
  readFormalSources?: boolean;
  readCandidateSources?: boolean;
  preparation?: InvestigationPreparation;
}>;

export type InvestigationLayoutScan = Readonly<{
  candidateErrors: string[];
  candidateIds: string[];
  candidateSources: InvestigationSource[];
  errors: string[];
  formalSources: InvestigationSource[];
}>;

export async function inspectInvestigationLayoutEntry(
  entry: Dirent<string>,
  investigationsDirectory: string,
  scan: InvestigationLayoutScan,
  options: InvestigationLayoutOptions = {},
  acquired?: RecordReadResult<string>
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
    await inspectCandidateRootEntry(
      entry.name,
      investigationsDirectory,
      scan,
      options,
      acquired
    );
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
  await inspectFormalRootEntry(
    entry.name,
    investigationsDirectory,
    scan,
    options,
    acquired
  );
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
  scan: InvestigationLayoutScan,
  options: InvestigationLayoutOptions,
  acquired?: RecordReadResult<string>
): Promise<void> {
  if (options.readCandidateSources === false) return;
  try {
    const candidateText = await readLayoutText(
      name,
      investigationsDirectory,
      options,
      acquired
    );
    const declaredId = investigationIdFromMarkdown(candidateText);
    if (declaredId === null) {
      recordCandidateError(
        `${name} must declare a valid frontmatter Investigation ID`,
        scan
      );
    } else {
      scan.candidateIds.push(declaredId);
      scan.candidateSources.push({
        id: declaredId,
        sourcePath: name,
        text: candidateText
      });
    }
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
  scan: InvestigationLayoutScan,
  options: InvestigationLayoutOptions,
  acquired?: RecordReadResult<string>
): Promise<void> {
  if (options.readFormalSources === false) return;
  try {
    const text = await readLayoutText(
      name,
      investigationsDirectory,
      options,
      acquired
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

export function shouldReadInvestigationLayoutEntry(
  entry: Dirent<string>,
  options: InvestigationLayoutOptions
): boolean {
  if (!entry.isFile() || entry.name === investigationIndexFileName)
    return false;
  if (investigationCandidateIdFromFileName(entry.name) !== null)
    return options.readCandidateSources !== false;
  return (
    !isReservedInvestigationCandidateFileName(entry.name) &&
    isInvestigationSourcePath(entry.name) &&
    options.readFormalSources !== false
  );
}

async function readLayoutText(
  name: string,
  directory: string,
  options: InvestigationLayoutOptions,
  acquired?: RecordReadResult<string>
): Promise<string> {
  if (acquired !== undefined) {
    if (!acquired.ok) throw acquired.error;
    return acquired.value;
  }
  return options.preparation === undefined
    ? await readRecordText(directory, name)
    : await options.preparation.read(path.join(directory, name));
}

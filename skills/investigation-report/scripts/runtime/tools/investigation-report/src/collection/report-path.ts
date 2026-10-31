/*
 * Synced TypeScript runtime; repository maintenance edits tools/investigation-report/src/collection/report-path.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/investigation-report/src/collection/report-path.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/investigation-report/src/collection/report-path.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/investigation-report
 * Rebuild: bun run sync:investigation-report-check
 */
import path from "node:path";
import { err, ok, ResultAsync, type Result } from "neverthrow";
import { isPathWithinDirectory } from "../../../shared/src/node/filesystem.ts";
import { canonicalRecordCollection } from "../../../record-operations/src/source.ts";

export const defaultInvestigationsDirectory = "docs/investigations";
export const investigationIndexFileName = "investigation-index.json";
export const investigationKebabCasePatternSource = "[a-z0-9]+(?:-[a-z0-9]+)*";
export const investigationIdPatternSource = `^${investigationKebabCasePatternSource}$`;
export const investigationSourcePathPatternSource = `^${investigationKebabCasePatternSource}\\.md$`;

const kebabCasePattern = new RegExp(
  `^${investigationKebabCasePatternSource}$`,
  "u"
);
const investigationIdPattern = new RegExp(investigationIdPatternSource, "u");
const datedInvestigationIdPattern =
  /^(\d{2})(\d{2})(\d{2})-([a-z0-9]+(?:-[a-z0-9]+)*)$/;
const investigationSourcePathPattern = new RegExp(
  investigationSourcePathPatternSource,
  "u"
);

export type ResolvedInvestigationsDirectory = {
  investigationsDirectory: string;
  investigationsDirectoryOption: string;
  workspaceRoot: string;
};

export type CanonicalInvestigationsDirectory = {
  investigationsDirectory: string;
  investigationsDirectoryOption: string;
  workspaceRoot: string;
};

export function resolveInvestigationsDirectory(
  workspaceRootValue: string,
  investigationsDirectoryValue?: string
): Result<ResolvedInvestigationsDirectory, string[]> {
  const workspaceRoot = path.resolve(workspaceRootValue);
  const investigationsDirectoryOption =
    investigationsDirectoryValue ?? defaultInvestigationsDirectory;
  const investigationsDirectory = path.resolve(
    workspaceRoot,
    investigationsDirectoryOption
  );
  const errors: string[] = [];
  if (path.isAbsolute(investigationsDirectoryOption)) {
    errors.push(
      "investigations directory must be relative to the workspace root"
    );
  } else if (!isPathWithinDirectory(investigationsDirectory, workspaceRoot)) {
    errors.push("investigations directory must stay within the workspace root");
  }
  return errors.length > 0
    ? err(errors)
    : ok({
        investigationsDirectory,
        investigationsDirectoryOption,
        workspaceRoot
      });
}

export function canonicalizeInvestigationsDirectory(
  resolved: ResolvedInvestigationsDirectory
): ResultAsync<CanonicalInvestigationsDirectory, string[]> {
  return ResultAsync.fromPromise(
    canonicalRecordCollection(
      resolved.workspaceRoot,
      resolved.investigationsDirectoryOption
    ),
    (error) => [
      error instanceof Error
        ? error.message.replaceAll(
            "record collection",
            "investigations directory"
          )
        : "investigations directory could not be safely resolved"
    ]
  ).map(({ workspaceRoot, collectionRoot }) => ({
    investigationsDirectory: collectionRoot,
    investigationsDirectoryOption: resolved.investigationsDirectoryOption,
    workspaceRoot
  }));
}

export function isInvestigationId(value: string): boolean {
  return !value.includes("/") && investigationIdPattern.test(value);
}

export type ParsedDatedInvestigationId = Readonly<{
  date: string;
  id: string;
  name: string;
}>;

export function parseDatedInvestigationId(
  value: string
): ParsedDatedInvestigationId | null {
  const match = datedInvestigationIdPattern.exec(value);
  if (match === null || !isInvestigationId(value)) return null;
  const [, yearText, monthText, dayText, name] = match;
  const year = 2000 + Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return { date: `${yearText}${monthText}${dayText}`, id: value, name };
}

export function normalizeInvestigationSelectorInput(value: string): string {
  return value.replace(/\.md$/iu, "");
}

export function investigationNameFromId(id: string): string {
  return parseDatedInvestigationId(id)?.name ?? id;
}

export function utcInvestigationDate(timestamp: string): string | null {
  const milliseconds = Date.parse(timestamp);
  if (!Number.isFinite(milliseconds)) return null;
  const date = new Date(milliseconds);
  return [
    String(date.getUTCFullYear() % 100).padStart(2, "0"),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0")
  ].join("");
}

export function datedInvestigationIdForName(
  name: string,
  formedAt: string
): string | null {
  const date = utcInvestigationDate(formedAt);
  if (date === null) return null;
  const id = `${date}-${name}`;
  return parseDatedInvestigationId(id)?.id ?? null;
}

/** Normalizes one former Markdown-suffixed selector at an input boundary. */
export function normalizeInvestigationIdInput(value: string): string | null {
  const normalized = normalizeInvestigationSelectorInput(value);
  return isInvestigationId(normalized) ? normalized : null;
}

export function isInvestigationSourcePath(value: string): boolean {
  return !value.includes("/") && investigationSourcePathPattern.test(value);
}

export function validateInvestigationId(value: string): string[] {
  return isInvestigationId(value)
    ? []
    : [
        `${value || "<empty>"} must use an extensionless kebab-case semantic Investigation ID`
      ];
}

export function isInvestigationTag(value: string): boolean {
  return kebabCasePattern.test(value);
}

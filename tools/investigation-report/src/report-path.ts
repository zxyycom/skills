import path from "node:path";
import { isPathWithinDirectory } from "../../shared/src/node/filesystem.ts";

export const defaultInvestigationsDirectory = "docs/investigations";
export const investigationKebabCasePatternSource =
  "[a-z0-9]+(?:-[a-z0-9]+)*";
export const investigationTopicPathPatternSource =
  `^${investigationKebabCasePatternSource}/${investigationKebabCasePatternSource}\\.md$`;

const kebabCasePattern = new RegExp(
  `^${investigationKebabCasePatternSource}$`,
  "u"
);
const investigationTopicPathPattern = new RegExp(
  investigationTopicPathPatternSource,
  "u"
);

export type ResolvedInvestigationsDirectory = {
  errors: string[];
  investigationsDirectory: string;
  investigationsDirectoryOption: string;
  workspaceRoot: string;
};

export function resolveInvestigationsDirectory(
  workspaceRootValue: string,
  investigationsDirectoryValue?: string
): ResolvedInvestigationsDirectory {
  const workspaceRoot = path.resolve(workspaceRootValue);
  const investigationsDirectoryOption = investigationsDirectoryValue
    ?? defaultInvestigationsDirectory;
  const investigationsDirectory = path.resolve(
    workspaceRoot,
    investigationsDirectoryOption
  );
  const errors: string[] = [];
  if (path.isAbsolute(investigationsDirectoryOption)) {
    errors.push("investigations directory must be relative to the workspace root");
  } else if (!isPathWithinDirectory(investigationsDirectory, workspaceRoot)) {
    errors.push("investigations directory must stay within the workspace root");
  }
  return {
    errors,
    investigationsDirectory,
    investigationsDirectoryOption,
    workspaceRoot
  };
}

export function normalizeInvestigationTopicPath(value: string): string {
  return value.trim().replace(/\\/gu, "/").replace(/^\.\//u, "");
}

export function isSafeRelativeInvestigationPath(relativePath: string): boolean {
  if (
    relativePath.length === 0
    || path.posix.isAbsolute(relativePath)
    || path.win32.isAbsolute(relativePath)
    || relativePath.includes("?")
    || relativePath.includes("#")
  ) {
    return false;
  }
  return !relativePath
    .split("/")
    .some((part) => part.length === 0 || part === "." || part === "..");
}

export function isInvestigationTopicPath(relativePath: string): boolean {
  return isSafeRelativeInvestigationPath(relativePath)
    && investigationTopicPathPattern.test(relativePath);
}

export function isInvestigationCategory(value: string): boolean {
  return kebabCasePattern.test(value);
}

export function investigationCategoryOf(relativePath: string): string | null {
  const parts = relativePath.split("/");
  return parts.length > 0 && parts[0].length > 0 ? parts[0] : null;
}

export function validateInvestigationTopicPath(relativePath: string): string[] {
  if (!isSafeRelativeInvestigationPath(relativePath)) {
    return [`${relativePath} must be a safe relative POSIX path`];
  }
  const parts = relativePath.split("/");
  if (parts.length !== 2) {
    return [`${relativePath} must use <category-id>/<semantic-slug>.md`];
  }
  const [category, fileName] = parts;
  const extension = path.posix.extname(fileName);
  const slug = path.posix.basename(fileName, extension);
  const errors: string[] = [];
  if (!isInvestigationCategory(category)) {
    errors.push(`${relativePath} category must use kebab-case`);
  }
  if (extension !== ".md" || !isInvestigationCategory(slug)) {
    errors.push(
      `${relativePath} filename must use a kebab-case semantic slug with .md`
    );
  }
  return errors;
}

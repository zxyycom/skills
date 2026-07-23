import type { Stats } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { isFileSystemError } from "../../shared/src/node/filesystem.ts";
import {
  discoverInvestigationTopicPaths,
  investigationIndexDiagnosticMessages,
  investigationIndexFileName,
  syncInvestigationStateIndex
} from "./investigation-state-index.ts";
import { parseInvestigationReport } from "./markdown.ts";
import {
  resolveInvestigationsDirectory,
  investigationCategoryOf,
  isInvestigationCategory,
  isInvestigationTopicPath,
  normalizeInvestigationTopicPath,
  validateInvestigationTopicPath
} from "./report-path.ts";
import { buildInvestigationTopicState } from "./report-validation.ts";
import type {
  InvestigationIndexSyncOptions,
  InvestigationIndexSyncResult,
  InvestigationReportCheckOptions,
  InvestigationReportCheckResult
} from "./types.ts";

type Selection = {
  active: boolean;
  categories: Set<string>;
  paths: Set<string>;
};

type ValidationMode = "check-index" | "sources-only";

async function statOrNull(targetPath: string): Promise<Stats | null> {
  try {
    return await fs.stat(targetPath);
  } catch (error) {
    if (isFileSystemError(error, "ENOENT")) {
      return null;
    }
    throw error;
  }
}

function selectionFromOptions(
  options: InvestigationReportCheckOptions,
  errors: string[]
): Selection {
  const categories = new Set(
    (options.categories ?? []).map((value) => value.trim())
  );
  const paths = new Set(
    (options.paths ?? []).map(normalizeInvestigationTopicPath)
  );

  for (const category of categories) {
    if (!isInvestigationCategory(category)) {
      errors.push(
        `category filter must use kebab-case: ${category || "<empty>"}`
      );
    }
  }
  for (const topicPath of paths) {
    if (!isInvestigationTopicPath(topicPath)) {
      errors.push(
        "path filter must use <category-id>/<semantic-slug>.md: "
        + (topicPath || "<empty>")
      );
    }
  }

  return {
    active: categories.size > 0 || paths.size > 0,
    categories,
    paths
  };
}

export function investigationTopicSelectionOptionErrors(
  options: InvestigationReportCheckOptions
): string[] {
  const errors: string[] = [];
  selectionFromOptions(options, errors);
  return uniqueSorted(errors);
}

function selectionMatches(selection: Selection, relativePath: string): boolean {
  const category = investigationCategoryOf(relativePath);
  return (
    selection.categories.size === 0
    || (category !== null && selection.categories.has(category))
  ) && (
    selection.paths.size === 0
    || selection.paths.has(relativePath)
  );
}

async function validateInvestigationCollection(
  options: InvestigationReportCheckOptions,
  mode: ValidationMode
): Promise<InvestigationReportCheckResult> {
  const errors: string[] = [];
  const selection = selectionFromOptions(options, errors);
  const resolved = resolveInvestigationsDirectory(
    options.workspaceRoot,
    options.investigationsDir
  );
  const investigationRoot = resolved.investigationsDirectory;
  const indexPath = path.join(investigationRoot, investigationIndexFileName);
  if (resolved.errors.length > 0) {
    errors.push(...resolved.errors);
    return emptyResult(errors, indexPath);
  }

  const rootStat = await statOrNull(investigationRoot);
  if (rootStat === null) {
    errors.push(
      `${resolved.investigationsDirectoryOption.replace(/\\/gu, "/")} does not exist`
    );
    return emptyResult(errors, indexPath);
  }
  if (!rootStat.isDirectory()) {
    errors.push(
      `${resolved.investigationsDirectoryOption.replace(/\\/gu, "/")} must be a directory`
    );
    return emptyResult(errors, indexPath);
  }

  const discoveredFiles = await discoverInvestigationTopicPaths(
    investigationRoot
  );
  const fileSet = new Set(discoveredFiles);
  const candidatePaths = new Set([
    ...discoveredFiles,
    ...selection.paths
  ]);
  const selectedPaths = [...candidatePaths]
    .filter((relativePath) => selectionMatches(selection, relativePath))
    .sort(compareText);

  if (selection.active && selectedPaths.length === 0) {
    errors.push("no investigation topics matched the requested filters");
  }

  for (const relativePath of selectedPaths) {
    errors.push(...validateInvestigationTopicPath(relativePath));
    if (!fileSet.has(relativePath)) {
      errors.push(`${relativePath} topic file does not exist`);
      continue;
    }
    const reportPath = path.join(
      investigationRoot,
      ...relativePath.split("/")
    );
    const report = parseInvestigationReport(
      await fs.readFile(reportPath, "utf8"),
      relativePath
    );
    errors.push(...buildInvestigationTopicState(relativePath, report).errors);
  }

  let indexChecked = false;
  if (
    mode === "check-index"
    && !selection.active
    && errors.length === 0
  ) {
    indexChecked = true;
    const synchronized = await syncInvestigationStateIndex({
      investigationsDirectory: investigationRoot,
      mode: "check"
    });
    if (synchronized.status === "error") {
      errors.push(
        ...investigationIndexDiagnosticMessages(synchronized.diagnostics)
      );
    }
  }

  const selectedCategories = new Set(
    selectedPaths.flatMap((relativePath) => {
      const category = investigationCategoryOf(relativePath);
      return category === null ? [] : [category];
    })
  );
  return {
    availableTopicCount: discoveredFiles.length,
    categoryCount: selectedCategories.size,
    errors: uniqueSorted(errors),
    indexChecked,
    indexPath,
    selectedTopicCount: selectedPaths.length
  };
}

export async function validateInvestigationReports(
  options: InvestigationReportCheckOptions
): Promise<InvestigationReportCheckResult> {
  return await validateInvestigationCollection(options, "check-index");
}

export async function synchronizeInvestigationIndex(
  options: InvestigationIndexSyncOptions
): Promise<InvestigationIndexSyncResult> {
  const checked = await validateInvestigationCollection({
    investigationsDir: options.investigationsDir,
    workspaceRoot: options.workspaceRoot
  }, "sources-only");
  if (checked.errors.length > 0) {
    return {
      categoryCount: checked.categoryCount,
      changed: false,
      errors: checked.errors,
      indexPath: checked.indexPath,
      topicCount: checked.availableTopicCount
    };
  }

  const synchronized = await syncInvestigationStateIndex({
    investigationsDirectory: path.dirname(checked.indexPath),
    mode: "write"
  });
  return {
    categoryCount: checked.categoryCount,
    changed: synchronized.changed,
    errors: synchronized.status === "error"
      ? investigationIndexDiagnosticMessages(synchronized.diagnostics)
      : [],
    indexPath: checked.indexPath,
    topicCount: checked.availableTopicCount
  };
}

function emptyResult(
  errors: readonly string[],
  indexPath: string
): InvestigationReportCheckResult {
  return {
    availableTopicCount: 0,
    categoryCount: 0,
    errors: uniqueSorted(errors),
    indexChecked: false,
    indexPath,
    selectedTopicCount: 0
  };
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareText);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

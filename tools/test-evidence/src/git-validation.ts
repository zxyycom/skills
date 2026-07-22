import type { LedgerCase } from "./catalog-validation.ts";
import { createDiagnostic } from "./diagnostics.ts";
import { loadGitWorkspace, type GitWorkspace } from "./git.ts";
import {
  compileScopePattern,
  matchesAnyScope,
  type ScopeMatcher
} from "./scope.ts";
import type {
  ReviewTrigger,
  ReviewTriggerPolicy,
  TestEvidenceDiagnostic
} from "./types.ts";

export type GitValidationOptions = {
  catalogPath: string;
  configPath: string;
  reviewMaxAgeDays?: number;
  reviewTriggerPolicy: ReviewTriggerPolicy;
  scopedCases: readonly LedgerCase[];
  workspaceRoot: string;
};

export type GitValidationResult = {
  diagnostics: TestEvidenceDiagnostic[];
  reviewTriggers: ReviewTrigger[];
};

export async function validateGitState(
  options: GitValidationOptions
): Promise<GitValidationResult> {
  const scopedCases = options.scopedCases.filter(
    (entry) => entry.kind === "active-review" || entry.kind === "active-exempt"
  );
  if (scopedCases.length === 0) {
    return { diagnostics: [], reviewTriggers: [] };
  }

  const loaded = await loadGitWorkspace(options.workspaceRoot);
  if (loaded.workspace === null) {
    return {
      diagnostics: loaded.errors.map((message) => createDiagnostic({
        category: "git",
        code: "git.workspace-invalid",
        message,
        severity: "error"
      })),
      reviewTriggers: []
    };
  }

  const diagnostics: TestEvidenceDiagnostic[] = loaded.errors.map((message) =>
    createDiagnostic({
      category: "git",
      code: "git.workspace-invalid",
      message,
      severity: "error"
    })
  );
  const reviewTriggers: ReviewTrigger[] = [];
  const ignoredStatePaths = new Set([options.catalogPath, options.configPath]);

  for (const entry of scopedCases) {
    const matchers = entry.scopePatterns.map(compileScopePattern);
    for (const matcher of matchers) {
      if (!loaded.workspace.files.some((file) => matcher.matches(file))) {
        diagnostics.push(createDiagnostic({
          caseId: entry.id,
          category: "git",
          code: "git.scope-unmatched",
          line: entry.line,
          message: `${options.catalogPath}:${entry.line} ${entry.id} Scope pattern `
            + `${matcher.pattern} does not match any Git-visible path`,
          path: options.catalogPath,
          severity: "error"
        }));
      }
    }

    if (entry.kind !== "active-review") {
      continue;
    }

    const trigger = await inspectReviewTrigger(
      entry,
      matchers,
      loaded.workspace,
      ignoredStatePaths
    );
    if (trigger !== null) {
      reviewTriggers.push(trigger);
      const severity = options.reviewTriggerPolicy === "error" ? "error" : "warning";
      diagnostics.push(createDiagnostic({
        blocking: severity === "error",
        caseId: entry.id,
        category: "review",
        code: "review.trigger",
        line: entry.line,
        message: `${entry.id} requires review: ${trigger.reasons.join("; ")}${
          trigger.paths.length === 0 ? "" : ` (${trigger.paths.join(", ")})`
        }`,
        path: options.catalogPath,
        severity
      }));
    }

    if (
      options.reviewMaxAgeDays !== undefined
      && entry.lastReview !== null
      && entry.lastReview.result === "pass"
    ) {
      const elapsedDays = Math.floor(
        (Date.now() - Date.parse(entry.lastReview.at)) / 86_400_000
      );
      if (elapsedDays > options.reviewMaxAgeDays) {
        diagnostics.push(createDiagnostic({
          blocking: false,
          caseId: entry.id,
          category: "review",
          code: "review.overdue",
          line: entry.line,
          message: `${entry.id} was last reviewed ${elapsedDays} day(s) ago, exceeding `
            + `reviewMaxAgeDays ${options.reviewMaxAgeDays}`,
          path: options.catalogPath,
          severity: "warning"
        }));
      }
    }
  }

  return { diagnostics, reviewTriggers };
}

async function inspectReviewTrigger(
  entry: Extract<LedgerCase, { kind: "active-review" }>,
  matchers: readonly ScopeMatcher[],
  workspace: GitWorkspace,
  ignoredStatePaths: ReadonlySet<string>
): Promise<ReviewTrigger | null> {
  const reasons: string[] = [];
  const paths = new Set(
    workspace.dirtyPaths.filter((candidate) =>
      !ignoredStatePaths.has(candidate) && matchesAnyScope(candidate, matchers)
    )
  );
  if (paths.size > 0) {
    reasons.push("dirty worktree paths match Scope");
  }

  if (entry.lastReview === null) {
    reasons.push("no completed review is recorded");
  } else {
    if (entry.lastReview.result !== "pass") {
      reasons.push(`last review result is ${entry.lastReview.result}`);
    }
    try {
      const changedPaths = await workspace.changedPathsSince(entry.lastReview.commit);
      const matchedPaths = changedPaths.filter((candidate) =>
        !ignoredStatePaths.has(candidate) && matchesAnyScope(candidate, matchers)
      );
      for (const candidate of matchedPaths) {
        paths.add(candidate);
      }
      if (matchedPaths.length > 0) {
        reasons.push("committed paths changed after Reviewed-Commit");
      }
    } catch {
      reasons.push(`Reviewed-Commit ${entry.lastReview.commit} is unavailable`);
    }
  }

  return reasons.length === 0
    ? null
    : { caseId: entry.id, paths: [...paths].sort(), reasons };
}

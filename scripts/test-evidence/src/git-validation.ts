import type { LedgerCase } from "./catalog-validation.ts";
import {
  loadGitWorkspace,
  type GitWorkspace
} from "./git.ts";
import {
  compileScopePattern,
  matchesAnyScope,
  type ScopeMatcher
} from "./scope.ts";
import type {
  ReviewTrigger,
  ReviewTriggerPolicy
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
  errors: string[];
  reviewTriggers: ReviewTrigger[];
  warnings: string[];
};

export async function validateGitState(
  options: GitValidationOptions
): Promise<GitValidationResult> {
  const scopedCases = options.scopedCases.filter(
    (entry) => entry.kind === "active-review" || entry.kind === "active-exempt"
  );
  if (scopedCases.length === 0) {
    return { errors: [], reviewTriggers: [], warnings: [] };
  }

  const loaded = await loadGitWorkspace(options.workspaceRoot);
  if (loaded.workspace === null) {
    return {
      errors: loaded.errors,
      reviewTriggers: [],
      warnings: []
    };
  }

  const errors = [...loaded.errors];
  const warnings: string[] = [];
  const reviewTriggers: ReviewTrigger[] = [];
  const ignoredStatePaths = new Set([options.catalogPath, options.configPath]);

  for (const entry of scopedCases) {
    const matchers = entry.scopePatterns.map(compileScopePattern);
    for (const matcher of matchers) {
      if (!loaded.workspace.files.some((file) => matcher.matches(file))) {
        errors.push(
          `${options.catalogPath}:${entry.line} ${entry.id} Scope pattern `
          + `${matcher.pattern} does not match any Git-visible path`
        );
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
      const message = `${entry.id} requires review: ${trigger.reasons.join("; ")}${
        trigger.paths.length === 0 ? "" : ` (${trigger.paths.join(", ")})`
      }`;
      if (options.reviewTriggerPolicy === "error") {
        errors.push(message);
      } else {
        warnings.push(message);
      }
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
        warnings.push(
          `${entry.id} was last reviewed ${elapsedDays} day(s) ago, exceeding `
          + `reviewMaxAgeDays ${options.reviewMaxAgeDays}`
        );
      }
    }
  }

  return { errors, reviewTriggers, warnings };
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
      for (const candidate of changedPaths) {
        if (
          !ignoredStatePaths.has(candidate)
          && matchesAnyScope(candidate, matchers)
        ) {
          paths.add(candidate);
        }
      }
      if (changedPaths.some((candidate) =>
        !ignoredStatePaths.has(candidate) && matchesAnyScope(candidate, matchers)
      )) {
        reasons.push("committed paths changed after Reviewed-Commit");
      }
    } catch {
      reasons.push(
        `Reviewed-Commit ${entry.lastReview.commit} is unavailable`
      );
    }
  }

  if (reasons.length === 0) {
    return null;
  }
  return {
    caseId: entry.id,
    paths: [...paths].sort(),
    reasons
  };
}

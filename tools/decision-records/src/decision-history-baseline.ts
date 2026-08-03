import path from "node:path";
import {
  openVersionControl,
  VersionControlError
} from "../../shared/src/version-control/index.ts";
import {
  decisionFailure,
  type DecisionApplicationFailure
} from "./application-result.ts";
import type { DecisionScan } from "./types.ts";

export type DecisionHistoryBaseline =
  | {
      kind: "git-head";
      label: "Git HEAD";
      recordedDecisionPaths: ReadonlySet<string>;
    }
  | {
      kind: "outside-git-worktree";
    };

export type DecisionHistoryBaselineResult =
  | DecisionApplicationFailure
  | {
      baseline: DecisionHistoryBaseline;
      status: "ok";
    };

export async function loadDecisionHistoryBaseline(
  scan: DecisionScan
): Promise<DecisionHistoryBaselineResult> {
  let repository;
  try {
    repository = await openVersionControl(scan.decisionsDirectory);
  } catch (error) {
    if (error instanceof VersionControlError && error.code === "not-repository") {
      return {
        baseline: { kind: "outside-git-worktree" },
        status: "ok"
      };
    }
    return baselineFailure(error);
  }

  const relativeDirectory = path.relative(
    repository.rootDirectory,
    scan.decisionsDirectory
  );
  if (isOutsideRepository(relativeDirectory)) {
    return {
      baseline: { kind: "outside-git-worktree" },
      status: "ok"
    };
  }

  try {
    const revision = await repository.getCurrentRevision();
    if (revision === null) {
      return {
        baseline: {
          kind: "git-head",
          label: "Git HEAD",
          recordedDecisionPaths: new Set<string>()
        },
        status: "ok"
      };
    }

    const directoryScope = toRepositoryPath(relativeDirectory);
    const revisionFiles = directoryScope.length === 0
      ? await repository.listRevisionFiles(revision)
      : await repository.listRevisionFiles(revision, {
          pathScopes: [directoryScope]
        });
    const prefix = directoryScope.length === 0 ? "" : directoryScope + "/";
    const recordedDecisionPaths = new Set<string>();
    for (const filePath of revisionFiles) {
      if (!filePath.startsWith(prefix) || !filePath.endsWith(".md")) {
        continue;
      }
      recordedDecisionPaths.add(filePath.slice(prefix.length));
    }
    return {
      baseline: {
        kind: "git-head",
        label: "Git HEAD",
        recordedDecisionPaths
      },
      status: "ok"
    };
  } catch (error) {
    return baselineFailure(error);
  }
}

function isOutsideRepository(relativePath: string): boolean {
  return path.isAbsolute(relativePath)
    || relativePath === ".."
    || relativePath.startsWith(".." + path.sep);
}

function toRepositoryPath(filePath: string): string {
  return filePath.split(path.sep).join("/");
}

function baselineFailure(error: unknown): DecisionApplicationFailure {
  return decisionFailure([
    "Failed to inspect Git HEAD before changing decision history: "
      + errorText(error)
  ], { presentation: "plain" });
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

import path from "node:path";

/** The collection directory used when a call does not configure one. */
export const defaultDecisionsDir = "docs/decisions";

export type WorkspaceDecisionLocation = {
  decisionsDir: string;
  workspaceRoot: string;
};

export type DecisionLocationErrorCode =
  | "decision-records.invalid-decisions-dir"
  | "decision-records.invalid-root";

export type DecisionLocationError = {
  code: DecisionLocationErrorCode;
  message: string;
};

export type DecisionLocationResolution =
  | { readonly error: DecisionLocationError; readonly location?: never }
  | { readonly error?: never; readonly location: WorkspaceDecisionLocation };

export type DecisionLocationInput = {
  /** Fallback workspace root; only read when `root` is absent. */
  cwd: string;
  decisionsDir?: string;
  root?: string;
};

/**
 * Single authority for the workspace-location contract: `--root` selects the
 * workspace root (defaulting to `cwd`), the decisions directory stays a
 * workspace-relative path that still resolves inside the root, and a root
 * pointing at the configured collection directory receives the recovery form.
 */
export function resolveWorkspaceDecisionLocation(
  input: DecisionLocationInput
): DecisionLocationResolution {
  const workspaceRoot = path.resolve(input.cwd, input.root ?? ".");
  const configuredDecisionsDir = input.decisionsDir ?? defaultDecisionsDir;
  if (path.isAbsolute(configuredDecisionsDir)) {
    return {
      error: {
        code: "decision-records.invalid-decisions-dir",
        message: "--decisions-dir must be relative to --root"
      }
    };
  }
  const resolvedDecisionsDir = path.resolve(
    workspaceRoot,
    configuredDecisionsDir
  );
  const relativeDecisionsDir = path.relative(
    workspaceRoot,
    resolvedDecisionsDir
  );
  if (escapesWorkspaceRoot(relativeDecisionsDir)) {
    return {
      error: {
        code: "decision-records.invalid-decisions-dir",
        message: "--decisions-dir must remain within --root"
      }
    };
  }
  if (isConfiguredCollectionDir(workspaceRoot, relativeDecisionsDir)) {
    return {
      error: {
        code: "decision-records.invalid-root",
        message: `Use --root <workspace> --decisions-dir ${relativeDecisionsDir}`
      }
    };
  }
  return {
    location: {
      decisionsDir: relativeDecisionsDir === "" ? "." : relativeDecisionsDir,
      workspaceRoot
    }
  };
}

function escapesWorkspaceRoot(relativeDecisionsDir: string): boolean {
  return (
    relativeDecisionsDir === ".." ||
    relativeDecisionsDir.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativeDecisionsDir)
  );
}

/**
 * Compares whole path segments so a lookalike suffix such as
 * `mydocs/decisions` is never treated as the configured collection directory.
 */
function isConfiguredCollectionDir(
  workspaceRoot: string,
  relativeDecisionsDir: string
): boolean {
  const collectionSegments = relativeDecisionsDir
    .split(/[\\/]+/u)
    .filter((segment) => segment.length > 0 && segment !== ".");
  if (collectionSegments.length === 0) return false;
  const rootSegments = workspaceRoot
    .split(path.sep)
    .filter((segment) => segment.length > 0);
  if (rootSegments.length < collectionSegments.length) return false;
  const rootTail = rootSegments.slice(-collectionSegments.length);
  return collectionSegments.every((segment, index) => {
    return rootTail[index] === segment;
  });
}

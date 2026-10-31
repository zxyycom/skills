import path from "node:path";
import { defaultInvestigationsDirectory } from "./report-path.ts";

export type WorkspaceInvestigationLocation = {
  investigationsDir: string;
  workspaceRoot: string;
};

export type InvestigationLocationErrorCode =
  | "investigation-report.invalid-investigations-dir"
  | "investigation-report.invalid-root";

export type InvestigationLocationError = {
  code: InvestigationLocationErrorCode;
  message: string;
};

export type InvestigationLocationResolution =
  | {
      readonly error: InvestigationLocationError;
      readonly location?: never;
    }
  | {
      readonly error?: never;
      readonly location: WorkspaceInvestigationLocation;
    };

export type InvestigationLocationInput = {
  /** Fallback workspace root; only read when `root` is absent. */
  cwd: string;
  investigationsDir?: string;
  root?: string;
};

/**
 * Single authority for the workspace-location contract: `--root` selects the
 * workspace root (defaulting to `cwd`), the investigations directory stays a
 * workspace-relative path that still resolves inside the root, and a root
 * pointing at the configured collection directory receives the recovery form.
 */
export function resolveInvestigationLocation(
  input: InvestigationLocationInput
): InvestigationLocationResolution {
  const workspaceRoot = path.resolve(input.cwd, input.root ?? ".");
  const configuredDir =
    input.investigationsDir ?? defaultInvestigationsDirectory;
  if (path.isAbsolute(configuredDir)) {
    return {
      error: {
        code: "investigation-report.invalid-investigations-dir",
        message: "--investigations-dir must be relative to --root"
      }
    };
  }
  const resolvedDir = path.resolve(workspaceRoot, configuredDir);
  const relativeDir = path.relative(workspaceRoot, resolvedDir);
  if (escapesWorkspaceRoot(relativeDir)) {
    return {
      error: {
        code: "investigation-report.invalid-investigations-dir",
        message: "--investigations-dir must remain within --root"
      }
    };
  }
  if (isConfiguredCollectionDir(workspaceRoot, relativeDir)) {
    return {
      error: {
        code: "investigation-report.invalid-root",
        message: `Use --root <workspace> --investigations-dir ${relativeDir}`
      }
    };
  }
  return {
    location: {
      investigationsDir: relativeDir === "" ? "." : relativeDir,
      workspaceRoot
    }
  };
}

function escapesWorkspaceRoot(relativeInvestigationsDir: string): boolean {
  return (
    relativeInvestigationsDir === ".." ||
    relativeInvestigationsDir.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativeInvestigationsDir)
  );
}

/**
 * Compares whole path segments so a lookalike suffix such as
 * `mydocs/investigations` is never treated as the configured collection
 * directory.
 */
function isConfiguredCollectionDir(
  workspaceRoot: string,
  relativeInvestigationsDir: string
): boolean {
  const collectionSegments = relativeInvestigationsDir
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

import path from "node:path";
import { defineCheck } from "@zxyycom/vibe-check";
import type { Check } from "@zxyycom/vibe-check";
import {
  packSkillPackageSnapshot,
  prepareSkillPackageRelease,
  type PreparedSkillPackageRelease
} from "../../skill-package-release.ts";
import { repositoryProcessClaims, repositoryScanClaim } from "../contracts.ts";
import { diagnosticLines, diagnosticMessages } from "../diagnostics.ts";

export type ReleasePacker = (
  preparedRelease: PreparedSkillPackageRelease,
  workspaceRoot: string
) => Promise<unknown>;

export type ReleasePreparer = (
  workspaceRoot: string,
  baselineRef: string
) => Promise<PreparedSkillPackageRelease>;

export const releaseVersionPackageScript = "hash:skills";
export const releaseSnapshotCheckId = "release:skill-prepare";
export const releaseVersionCheckId = "release:skill-version";
export const packSkillsCheckId = "pack:skills";

export function isReleaseBaselineRef(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.trim() === value &&
    !value.startsWith("-") &&
    !value.includes("\0") &&
    !/[\r\n]/u.test(value)
  );
}

function prepareReleaseBaseline(
  baselineRef: unknown
):
  | Readonly<{ readonly baselineRef: string; readonly status: "ready" }>
  | Readonly<{ readonly status: "invalid" }> {
  return isReleaseBaselineRef(baselineRef)
    ? { baselineRef, status: "ready" }
    : { status: "invalid" };
}

export type ReleaseState = {
  prepared: PreparedSkillPackageRelease | undefined;
};

function releaseSnapshotUnavailable(message: string, error: unknown) {
  const detail = error instanceof Error ? error.message : String(error);
  const code = "release-snapshot-unavailable";
  return {
    status: "unavailable" as const,
    reason: { code },
    messages: diagnosticMessages(code, message, detail)
  };
}

export function createReleasePrepareCheck(
  baselineRef: string,
  prepareRelease: ReleasePreparer | undefined,
  state: ReleaseState
): Check {
  const prepare = prepareRelease ?? prepareSkillPackageRelease;
  return defineCheck({
    checkId: releaseSnapshotCheckId,
    displayName: "Prepare skill release snapshot",
    options: { baselineRef },
    resourceClaims: repositoryProcessClaims,
    preflight(options: Readonly<{ baselineRef: string }>) {
      const prepared = prepareReleaseBaseline(options.baselineRef);
      if (prepared.status === "invalid") {
        return {
          status: "failure" as const,
          action: "block" as const,
          reason: { code: "release-baseline-invalid" },
          messages: [
            {
              level: "error" as const,
              code: "release-baseline-invalid",
              message:
                "The release baseline must be a trimmed, non-empty revision input without a leading hyphen, NUL, CR, or LF. Pass --baseline-ref <ref> to bun run check --tag release."
            }
          ]
        };
      }
      return {
        status: "success" as const,
        preparedOptions: { baselineRef: prepared.baselineRef }
      };
    },
    async execution({ options, project }) {
      try {
        state.prepared = await prepare(project.root, options.baselineRef);
        return { status: "passed" as const, data: {} };
      } catch (error) {
        return releaseSnapshotUnavailable(
          "Could not prepare the pending skill release snapshot. Fix the Git or skill-package input and rerun bun run check --tag release.",
          error
        );
      }
    }
  });
}

export function createReleaseVersionCheck(
  state: ReleaseState,
  requiredCheckIds: readonly string[]
): Check {
  return defineCheck({
    checkId: releaseVersionCheckId,
    displayName: "Validate skill release versions",
    dependsOn: [...requiredCheckIds, releaseSnapshotCheckId],
    async execution() {
      const prepared = state.prepared;
      if (prepared === undefined) {
        return releaseSnapshotUnavailable(
          "Release version authorization did not receive a prepared snapshot. Rerun bun run check --tag release.",
          ""
        );
      }
      if (prepared.versionIssues.length === 0) {
        return { status: "passed" as const, data: {} };
      }
      state.prepared = undefined;
      const code = "release-version-invalid";
      return {
        status: "failed" as const,
        data: { versionIssueCount: prepared.versionIssues.length },
        messages: [
          {
            level: "error" as const,
            code,
            message: `Skill package versions are invalid against ${prepared.baselineRef}. Run bun run hash:skills -- --baseline-ref <ref> for the standalone diagnostic.`
          },
          ...prepared.versionIssues.flatMap((issue) =>
            diagnosticLines(issue).map((message) => ({
              level: "error" as const,
              code: `${code}-detail`,
              message: `- ${message}`
            }))
          )
        ]
      };
    }
  });
}

export function createPackSkillsCheck(
  packRelease: ReleasePacker | undefined,
  state: ReleaseState
): Check {
  const pack =
    packRelease ??
    ((preparedRelease: PreparedSkillPackageRelease, workspaceRoot: string) =>
      packSkillPackageSnapshot(
        preparedRelease.snapshot,
        path.join(workspaceRoot, "dist")
      ));
  return defineCheck({
    checkId: packSkillsCheckId,
    displayName: "Package skills",
    dependsOn: [releaseVersionCheckId],
    resourceClaims: repositoryScanClaim,
    async execution({ project }) {
      const prepared = state.prepared;
      if (prepared === undefined) {
        return releaseSnapshotUnavailable(
          "Packaging did not receive a prepared snapshot. Rerun bun run check --tag release.",
          ""
        );
      }
      try {
        await pack(prepared, project.root);
        return { status: "passed" as const, data: {} };
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        const code = "release-pack-failed";
        return {
          status: "failed" as const,
          data: {},
          messages: diagnosticMessages(
            code,
            "Could not package the prepared skill release snapshot.",
            detail
          )
        };
      } finally {
        state.prepared = undefined;
      }
    }
  });
}

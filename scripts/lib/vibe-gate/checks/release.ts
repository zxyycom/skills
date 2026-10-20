import path from "node:path";
import { defineCheck, defineContextCallback } from "@zxyycom/vibe-check";
import {
  packSkillPackageSnapshot,
  prepareSkillPackageRelease,
  type PreparedSkillPackageRelease
} from "../../skill-package-release.ts";
import {
  gateCheckDeclaration,
  type GateCheckConfiguration,
  repositoryProcessClaims,
  repositoryScanClaim
} from "../contracts.ts";
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
  configuration: GateCheckConfiguration = {}
) {
  const prepare = prepareRelease ?? prepareSkillPackageRelease;
  return defineCheck({
    checkId: releaseSnapshotCheckId,
    displayName: "Prepare skill release snapshot",
    options: { baselineRef },
    ...gateCheckDeclaration(
      releaseSnapshotCheckId,
      configuration,
      repositoryProcessClaims,
      [],
      "release"
    ),
    handoff: true,
    prepare(options: Readonly<{ baselineRef: string }>) {
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
    execute: defineContextCallback("check.execute", {
      contextNeeds: ["project", "signal"],
      async callback(
        options: Readonly<{ baselineRef: string }>,
        { project, signal }
      ) {
        try {
          const prepared = await prepare(project.root, options.baselineRef);
          if (signal.aborted)
            return releaseSnapshotUnavailable(
              "Release preparation was cancelled.",
              ""
            );
          return {
            status: "passed" as const,
            data: {
              baselineRef: prepared.baselineRef,
              versionIssueCount: prepared.versionIssues.length
            },
            handoff: prepared
          };
        } catch (error) {
          return releaseSnapshotUnavailable(
            "Could not prepare the pending skill release snapshot. Fix the Git or skill-package input and rerun bun run check --tag release.",
            error
          );
        }
      }
    })
  });
}

export function createReleaseVersionCheck(
  provider: ReturnType<typeof createReleasePrepareCheck>,
  requiredCheckIds: readonly string[],
  configuration: GateCheckConfiguration = {}
) {
  return defineCheck({
    checkId: releaseVersionCheckId,
    displayName: "Validate skill release versions",
    ...gateCheckDeclaration(
      releaseVersionCheckId,
      configuration,
      {},
      [...requiredCheckIds, provider.checkId],
      "release"
    ),
    handoff: true,
    execute: defineContextCallback("check.execute", {
      contextNeeds: ["dependencies"],
      async callback(_options, { dependencies }) {
        const read = dependencies.get(provider);
        if (!read.ok) {
          return releaseSnapshotUnavailable(
            "Release version authorization did not receive a prepared snapshot. Rerun bun run check --tag release.",
            ""
          );
        }
        const prepared = read.handoff;
        if (prepared.versionIssues.length === 0) {
          return {
            status: "passed" as const,
            data: { baselineRef: prepared.baselineRef },
            handoff: prepared
          };
        }
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
    })
  });
}

export function createPackSkillsCheck(
  packRelease: ReleasePacker | undefined,
  provider: ReturnType<typeof createReleaseVersionCheck>,
  configuration: GateCheckConfiguration = {}
) {
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
    ...gateCheckDeclaration(
      packSkillsCheckId,
      configuration,
      repositoryScanClaim,
      [provider.checkId],
      "release"
    ),
    execute: defineContextCallback("check.execute", {
      contextNeeds: ["dependencies", "project", "signal"],
      async callback(_options, { dependencies, project, signal }) {
        const read = dependencies.get(provider);
        if (!read.ok) {
          return releaseSnapshotUnavailable(
            "Packaging did not receive a prepared snapshot. Rerun bun run check --tag release.",
            ""
          );
        }
        try {
          if (signal.aborted)
            return releaseSnapshotUnavailable(
              "Release packaging was cancelled.",
              ""
            );
          await pack(read.handoff, project.root);
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
        }
      }
    })
  });
}

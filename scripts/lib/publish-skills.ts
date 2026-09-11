import type { PublishRequest, ReleaseAssets } from "./publish-skills-types.ts";
import { publishErrorMessage } from "./publish-skills-types.ts";
import {
  assetDifferences,
  collectReleaseAssets
} from "./publish-skills-assets.ts";
import {
  createRelease,
  execute,
  findRelease,
  uploadAssets
} from "./publish-skills-github.ts";

const workspaceRoot = process.cwd();
const rollingTag = "skills-latest";
const rollingName = "skills latest";

export async function runPublishSkills(): Promise<number> {
  try {
    const request = parseRequest(process.argv.slice(2), process.env);
    const assets = await collectReleaseAssets(workspaceRoot);
    const result =
      request.mode === "rolling"
        ? publishRolling(request, assets)
        : publishSnapshot(request, assets);
    console.log(`Skill Release ${result.action}: ${result.tag}`);
    return 0;
  } catch (error) {
    console.error(publishErrorMessage(error));
    return 1;
  }
}

function parseRequest(
  arguments_: readonly string[],
  environment: NodeJS.ProcessEnv
): PublishRequest {
  const mode = arguments_[0];
  if (arguments_.length !== 1 || (mode !== "rolling" && mode !== "snapshot")) {
    throw new Error("Usage: bun run publish:skills -- <rolling|snapshot>");
  }
  const packageHash = environment.PACKAGE_HASH;
  if (typeof packageHash !== "string" || !/^[0-9a-f]{64}$/u.test(packageHash)) {
    throw new Error(
      "PACKAGE_HASH must be a 64-character lowercase hexadecimal hash"
    );
  }
  const commitSha = environment.GITHUB_SHA;
  if (
    typeof commitSha !== "string" ||
    !/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u.test(commitSha)
  ) {
    throw new Error(
      "GITHUB_SHA must be a 40- or 64-character lowercase hexadecimal commit ID"
    );
  }
  if (
    typeof environment.GH_TOKEN !== "string" ||
    environment.GH_TOKEN.length === 0
  ) {
    throw new Error("GH_TOKEN is required to publish skill releases");
  }
  return { commitSha, mode, packageHash };
}

function publishRolling(
  request: PublishRequest,
  assets: ReleaseAssets
): { action: "created" | "updated"; tag: string } {
  const existing = findRelease(workspaceRoot, rollingTag);
  execute(
    workspaceRoot,
    "git",
    ["tag", "--force", rollingTag, request.commitSha],
    `Update local ${rollingTag} tag`
  );
  execute(
    workspaceRoot,
    "git",
    ["push", "--force", "origin", `refs/tags/${rollingTag}`],
    `Push ${rollingTag} tag`
  );

  const notes = releaseNotes(request);
  if (existing === undefined) {
    createRelease(workspaceRoot, {
      assets: assets.ordered,
      latest: true,
      name: rollingName,
      notes,
      tag: rollingTag,
      verifyTag: true
    });
    return { action: "created", tag: rollingTag };
  }

  uploadAssets(workspaceRoot, rollingTag, assets.packages);
  uploadAssets(workspaceRoot, rollingTag, [assets.manifest]);
  const currentNames = new Set(assets.ordered.map((asset) => asset.name));
  for (const asset of existing.assets) {
    if (!currentNames.has(asset.name)) {
      execute(
        workspaceRoot,
        "gh",
        ["release", "delete-asset", rollingTag, "--yes", "--", asset.name],
        `Delete stale asset ${asset.name} from GitHub Release ${rollingTag}`
      );
    }
  }
  execute(
    workspaceRoot,
    "gh",
    [
      "release",
      "edit",
      rollingTag,
      "--target",
      request.commitSha,
      "--title",
      rollingName,
      "--notes",
      notes,
      "--latest"
    ],
    `Update GitHub Release ${rollingTag}`
  );
  return { action: "updated", tag: rollingTag };
}

function publishSnapshot(
  request: PublishRequest,
  assets: ReleaseAssets
): { action: "created" | "reused"; tag: string } {
  const hashPrefix = request.packageHash.slice(0, 12);
  const tag = `skills-${hashPrefix}`;
  const existing = findRelease(workspaceRoot, tag);
  if (existing !== undefined) {
    const differences = assetDifferences(assets.ordered, existing.assets);
    if (differences.length > 0) {
      throw new Error(
        [
          `Snapshot ${tag} exists with different assets:`,
          ...differences.map((difference) => `- ${difference}`),
          "Remove the conflicting snapshot explicitly before retrying."
        ].join("\n")
      );
    }
    return { action: "reused", tag };
  }
  createRelease(workspaceRoot, {
    assets: assets.ordered,
    commitSha: request.commitSha,
    latest: false,
    name: `skills snapshot ${hashPrefix}`,
    notes: releaseNotes(request),
    tag,
    verifyTag: false
  });
  return { action: "created", tag };
}

function releaseNotes(request: PublishRequest): string {
  return [
    `Skill packages from ${request.commitSha}.`,
    "",
    `Package hash: ${request.packageHash}`
  ].join("\n");
}

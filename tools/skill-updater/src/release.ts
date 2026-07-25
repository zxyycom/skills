import process from "node:process";
import { unzipSync } from "fflate";
import * as v from "valibot";
import {
  validateSkillReleaseManifest,
  type SkillReleaseManifest
} from "../../skill-package/src/release-manifest.ts";
import {
  readSkillPackageIdentityFromMarkdown,
  skillEntryFileName,
  skillVersionMetadataPath
} from "../../skill-package/src/version.ts";
import type {
  RemoteSkillPackage,
  SkillFile,
  UpdaterConfig
} from "./types.ts";

const releaseStringSchema = v.pipe(
  v.string("must be a string"),
  v.minLength(1, "must not be empty")
);
const githubReleaseSchema = v.object(
  {
    assets: v.array(v.object({
      name: releaseStringSchema,
      url: releaseStringSchema
    }), "must be an array"),
    html_url: releaseStringSchema,
    tag_name: releaseStringSchema
  }
);

type GitHubRelease = v.InferOutput<typeof githubReleaseSchema>;

function formatReleaseIssues(
  issues: v.InferIssue<typeof githubReleaseSchema>[]
): string[] {
  return issues.map((issue) => {
    const issuePath = v.getDotPath(issue);
    return issuePath ? `${issuePath} ${issue.message}` : issue.message;
  });
}

function githubHeaders(accept: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: accept,
    "User-Agent": "skill-self-updater",
    "X-GitHub-Api-Version": "2022-11-28"
  };
  const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

function findReleaseAsset(
  release: GitHubRelease,
  assetName: string
): GitHubRelease["assets"][number] | null {
  return release.assets.find((candidate) => candidate.name === assetName) ?? null;
}

async function fetchReleaseAsset(
  release: GitHubRelease,
  assetName: string
): Promise<Uint8Array> {
  const asset = findReleaseAsset(release, assetName);
  if (!asset) {
    const availableAssets = release.assets.map((candidate) => candidate.name).join(", ") || "(none)";
    throw new Error(
      `Release ${release.tag_name} does not contain ${assetName}. Available assets: ${availableAssets}`
    );
  }

  const response = await fetch(asset.url, {
    headers: githubHeaders("application/octet-stream")
  });
  if (!response.ok) {
    throw new Error(
      `GitHub release asset download failed (${response.status}): ${await response.text()}`
    );
  }

  return new Uint8Array(await response.arrayBuffer());
}

export async function fetchGitHubRelease(
  config: UpdaterConfig,
  releaseTag: string | null
): Promise<GitHubRelease> {
  const encodedRepo = config.repo.split("/").map(encodeURIComponent).join("/");
  const encodedTag = releaseTag === null ? null : encodeURIComponent(releaseTag);
  const releaseApiUrl = encodedTag === null
    ? `https://api.github.com/repos/${encodedRepo}/releases/latest`
    : `https://api.github.com/repos/${encodedRepo}/releases/tags/${encodedTag}`;
  const response = await fetch(releaseApiUrl, {
    headers: githubHeaders("application/vnd.github+json")
  });

  if (!response.ok) {
    throw new Error(
      `GitHub release lookup failed (${response.status}): ${await response.text()}`
    );
  }

  let parsed: unknown;
  try {
    parsed = await response.json();
  } catch (error) {
    throw new Error(
      `GitHub release response for ${config.repo} must contain valid JSON: `
      + (error instanceof Error ? error.message : String(error))
    );
  }

  const validation = v.safeParse(githubReleaseSchema, parsed);
  if (!validation.success) {
    throw new Error(
      `GitHub release response for ${config.repo} is invalid:\n- `
      + formatReleaseIssues(validation.issues).join("\n- ")
    );
  }

  return validation.output;
}

async function fetchReleaseManifest(
  config: UpdaterConfig,
  release: GitHubRelease
): Promise<SkillReleaseManifest> {
  const data = await fetchReleaseAsset(release, config.releaseManifestAssetName);
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(data).toString("utf8"));
  } catch {
    throw new Error(
      `Release ${release.tag_name} contains invalid ${config.releaseManifestAssetName} JSON`
    );
  }

  const validation = validateSkillReleaseManifest(parsed);
  if (!validation.success) {
    throw new Error(
      `Release ${release.tag_name} contains invalid ${config.releaseManifestAssetName}:\n- `
      + validation.issues.join("\n- ")
    );
  }

  return validation.output;
}

function extractSkillFiles(
  config: UpdaterConfig,
  zipData: Uint8Array
): SkillFile[] {
  const sourcePath = config.skillName.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  const sourcePrefix = `${sourcePath}/`;
  const seenTargets = new Map<string, string>();
  const skillFiles = Object.entries(unzipSync(zipData))
    .sort(([left], [right]) => left.localeCompare(right))
    .flatMap(([entryPath, data]) => {
      const relativePath = skillArchiveFilePath(entryPath, sourcePrefix);
      if (relativePath === null) {
        return [];
      }
      const targetIdentity = skillFileTargetIdentity(relativePath);
      const previousPath = seenTargets.get(targetIdentity);
      if (previousPath !== undefined) {
        throw new Error(
          `Remote release paths ${JSON.stringify(previousPath)} and `
          + `${JSON.stringify(relativePath)} target the same local skill file`
        );
      }
      seenTargets.set(targetIdentity, relativePath);
      return [{
        data: Buffer.from(data),
        path: relativePath
      }];
    });

  if (!skillFiles.some((file) => file.path === "SKILL.md")) {
    throw new Error(`Remote release asset does not contain ${sourcePath}/SKILL.md`);
  }

  return skillFiles;
}

function skillArchiveFilePath(
  entryPath: string,
  sourcePrefix: string
): string | null {
  if (!entryPath.startsWith(sourcePrefix) || entryPath.endsWith("/")) {
    return null;
  }
  const relativePath = entryPath.slice(sourcePrefix.length);
  const segments = relativePath.split("/");
  if (
    relativePath.length === 0
    || relativePath.includes("\\")
    || relativePath.includes("\0")
    || segments.some((segment) => (
      segment.length === 0 || segment === "." || segment === ".."
    ))
  ) {
    throw new Error(
      `Remote release asset contains non-canonical skill path: ${entryPath}`
    );
  }
  return relativePath;
}

function skillFileTargetIdentity(relativePath: string): string {
  return process.platform === "win32" || process.platform === "darwin"
    ? relativePath.toLowerCase()
    : relativePath;
}

async function fetchReleaseSkillFiles(
  config: UpdaterConfig,
  release: GitHubRelease
): Promise<SkillFile[]> {
  const zipData = await fetchReleaseAsset(release, config.releaseAssetName);
  return extractSkillFiles(config, zipData);
}

export async function resolveRemoteSkillPackage(
  config: UpdaterConfig,
  release: GitHubRelease
): Promise<RemoteSkillPackage> {
  const manifest = await fetchReleaseManifest(config, release);
  const skillRelease = manifest.skills[config.skillName];
  if (skillRelease === undefined) {
    throw new Error(
      `${config.releaseManifestAssetName} does not contain a version for ${config.skillName}`
    );
  }

  return {
    version: skillRelease.version
  };
}

export async function loadRemoteSkillFiles(
  config: UpdaterConfig,
  release: GitHubRelease,
  remotePackage: RemoteSkillPackage
): Promise<SkillFile[]> {
  const files = await fetchReleaseSkillFiles(config, release);
  const skillEntry = files.find((file) => file.path === skillEntryFileName);
  if (skillEntry === undefined) {
    throw new Error(
      `Release asset ${config.releaseAssetName} does not contain ${skillEntryFileName}`
    );
  }

  const skillEntrySource = `${config.releaseAssetName}/${skillEntryFileName}`;
  const packageIdentity = readSkillPackageIdentityFromMarkdown(
    skillEntry.data.toString("utf8"),
    skillEntrySource
  );
  if (packageIdentity.name !== config.skillName) {
    throw new Error(
      `Release asset ${config.releaseAssetName} identifies skill `
      + `${JSON.stringify(packageIdentity.name)} in ${skillEntryFileName}, but this updater expects `
      + `${JSON.stringify(config.skillName)}. Use the matching updater or publish a corrected asset.`
    );
  }
  if (packageIdentity.version === null) {
    throw new Error(
      `${skillEntrySource} frontmatter ${skillVersionMetadataPath} is required`
    );
  }
  if (packageIdentity.version !== remotePackage.version) {
    throw new Error(
      `Release asset ${config.releaseAssetName} version ${packageIdentity.version}`
      + ` does not match ${config.releaseManifestAssetName} version ${remotePackage.version}`
    );
  }

  return files;
}

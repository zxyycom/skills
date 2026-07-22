import process from "node:process";
import { unzipSync } from "fflate";
import * as v from "valibot";
import { calculateSkillPackageFingerprint } from "../../skill-package/src/fingerprint.ts";
import {
  validateSkillPackageLock,
  type SkillPackageLock
} from "../../skill-package/src/lock.ts";
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

async function fetchReleasePackageLock(
  config: UpdaterConfig,
  release: GitHubRelease
): Promise<SkillPackageLock | null> {
  if (!findReleaseAsset(release, config.packageLockAssetName)) {
    return null;
  }

  const data = await fetchReleaseAsset(release, config.packageLockAssetName);
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(data).toString("utf8"));
  } catch {
    throw new Error(
      `Release ${release.tag_name} contains invalid ${config.packageLockAssetName} JSON`
    );
  }

  const validation = validateSkillPackageLock(parsed);
  if (!validation.success) {
    throw new Error(
      `Release ${release.tag_name} contains invalid ${config.packageLockAssetName}:\n- `
      + validation.issues.join("\n- ")
    );
  }

  const skillHash = validation.output.skills[config.skillName];
  if (skillHash === undefined) {
    throw new Error(
      `${config.packageLockAssetName} does not contain a valid hash for ${config.skillName}`
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
  const skillFiles = Object.entries(unzipSync(zipData))
    .sort(([left], [right]) => left.localeCompare(right))
    .filter(([entryPath]) => entryPath.startsWith(sourcePrefix) && !entryPath.endsWith("/"))
    .map(([entryPath, data]) => ({
      data: Buffer.from(data),
      path: entryPath.slice(sourcePrefix.length)
    }))
    .filter((file) => file.path.length > 0)
    .sort((left, right) => left.path.localeCompare(right.path));

  if (!skillFiles.some((file) => file.path === "SKILL.md")) {
    throw new Error(`Remote release asset does not contain ${sourcePath}/SKILL.md`);
  }

  return skillFiles;
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
  const packageLock = await fetchReleasePackageLock(config, release);
  if (packageLock) {
    return {
      aggregateHash: packageLock.aggregateHash,
      files: null,
      fingerprint: packageLock.skills[config.skillName],
      source: "package-lock"
    };
  }

  const files = await fetchReleaseSkillFiles(config, release);
  return {
    aggregateHash: null,
    files,
    fingerprint: calculateSkillPackageFingerprint(config.skillName, files),
    source: "zip"
  };
}

export async function loadRemoteSkillFiles(
  config: UpdaterConfig,
  release: GitHubRelease,
  remotePackage: RemoteSkillPackage
): Promise<SkillFile[]> {
  if (remotePackage.source === "zip") {
    return remotePackage.files;
  }

  const files = await fetchReleaseSkillFiles(config, release);
  const zipFingerprint = calculateSkillPackageFingerprint(config.skillName, files);
  if (zipFingerprint !== remotePackage.fingerprint) {
    throw new Error(
      `Release asset ${config.releaseAssetName} fingerprint ${zipFingerprint}`
      + ` does not match ${config.packageLockAssetName} hash ${remotePackage.fingerprint}`
    );
  }

  return files;
}

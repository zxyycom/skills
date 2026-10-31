export type PublishMode = "rolling" | "snapshot";

export type PublishRequest = Readonly<{
  commitSha: string;
  mode: PublishMode;
  packageHash: string;
}>;

export type LocalAsset = Readonly<{
  digest: string;
  name: string;
  path: string;
  size: number;
}>;

export type ReleaseAssets = Readonly<{
  manifest: LocalAsset;
  ordered: readonly LocalAsset[];
  packages: readonly LocalAsset[];
}>;

export type PublishedAsset = Readonly<{
  digest: string | null;
  name: string;
  size: number;
}>;

export type PublishedRelease = Readonly<{
  assets: readonly PublishedAsset[];
}>;

export type PublishCommandResult = Readonly<{
  status: number | null;
  stderr: string;
  stdout: string;
}>;

export const releaseManifestName = "skill-release-manifest.json";

export function comparePublishText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function publishErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function isPublishRecord(
  value: unknown
): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

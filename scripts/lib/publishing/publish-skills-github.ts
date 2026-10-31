import { spawnSync } from "node:child_process";
import type {
  LocalAsset,
  PublishCommandResult,
  PublishedAsset,
  PublishedRelease
} from "./publish-skills-types.ts";
import {
  isPublishRecord,
  publishErrorMessage
} from "./publish-skills-types.ts";

export function findRelease(
  workspaceRoot: string,
  tag: string
): PublishedRelease | undefined {
  const result = inspect(workspaceRoot, "gh", [
    "release",
    "view",
    tag,
    "--json",
    "tagName,assets"
  ]);
  if (result.status === 0) return parseRelease(result.stdout, tag);
  if (
    /(?:release not found|HTTP 404|404 Not Found)/iu.test(
      `${result.stdout}\n${result.stderr}`
    )
  ) {
    return undefined;
  }
  throw new Error(commandFailure(`Inspect GitHub Release ${tag}`, result));
}

function parseReleaseJson(source: string, expectedTag: string): unknown {
  try {
    return JSON.parse(source);
  } catch (error) {
    throw new Error(
      `GitHub Release ${expectedTag} returned invalid JSON: ${publishErrorMessage(error)}`
    );
  }
}

function isPublishedAssetRecord(
  value: unknown
): value is Record<string, unknown> & { name: string; size: number } {
  return (
    isPublishRecord(value) &&
    typeof value.name === "string" &&
    value.name.length > 0 &&
    typeof value.size === "number" &&
    Number.isSafeInteger(value.size) &&
    value.size >= 0 &&
    (value.digest === null ||
      value.digest === undefined ||
      typeof value.digest === "string")
  );
}

function parsePublishedAsset(
  value: unknown,
  expectedTag: string
): PublishedAsset {
  if (!isPublishedAssetRecord(value)) {
    throw new Error(
      `GitHub Release ${expectedTag} returned an invalid asset record`
    );
  }
  return {
    digest: typeof value.digest === "string" ? value.digest : null,
    name: value.name,
    size: value.size
  };
}

function parseRelease(source: string, expectedTag: string): PublishedRelease {
  const value = parseReleaseJson(source, expectedTag);
  if (
    !isPublishRecord(value) ||
    value.tagName !== expectedTag ||
    !Array.isArray(value.assets)
  ) {
    throw new Error(
      `GitHub Release ${expectedTag} returned invalid tagName or assets`
    );
  }
  const assets: PublishedAsset[] = [];
  const names = new Set<string>();
  for (const assetValue of value.assets) {
    const asset = parsePublishedAsset(assetValue, expectedTag);
    if (names.has(asset.name)) {
      throw new Error(
        `GitHub Release ${expectedTag} returned an invalid asset record`
      );
    }
    names.add(asset.name);
    assets.push(asset);
  }
  return { assets };
}

export function uploadAssets(
  workspaceRoot: string,
  tag: string,
  assets: readonly LocalAsset[]
): void {
  execute(
    workspaceRoot,
    "gh",
    [
      "release",
      "upload",
      tag,
      ...assets.map((asset) => asset.path),
      "--clobber"
    ],
    `Upload assets to GitHub Release ${tag}`
  );
}

export function createRelease(
  workspaceRoot: string,
  options: {
    assets: readonly LocalAsset[];
    commitSha?: string;
    latest: boolean;
    name: string;
    notes: string;
    tag: string;
    verifyTag: boolean;
  }
): void {
  const arguments_ = [
    "release",
    "create",
    options.tag,
    "--title",
    options.name,
    "--notes",
    options.notes,
    options.latest ? "--latest" : "--latest=false"
  ];
  if (options.commitSha !== undefined) {
    arguments_.push("--target", options.commitSha);
  }
  if (options.verifyTag) arguments_.push("--verify-tag");
  arguments_.push(...options.assets.map((asset) => asset.path));
  execute(
    workspaceRoot,
    "gh",
    arguments_,
    `Create GitHub Release ${options.tag}`
  );
}

export function execute(
  workspaceRoot: string,
  command: string,
  arguments_: readonly string[],
  label: string
): void {
  const result = spawnSync(command, arguments_, {
    cwd: workspaceRoot,
    env: process.env,
    stdio: "inherit",
    windowsHide: true
  });
  if (result.error !== undefined) {
    throw new Error(`${label} could not start: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(
      `${label} failed with exit status ${String(result.status)}`
    );
  }
}

function inspect(
  workspaceRoot: string,
  command: string,
  arguments_: readonly string[]
): PublishCommandResult {
  const result = spawnSync(command, arguments_, {
    cwd: workspaceRoot,
    encoding: "utf8",
    env: process.env,
    stdio: "pipe",
    windowsHide: true
  });
  if (result.error !== undefined) {
    throw new Error(`Cannot start ${command}: ${result.error.message}`);
  }
  return {
    status: result.status,
    stderr: result.stderr,
    stdout: result.stdout
  };
}

function commandFailure(label: string, result: PublishCommandResult): string {
  const detail = [result.stderr.trim(), result.stdout.trim()].find(
    (candidate) => candidate.length > 0
  );
  return (
    `${label} failed with exit status ${String(result.status)}` +
    (detail === undefined ? "" : `: ${detail}`)
  );
}

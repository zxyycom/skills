import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const workspaceRoot = process.cwd();
const rollingTag = "skills-latest";
const rollingName = "skills latest";
const manifestName = "skill-release-manifest.json";

type PublishMode = "rolling" | "snapshot";

type PublishRequest = {
  commitSha: string;
  mode: PublishMode;
  packageHash: string;
};

type LocalAsset = {
  digest: string;
  name: string;
  path: string;
  size: number;
};

type ReleaseAssets = {
  manifest: LocalAsset;
  ordered: readonly LocalAsset[];
  packages: readonly LocalAsset[];
};

type PublishedAsset = {
  digest: string | null;
  name: string;
  size: number;
};

type PublishedRelease = {
  assets: readonly PublishedAsset[];
};

type CommandResult = {
  status: number | null;
  stderr: string;
  stdout: string;
};

export async function runPublishSkills(): Promise<number> {
  try {
    const request = parseRequest(process.argv.slice(2), process.env);
    const assets = await collectAssets();
    const result =
      request.mode === "rolling"
        ? publishRolling(request, assets)
        : publishSnapshot(request, assets);
    console.log(`Skill Release ${result.action}: ${result.tag}`);
    return 0;
  } catch (error) {
    console.error(errorMessage(error));
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

async function collectAssets(): Promise<ReleaseAssets> {
  const distDirectory = path.join(workspaceRoot, "dist");
  let entries;
  try {
    entries = await fs.readdir(distDirectory, { withFileTypes: true });
  } catch (error) {
    throw new Error(
      `Cannot read release assets from dist/: ${errorMessage(error)}`
    );
  }

  const packageEntries = entries
    .filter((entry) => entry.name.endsWith(".zip"))
    .sort((left, right) => compareText(left.name, right.name));
  if (packageEntries.length === 0) {
    throw new Error(
      "Release assets are incomplete: dist/ must contain at least one skill zip"
    );
  }
  for (const entry of packageEntries) {
    if (!entry.isFile()) {
      throw new Error(
        `Release asset must be a regular file: dist/${entry.name}`
      );
    }
  }

  const manifestEntry = entries.find((entry) => entry.name === manifestName);
  if (manifestEntry === undefined || !manifestEntry.isFile()) {
    throw new Error(
      `Release assets are incomplete: dist/${manifestName} must be a regular file`
    );
  }

  const packages = await Promise.all(
    packageEntries.map((entry) => readAsset(distDirectory, entry.name))
  );
  const manifest = await readAsset(distDirectory, manifestName);
  return { manifest, ordered: [...packages, manifest], packages };
}

async function readAsset(directory: string, name: string): Promise<LocalAsset> {
  const assetPath = path.join(directory, name);
  let data: Buffer;
  try {
    data = await fs.readFile(assetPath);
  } catch (error) {
    throw new Error(
      `Cannot read release asset dist/${name}: ${errorMessage(error)}`
    );
  }
  return {
    digest: `sha256:${createHash("sha256").update(data).digest("hex")}`,
    name,
    path: assetPath,
    size: data.byteLength
  };
}

function publishRolling(
  request: PublishRequest,
  assets: ReleaseAssets
): { action: "created" | "updated"; tag: string } {
  const existing = findRelease(rollingTag);
  execute(
    "git",
    ["tag", "--force", rollingTag, request.commitSha],
    `Update local ${rollingTag} tag`
  );
  execute(
    "git",
    ["push", "--force", "origin", `refs/tags/${rollingTag}`],
    `Push ${rollingTag} tag`
  );

  const notes = releaseNotes(request);
  if (existing === undefined) {
    createRelease({
      assets: assets.ordered,
      latest: true,
      name: rollingName,
      notes,
      tag: rollingTag,
      verifyTag: true
    });
    return { action: "created", tag: rollingTag };
  }

  uploadAssets(rollingTag, assets.packages);
  uploadAssets(rollingTag, [assets.manifest]);
  const currentNames = new Set(assets.ordered.map((asset) => asset.name));
  for (const asset of existing.assets) {
    if (!currentNames.has(asset.name)) {
      execute(
        "gh",
        ["release", "delete-asset", rollingTag, "--yes", "--", asset.name],
        `Delete stale asset ${asset.name} from GitHub Release ${rollingTag}`
      );
    }
  }
  execute(
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
  const existing = findRelease(tag);
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

  createRelease({
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

function findRelease(tag: string): PublishedRelease | undefined {
  const result = inspect("gh", [
    "release",
    "view",
    tag,
    "--json",
    "tagName,assets"
  ]);
  if (result.status === 0) {
    return parseRelease(result.stdout, tag);
  }
  if (
    /(?:release not found|HTTP 404|404 Not Found)/iu.test(
      `${result.stdout}\n${result.stderr}`
    )
  ) {
    return undefined;
  }
  throw new Error(commandFailure(`Inspect GitHub Release ${tag}`, result));
}

function parseRelease(source: string, expectedTag: string): PublishedRelease {
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch (error) {
    throw new Error(
      `GitHub Release ${expectedTag} returned invalid JSON: ${errorMessage(error)}`
    );
  }
  if (
    !isRecord(value) ||
    value.tagName !== expectedTag ||
    !Array.isArray(value.assets)
  ) {
    throw new Error(
      `GitHub Release ${expectedTag} returned invalid tagName or assets`
    );
  }

  const assets: PublishedAsset[] = [];
  const names = new Set<string>();
  for (const asset of value.assets) {
    if (
      !isRecord(asset) ||
      typeof asset.name !== "string" ||
      asset.name.length === 0 ||
      typeof asset.size !== "number" ||
      !Number.isSafeInteger(asset.size) ||
      asset.size < 0 ||
      !(
        asset.digest === null ||
        asset.digest === undefined ||
        typeof asset.digest === "string"
      ) ||
      names.has(asset.name)
    ) {
      throw new Error(
        `GitHub Release ${expectedTag} returned an invalid asset record`
      );
    }
    names.add(asset.name);
    assets.push({
      digest: typeof asset.digest === "string" ? asset.digest : null,
      name: asset.name,
      size: asset.size
    });
  }
  return { assets };
}

function assetDifferences(
  expected: readonly LocalAsset[],
  published: readonly PublishedAsset[]
): string[] {
  const expectedByName = new Map(expected.map((asset) => [asset.name, asset]));
  const publishedByName = new Map(
    published.map((asset) => [asset.name, asset])
  );
  const differences: string[] = [];

  for (const asset of expected) {
    const actual = publishedByName.get(asset.name);
    if (actual === undefined) {
      differences.push(`missing published asset ${asset.name}`);
      continue;
    }
    if (actual.size !== asset.size) {
      differences.push(
        `${asset.name} size is ${String(actual.size)}, expected ${String(asset.size)}`
      );
    }
    if (actual.digest !== asset.digest) {
      differences.push(
        `${asset.name} digest is ${actual.digest ?? "unavailable"}, expected ${asset.digest}`
      );
    }
  }
  for (const asset of published) {
    if (!expectedByName.has(asset.name)) {
      differences.push(`unexpected published asset ${asset.name}`);
    }
  }
  return differences.sort(compareText);
}

function uploadAssets(tag: string, assets: readonly LocalAsset[]): void {
  execute(
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

function createRelease(options: {
  assets: readonly LocalAsset[];
  commitSha?: string;
  latest: boolean;
  name: string;
  notes: string;
  tag: string;
  verifyTag: boolean;
}): void {
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
  if (options.verifyTag) {
    arguments_.push("--verify-tag");
  }
  arguments_.push(...options.assets.map((asset) => asset.path));
  execute("gh", arguments_, `Create GitHub Release ${options.tag}`);
}

function execute(
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
  command: string,
  arguments_: readonly string[]
): CommandResult {
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

function commandFailure(label: string, result: CommandResult): string {
  const detail = [result.stderr.trim(), result.stdout.trim()].find(
    (candidate) => candidate.length > 0
  );
  return (
    `${label} failed with exit status ${String(result.status)}` +
    (detail === undefined ? "" : `: ${detail}`)
  );
}

function releaseNotes(request: PublishRequest): string {
  return [
    `Skill packages from ${request.commitSha}.`,
    "",
    `Package hash: ${request.packageHash}`
  ].join("\n");
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

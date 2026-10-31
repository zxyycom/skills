import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type {
  LocalAsset,
  PublishedAsset,
  ReleaseAssets
} from "./publish-skills-types.ts";
import {
  comparePublishText,
  publishErrorMessage,
  releaseManifestName
} from "./publish-skills-types.ts";

export async function collectReleaseAssets(
  workspaceRoot: string
): Promise<ReleaseAssets> {
  const distDirectory = path.join(workspaceRoot, "dist");
  let entries;
  try {
    entries = await fs.readdir(distDirectory, { withFileTypes: true });
  } catch (error) {
    throw new Error(
      `Cannot read release assets from dist/: ${publishErrorMessage(error)}`
    );
  }

  const packageEntries = entries
    .filter((entry) => entry.name.endsWith(".zip"))
    .sort((left, right) => comparePublishText(left.name, right.name));
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

  const manifestEntry = entries.find(
    (entry) => entry.name === releaseManifestName
  );
  if (manifestEntry === undefined || !manifestEntry.isFile()) {
    throw new Error(
      `Release assets are incomplete: dist/${releaseManifestName} must be a regular file`
    );
  }
  const packages = await Promise.all(
    packageEntries.map((entry) => readAsset(distDirectory, entry.name))
  );
  const manifest = await readAsset(distDirectory, releaseManifestName);
  return { manifest, ordered: [...packages, manifest], packages };
}

async function readAsset(directory: string, name: string): Promise<LocalAsset> {
  const assetPath = path.join(directory, name);
  let data: Buffer;
  try {
    data = await fs.readFile(assetPath);
  } catch (error) {
    throw new Error(
      `Cannot read release asset dist/${name}: ${publishErrorMessage(error)}`
    );
  }
  return {
    digest: `sha256:${createHash("sha256").update(data).digest("hex")}`,
    name,
    path: assetPath,
    size: data.byteLength
  };
}

export function assetDifferences(
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
  return differences.sort(comparePublishText);
}

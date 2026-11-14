import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { buildCandidate, treeDigest } from "./build.ts";
import { installCandidate } from "./install.ts";
import { hostTarget, parseManifest, sha256 } from "./manifest.ts";
import type { Manifest } from "./manifest.ts";

async function inspectCandidate(root: string): Promise<Manifest> {
  const manifest = parseManifest(
    JSON.parse(
      await readFile(
        path.join(root, "assets/record-cli-candidate.json"),
        "utf8"
      )
    ) as unknown
  );
  assert.equal(manifest.target, hostTarget());
  const listing: unknown = JSON.parse(
    await readFile(path.join(root, "source-files.json"), "utf8")
  );
  const actual = await treeDigest(path.join(root, "source"));
  assert.deepEqual(listing, actual);
  assert.equal(actual.sha256, manifest.source.sha256);
  for (const asset of manifest.assets) {
    const bytes = await readFile(path.join(root, "assets", asset.file));
    assert.equal(bytes.length, asset.size);
    assert.equal(sha256(bytes), asset.sha256);
  }
  return manifest;
}

async function verifyInstalled(
  destination: string,
  manifest: Manifest
): Promise<void> {
  for (const asset of manifest.assets) {
    const file = path.join(destination, asset.file);
    assert.equal(sha256(await readFile(file)), asset.sha256);
    const version = spawnSync(file, ["--version"], { encoding: "utf8" });
    assert.equal(version.status, 0);
    assert.equal(version.stdout.trim(), `${asset.role} ${manifest.version}`);
    const help = spawnSync(file, ["--help"], { encoding: "utf8" });
    assert.equal(help.status, 0);
    assert.ok(
      asset.role === "resource-records"
        ? help.stdout.includes("resource-records <list")
        : help.stdout.includes("Usage:")
    );
  }
}

async function verifyFixture(
  destination: string,
  first: string,
  second: string,
  a: Manifest,
  b: Manifest
): Promise<void> {
  await writeFile(
    path.join(destination, ".record-cli-fixture"),
    "record-cli private fixture\n"
  );
  await writeFile(path.join(destination, "unrelated"), "sentinel");
  await installCandidate({
    source: path.join(first, "assets"),
    destination,
    version: a.version
  });
  await verifyInstalled(destination, a);
  const before = await Promise.all(
    (await readdir(destination)).map(
      async (name) =>
        [name, await readFile(path.join(destination, name))] as const
    )
  );
  await assert.rejects(
    installCandidate({
      source: path.join(second, "assets"),
      destination,
      version: b.version,
      failAfter: 1
    }),
    /rolled back/
  );
  assert.deepEqual(
    await readdir(destination),
    before.map(([name]) => name)
  );
  for (const [name, bytes] of before)
    assert.deepEqual(await readFile(path.join(destination, name)), bytes);
  await installCandidate({
    source: path.join(second, "assets"),
    destination,
    version: b.version
  });
  await verifyInstalled(destination, b);
  assert.equal(
    await readFile(path.join(destination, "unrelated"), "utf8"),
    "sentinel"
  );
}

async function verifyUpdate(first: string, second: string): Promise<void> {
  const a = await inspectCandidate(first);
  const b = await inspectCandidate(second);
  assert.equal(a.version, "0.1.0");
  assert.equal(b.version, "0.1.1");
  assert.notEqual(a.source.sha256, b.source.sha256);
  for (const asset of a.assets) {
    const successor = b.assets.find((entry) => entry.role === asset.role);
    assert.ok(successor);
    assert.notEqual(asset.sha256, successor.sha256);
  }
  const destination = await mkdtemp(path.join(os.tmpdir(), "record-cli-real-"));
  let success = false;
  try {
    await verifyFixture(destination, first, second, a, b);
    success = true;
    process.stdout.write(
      `${JSON.stringify({ result: "passed", target: a.target, firstVersion: a.version, secondVersion: b.version, firstSource: a.source.sha256, secondSource: b.source.sha256 })}\n`
    );
  } catch (error) {
    throw new Error(
      `real verification failed; fixture retained at ${destination}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error }
    );
  } finally {
    if (success) await rm(destination, { recursive: true, force: true });
  }
}

async function main(args: string[]): Promise<void> {
  if (args[0] === "--build" && args.length === 2) {
    const name = args[1];
    if (!name || !/^[a-z0-9][a-z0-9-]*$/.test(name))
      throw new Error("invalid new build name");
    const firstAssets = await buildCandidate(`${name}-a`, "0.1.0");
    const first = path.dirname(firstAssets);
    const secondAssets = await buildCandidate(
      `${name}-b`,
      "0.1.1",
      path.join(first, "source")
    );
    await verifyUpdate(first, path.dirname(secondAssets));
    return;
  }
  if (args.length === 2 && args[0] && args[1]) {
    await verifyUpdate(path.resolve(args[0]), path.resolve(args[1]));
    return;
  }
  throw new Error(
    "usage: node verify-real.ts --build <new-name> | <first-build-directory> <second-build-directory>"
  );
}

main(process.argv.slice(2)).catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`
  );
  process.exitCode = 1;
});

import * as v from "valibot";
import { treeDigest } from "../../../tools/record-cli/delivery/build.ts";
import { assertRuntimeDirectory } from "./runtime.ts";
import fs from "node:fs/promises";
import path from "node:path";
import { assertNativeRelativePaths } from "../../../tools/skill-package/src/native-paths.ts";
import { digestNativeSource, type NativeCandidateSnapshot } from "./capture.ts";
import { packSkillPackageSnapshot } from "../skill-package/skill-package-release.ts";
import type { SkillPackageSnapshot } from "../skill-package/skill-package-hash.ts";

async function ensureOwnedParent(directory: string): Promise<void> {
  try {
    await fs.mkdir(directory);
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "EEXIST"))
      throw error;
  }
  const info = await fs.lstat(directory);
  if (!info.isDirectory() || info.isSymbolicLink())
    throw new Error(`staging parent must be a regular directory: ${directory}`);
}

/** Allocate an exclusive package stage without removing any existing output. */
export async function createReleasePackageStage(
  workspaceRoot: string,
  name?: string
): Promise<string> {
  if (name !== undefined && !/^package-[A-Za-z0-9_-]{1,80}$/u.test(name))
    throw new Error("release stage name must be a package-prefixed safe leaf");
  const root = path.resolve(workspaceRoot);
  await assertRuntimeDirectory(root);
  const dist = path.join(root, "dist");
  const parent = path.join(dist, "skill-release");
  await ensureOwnedParent(dist);
  await ensureOwnedParent(parent);
  if (name === undefined) return fs.mkdtemp(path.join(parent, "package-"));
  const stage = path.join(parent, name);
  await fs.mkdir(stage);
  return stage;
}

/** Pack only into a directory this invocation created exclusively. */
export async function packIsolatedSkillSnapshot(
  snapshot: SkillPackageSnapshot,
  workspaceRoot: string,
  name?: string
) {
  const stage = await createReleasePackageStage(workspaceRoot, name);
  // Keep the exclusive stage root for the full operation: the legacy packer
  // replaces only this invocation's child, never the ownership claim itself.
  return packSkillPackageSnapshot(snapshot, path.join(stage, "packages"));
}

/** Write a candidate snapshot to a new owned staging directory, never the dist root. */
export async function stageNativeCandidateInputs(
  workspaceRoot: string,
  snapshot: NativeCandidateSnapshot
): Promise<string> {
  assertNativeRelativePaths(snapshot.source.map((file) => file.path));
  assertNativeRelativePaths(snapshot.delivery.map((file) => file.path));
  if (digestNativeSource(snapshot.delivery) !== snapshot.deliveryHash)
    throw new Error("native delivery snapshot digest changed");
  if (digestNativeSource(snapshot.source) !== snapshot.sourceHash)
    throw new Error("native source snapshot digest changed");
  const root = path.resolve(workspaceRoot);
  await assertRuntimeDirectory(root);
  const dist = path.join(root, "dist");
  const stagingRoot = path.join(dist, "skill-release");
  await ensureOwnedParent(dist);
  await ensureOwnedParent(stagingRoot);
  const stage = await fs.mkdtemp(path.join(stagingRoot, "candidate-"));
  const source = path.join(stage, "source");
  await fs.mkdir(source);
  for (const file of snapshot.source) {
    const output = path.join(source, ...file.path.split("/"));
    await fs.mkdir(path.dirname(output), { recursive: true });
    await fs.writeFile(output, file.data, { flag: "wx" });
  }
  const written = await Promise.all(
    snapshot.source.map(async (file) => ({
      path: file.path,
      data: await fs.readFile(path.join(source, ...file.path.split("/")))
    }))
  );
  if (digestNativeSource(written) !== snapshot.sourceHash)
    throw new Error(`staged native source changed: ${stage}`);
  await fs.writeFile(
    path.join(stage, "source-files.json"),
    `${JSON.stringify({ sha256: snapshot.sourceHash, files: snapshot.source.map((file) => file.path) }, null, 2)}\n`,
    { flag: "wx" }
  );
  const delivery = path.join(stage, "delivery");
  await fs.mkdir(delivery);
  for (const file of snapshot.delivery) {
    const output = path.join(delivery, ...file.path.split("/"));
    await fs.mkdir(path.dirname(output), { recursive: true });
    await fs.writeFile(output, file.data, { flag: "wx" });
  }
  const deliveryWritten = await Promise.all(
    snapshot.delivery.map(async (file) => ({
      path: file.path,
      data: await fs.readFile(path.join(delivery, ...file.path.split("/")))
    }))
  );
  if (digestNativeSource(deliveryWritten) !== snapshot.deliveryHash)
    throw new Error(`staged delivery source changed: ${stage}`);
  await fs.writeFile(
    path.join(stage, "delivery-files.json"),
    `${JSON.stringify({ sha256: snapshot.deliveryHash, files: snapshot.delivery.map((file) => file.path) }, null, 2)}\n`,
    { flag: "wx" }
  );
  await packSkillPackageSnapshot(snapshot.skills, path.join(stage, "skills"));
  return stage;
}

/** Recheck the exact frozen delivery tree immediately before source generation. */
export async function readStagedDelivery(
  stage: string,
  expectedHash: string
): Promise<readonly { path: string; data: Buffer }[]> {
  const directory = path.join(stage, "delivery");
  await assertRuntimeDirectory(directory);
  const metadata: unknown = JSON.parse(
    await fs.readFile(path.join(stage, "delivery-files.json"), "utf8")
  );
  const parsed = v.safeParse(
    v.strictObject({ sha256: v.string(), files: v.array(v.string()) }),
    metadata
  );
  const actual = await treeDigest(directory);
  if (
    !parsed.success ||
    parsed.output.sha256 !== expectedHash ||
    parsed.output.sha256 !== actual.sha256 ||
    JSON.stringify(parsed.output.files) !== JSON.stringify(actual.files)
  )
    throw new Error("staged delivery differs from its frozen manifest");
  const files = await Promise.all(
    actual.files.map(async (name) => ({
      path: name,
      data: await fs.readFile(path.join(directory, ...name.split("/")))
    }))
  );
  if (digestNativeSource(files) !== actual.sha256)
    throw new Error("staged delivery changed while reading");
  return files;
}

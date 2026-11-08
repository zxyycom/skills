import { spawnSync } from "node:child_process";
import { readNativeBuildRecipe } from "../lib/record-native/candidate-build-recipe.ts";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import * as v from "valibot";
import { extractNativeArchive } from "../../tools/skill-updater/src/native/archive.ts";
import { readSkillPackageIdentityFromMarkdown } from "../../tools/skill-package/src/version.ts";
import {
  nativeRoles,
  nativeTargets,
  type NativeRole,
  type NativeTarget
} from "../../tools/skill-package/src/native-release-manifest.ts";
import { skillReleaseManifestSchema } from "../../tools/skill-package/src/release-manifest.ts";
import {
  captureNativeCandidateSnapshot,
  digestNativeSource,
  type NativeCandidateSnapshot
} from "../lib/record-native/capture.ts";
import { readStagedDelivery } from "../lib/record-native/staging.ts";
import {
  assembleCandidateRelease,
  validatePlatformSourceEvidence,
  writeCandidateRelease
} from "../lib/record-native/candidate-release.ts";
import { assertRuntimeDirectory } from "../lib/record-native/runtime.ts";

const sourceSchema = v.strictObject({
  sha256: v.string(),
  files: v.array(v.string())
});
const workerSchema = v.object({
  sourceHash: v.string(),
  deliveryHash: v.string(),
  skillInputHashes: v.record(v.string(), v.string()),
  packages: v.record(
    v.string(),
    v.object({ asset: v.object({ sha256: v.string() }) })
  ),
  bootstrap: v.object({ asset: v.object({ sha256: v.string() }) })
});
function asset(name: string, bytes: Buffer) {
  return {
    name,
    byteLength: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex")
  };
}
async function readJson(file: string): Promise<unknown> {
  return JSON.parse(await fs.readFile(file, "utf8")) as unknown;
}
async function verifyStage(
  stage: string,
  snapshot: NativeCandidateSnapshot
): Promise<void> {
  await assertRuntimeDirectory(stage);
  const parent = path.join(process.cwd(), "dist", "skill-release");
  if (
    path.dirname(stage) !== parent ||
    !path.basename(stage).startsWith("candidate-")
  )
    throw new Error(
      "candidate stage must be an owned child of dist/skill-release"
    );
  const source = v.parse(
    sourceSchema,
    await readJson(path.join(stage, "source-files.json"))
  );
  if (
    source.sha256 !== snapshot.sourceHash ||
    JSON.stringify(source.files) !==
      JSON.stringify(snapshot.source.map((file) => file.path))
  )
    throw new Error("stage source differs from pending snapshot");
  await readStagedDelivery(stage, snapshot.deliveryHash);
}
async function readPrepared(stage: string, snapshot: NativeCandidateSnapshot) {
  const output = v.parse(
    workerSchema,
    await readJson(
      path.join(stage, "candidate-generator/candidate-output.json")
    )
  );
  if (
    output.sourceHash !== snapshot.sourceHash ||
    output.deliveryHash !== snapshot.deliveryHash
  )
    throw new Error("candidate worker identity differs from pending snapshot");
  const packages = {} as Record<
    NativeRole,
    { asset: ReturnType<typeof asset>; bytes: Buffer }
  >;
  const versions = {} as Record<NativeRole, number>;
  for (const role of nativeRoles) {
    const original = snapshot.skills.filesBySkill.get(role);
    if (
      !original ||
      output.skillInputHashes[role] !== digestNativeSource(original)
    )
      throw new Error(
        `candidate skill input differs from pending snapshot: ${role}`
      );
    const name = `${role}-native.zip`;
    const bytes = await fs.readFile(
      path.join(stage, "candidate-source-packages", name)
    );
    const description = asset(name, bytes);
    if (description.sha256 !== output.packages[role]?.asset.sha256)
      throw new Error(`candidate source archive changed: ${role}`);
    const entry = extractNativeArchive(bytes).get(`${role}/SKILL.md`);
    if (!entry) throw new Error(`candidate skill entry missing: ${role}`);
    const identity = readSkillPackageIdentityFromMarkdown(
      new TextDecoder("utf-8", { fatal: true }).decode(entry)
    );
    if (identity.name !== role || identity.version === null)
      throw new Error(`candidate skill identity mismatch: ${role}`);
    versions[role] = identity.version;
    packages[role] = { asset: description, bytes };
  }
  const name = "record-native-installer.zip";
  const bytes = await fs.readFile(
    path.join(stage, "candidate-source-packages", name)
  );
  const description = asset(name, bytes);
  if (description.sha256 !== output.bootstrap.asset.sha256)
    throw new Error("candidate bootstrap archive changed");
  return { packages, versions, bootstrap: { asset: description, bytes } };
}
async function platform(
  directory: string,
  target: NativeTarget,
  version: string,
  revision: string,
  snapshot: NativeCandidateSnapshot
) {
  const source = validatePlatformSourceEvidence({
    source: await readJson(path.join(directory, version, "source-files.json")),
    comparison: await readJson(path.join(directory, "comparison.json")),
    snapshot,
    version,
    revision,
    target
  });
  const archives = {} as Record<NativeRole, Uint8Array>;
  for (const role of nativeRoles)
    archives[role] = await fs.readFile(
      path.join(directory, version, `${role}-${version}-${target}.zip`)
    );
  return {
    revision,
    sourceFiles: source.source.files,
    sourceHash: source.source.sha256,
    buildDelivery: source.buildDelivery,
    metadata: await readJson(path.join(directory, version, "native.json")),
    archives
  };
}
function pendingRevision() {
  const head = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: process.cwd(),
    encoding: "utf8"
  });
  if (
    head.error ||
    head.status !== 0 ||
    !/^[a-f0-9]{40,64}$/.test(head.stdout.trim())
  )
    throw new Error("pending base revision is unavailable");
  const pendingDiff = spawnSync(
    "git",
    ["diff", "--cached", "--quiet", "HEAD", "--"],
    {
      cwd: process.cwd()
    }
  );
  if (
    pendingDiff.error ||
    (pendingDiff.status !== 0 && pendingDiff.status !== 1)
  )
    throw new Error("pending revision comparison is unavailable");
  return {
    pendingBaseRevision: head.stdout.trim(),
    pendingMatchesBase: pendingDiff.status === 0
  };
}
async function main(args: string[]): Promise<void> {
  const [stageArg, linux, windows, version, revision, ...extra] = args;
  if (!stageArg || !linux || !windows || !version || !revision || extra.length)
    throw new Error(
      "Usage: node <stage>/delivery/scripts/build/assemble-native-candidate.ts <stage> <linux-artifact-dir> <windows-artifact-dir> <runtime-version> <revision>"
    );
  const stage = path.resolve(stageArg);
  const expectedModule = path.join(
    stage,
    "delivery/scripts/build/assemble-native-candidate.ts"
  );
  const actualModule = path.resolve(fileURLToPath(import.meta.url));
  const normalize = (value: string) =>
    process.platform === "win32" ? value.toLowerCase() : value;
  if (normalize(actualModule) !== normalize(expectedModule))
    throw new Error(
      "run candidate assembly from the frozen stage delivery tree"
    );
  const snapshot = await captureNativeCandidateSnapshot(process.cwd());
  await verifyStage(stage, snapshot);
  const prepared = await readPrepared(stage, snapshot);
  const baseManifest = await readJson(
    path.join(stage, "skills/skill-release-manifest.json")
  );
  const base = v.parse(skillReleaseManifestSchema, baseManifest);
  const otherArchives: Record<string, Uint8Array> = {};
  for (const name of Object.keys(base.skills))
    if (!nativeRoles.some((role) => role === name))
      otherArchives[name] = await fs.readFile(
        path.join(stage, "skills", `${name}.zip`)
      );
  const platforms = {} as Record<
    NativeTarget,
    Awaited<ReturnType<typeof platform>>
  >;
  platforms[nativeTargets[0]] = await platform(
    path.resolve(linux),
    nativeTargets[0],
    version,
    revision,
    snapshot
  );
  platforms[nativeTargets[1]] = await platform(
    path.resolve(windows),
    nativeTargets[1],
    version,
    revision,
    snapshot
  );
  const pending = pendingRevision();
  const release = assembleCandidateRelease({
    snapshot,
    prepared,
    baseManifest,
    runtimeVersion: version,
    revision,
    ...pending,
    platforms,
    buildRecipe: readNativeBuildRecipe(process.cwd(), revision),
    otherArchives
  });
  const output = await writeCandidateRelease(stage, release);
  console.log(
    `Private candidate release prepared at ${output}; not published.`
  );
}
try {
  await main(process.argv.slice(2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

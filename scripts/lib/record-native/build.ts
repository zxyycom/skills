import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { zipSync } from "fflate";
import * as v from "valibot";
import {
  buildAndVerifySnapshot,
  validateBuildEnvironment,
  validateSnapshot,
  validateToolchain
} from "../../../tools/record-cli/delivery/build.ts";
import {
  assetName,
  hostTarget,
  type Target
} from "../../../tools/record-cli/delivery/manifest.ts";
import { nativeRoles } from "../../../tools/skill-package/src/native-release-manifest.ts";

/** Build exactly the source saved in a private candidate stage for this host. */
export async function buildStagedNativeCandidate(
  workspaceRoot: string,
  stagePath: string,
  version: string
): Promise<void> {
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version))
    throw new Error("invalid native runtime version");
  const { stage, source, actual } = await validateBuildInputs(
    workspaceRoot,
    stagePath
  );
  await validateBuildEnvironment(stage);
  const toolchain = validateToolchain(source);
  const target = hostTarget();
  await buildAndVerifySnapshot(source, stage, target, actual.sha256);
  const assets = await packStagedBinaries(stage, target, version);
  const report = v.safeParse(
    v.object({
      header: v.object({ glibcVersionRuntime: v.optional(v.string()) })
    }),
    process.report.getReport()
  );
  const glibc = report.success
    ? report.output.header.glibcVersionRuntime
    : undefined;
  const environment = {
    platform: process.platform,
    architecture: process.arch,
    kernel: os.release(),
    glibc: glibc ?? null
  };
  await fs.writeFile(
    path.join(stage, `native-${target}.json`),
    `${JSON.stringify({ schemaVersion: 1, runtimeVersion: version, sourceHash: actual.sha256, target, toolchain, environment, assets }, null, 2)}\n`,
    { flag: "wx" }
  );
}

async function validateBuildInputs(workspaceRoot: string, stagePath: string) {
  const stage = path.resolve(stagePath);
  const parent = path.join(
    path.resolve(workspaceRoot),
    "dist",
    "skill-release"
  );
  if (
    path.dirname(stage) !== parent ||
    !path.basename(stage).startsWith("candidate-") ||
    (await fs.realpath(stage)) !== stage
  )
    throw new Error("candidate stage must be a real owned staging directory");
  for (const name of ["target", "native-assets"]) {
    try {
      await fs.lstat(path.join(stage, name));
      throw new Error(`candidate build output already exists: ${name}`);
    } catch (error) {
      if (
        !(error instanceof Error && "code" in error && error.code === "ENOENT")
      )
        throw error;
    }
  }
  const source = path.join(stage, "source");
  if ((await fs.realpath(source)) !== source)
    throw new Error("candidate source must be a real directory");
  const metadata: unknown = JSON.parse(
    await fs.readFile(path.join(stage, "source-files.json"), "utf8")
  );
  const manifest = v.safeParse(
    v.strictObject({ sha256: v.string(), files: v.array(v.string()) }),
    metadata
  );
  const actual = await validateSnapshot(source);
  if (
    !manifest.success ||
    manifest.output.sha256 !== actual.sha256 ||
    JSON.stringify(manifest.output.files) !== JSON.stringify(actual.files)
  )
    throw new Error("candidate source differs from its frozen manifest");
  return { stage, source, actual };
}

async function packStagedBinaries(
  stage: string,
  target: Target,
  version: string
) {
  const output = path.join(stage, "native-assets");
  await fs.mkdir(output);
  const assets = [];
  for (const role of nativeRoles) {
    const executable = assetName(role, target);
    const binary = path.join(stage, "target", target, "release", executable);
    const run = spawnSync(binary, ["--version"], { encoding: "utf8" });
    if (
      run.error ||
      run.status !== 0 ||
      run.stdout.trim() !== `${role} ${version}`
    )
      throw new Error(`built binary version mismatch: ${role}`);
    const content = await fs.readFile(binary);
    const zip = zipSync({
      [executable]: [content, { level: 9, mtime: new Date(1980, 0, 1) }]
    });
    const name = `${role}-${version}-${target}.zip`;
    await fs.writeFile(path.join(output, name), zip, { flag: "wx" });
    assets.push({
      role,
      name,
      byteLength: zip.byteLength,
      sha256: createHash("sha256").update(zip).digest("hex")
    });
  }
  return assets;
}

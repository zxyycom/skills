import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { zipSync } from "fflate";
import {
  validateBuildEnvironment,
  validateSnapshot,
  validateToolchain
} from "../../../tools/record-cli/delivery/build.ts";
import {
  assetName,
  hostTarget
} from "../../../tools/record-cli/delivery/manifest.ts";
import { preparedRuntime, roles } from "./runtime.ts";

/** Reuse only the runtime explicitly prepared by this CI job, after independently checking its frozen source and binaries. */
export async function reusePreparedCiRuntime(
  root: string,
  stage: string,
  sourceHash: string
): Promise<void> {
  const target = hostTarget();
  const { receipt, paths } = await preparedRuntime(root);
  if (receipt.sourceHash !== sourceHash || receipt.target !== target)
    throw new Error(
      "prepared runtime does not match the pending source and target"
    );
  const source = await validateSnapshot(path.join(stage, "source"));
  const prepared = await validateSnapshot(
    path.join(root, ".local", "record-cli", receipt.generation, "source")
  );
  if (
    source.sha256 !== sourceHash ||
    prepared.sha256 !== sourceHash ||
    JSON.stringify(source.files) !== JSON.stringify(prepared.files)
  )
    throw new Error("prepared runtime source differs from frozen inputs");
  await validateBuildEnvironment(stage);
  const toolchain = validateToolchain(path.join(stage, "source"));
  const output = path.join(stage, "native-assets");
  await mkdir(output);
  const assets = [];
  for (const role of roles) {
    const bytes = await readFile(paths[role]);
    if (
      createHash("sha256").update(bytes).digest("hex") !==
      receipt.binaries[role]
    )
      throw new Error(`prepared binary digest differs: ${role}`);
    const run = spawnSync(paths[role], ["--version"], { encoding: "utf8" });
    if (run.error || run.status !== 0 || run.stdout.trim() !== `${role} 0.1.0`)
      throw new Error(`prepared binary version differs: ${role}`);
    const executable = assetName(role, target);
    const archive = zipSync({
      [executable]: [bytes, { level: 9, mtime: new Date(1980, 0, 1) }]
    });
    const name = `${role}-0.1.0-${target}.zip`;
    await writeFile(path.join(output, name), archive, { flag: "wx" });
    assets.push({
      role,
      name,
      byteLength: archive.byteLength,
      sha256: createHash("sha256").update(archive).digest("hex")
    });
  }
  const environment = {
    platform: process.platform,
    architecture: process.arch,
    kernel: os.release(),
    glibc: null
  };
  await writeFile(
    path.join(stage, `native-${target}.json`),
    `${JSON.stringify({ schemaVersion: 1, runtimeVersion: "0.1.0", sourceHash, target, toolchain, environment, assets, provenance: "ci-prepared-runtime" }, null, 2)}\n`,
    { flag: "wx" }
  );
}

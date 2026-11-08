import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import * as v from "valibot";
import { parse as parseYaml } from "yaml";
import {
  nativeRoles,
  type NativeRole
} from "../../../tools/skill-package/src/native-release-manifest.ts";
import { digestNativeSource, type NativeCandidateSnapshot } from "./capture.ts";
import { readStagedDelivery } from "./staging.ts";
import type { prepareCandidateSourcePackages } from "./candidate-package.ts";

const run = promisify(execFile);
const worker = "scripts/lib/record-native/candidate-generate-worker.ts";
const digest = v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/));
const archive = v.strictObject({
  asset: v.strictObject({
    name: v.string(),
    byteLength: v.number(),
    sha256: digest
  }),
  bytes: v.string()
});
const outputSchema = v.strictObject({
  sourceHash: digest,
  deliveryHash: digest,
  skillInputHashes: v.strictObject({
    "decision-records": digest,
    "investigation-report": digest
  }),
  versions: v.strictObject({
    "decision-records": v.number(),
    "investigation-report": v.number()
  }),
  packages: v.strictObject({
    "decision-records": archive,
    "investigation-report": archive
  }),
  bootstrap: archive
});
type Prepared = ReturnType<typeof prepareCandidateSourcePackages>;
function decodeArchive(
  input: v.InferOutput<typeof archive>
): Prepared["bootstrap"] {
  const bytes = Buffer.from(input.bytes, "base64");
  if (
    bytes.length !== input.asset.byteLength ||
    createHash("sha256").update(bytes).digest("hex") !== input.asset.sha256
  )
    throw new Error(
      `frozen candidate output digest mismatch: ${input.asset.name}`
    );
  return { asset: input.asset, bytes };
}

async function verifyPreparedDependency(
  modules: string,
  name: string,
  locked: { specifier: string; version: string } | undefined,
  specifier: string | undefined
): Promise<void> {
  if (!locked || locked.specifier !== specifier)
    throw new Error(`frozen dependency lock mismatch: ${name}`);
  const installed: unknown = JSON.parse(
    await fs.readFile(path.join(modules, name, "package.json"), "utf8")
  );
  const parsed = v.safeParse(v.object({ version: v.string() }), installed);
  if (
    !parsed.success ||
    parsed.output.version !== String(locked.version).split("(")[0]
  )
    throw new Error(
      `external dependency version differs from frozen lock: ${name}`
    );
}

async function attachPreparedModules(
  root: string,
  nodeModules: string,
  delivery: readonly { path: string; data: Buffer }[]
): Promise<void> {
  const modules = await fs.realpath(nodeModules);
  if (!(await fs.stat(modules)).isDirectory())
    throw new Error("external node_modules must be a directory");
  const manifestBytes = delivery.find(
    (file) => file.path === "package.json"
  )?.data;
  if (!manifestBytes)
    throw new Error("frozen candidate input missing: package.json");
  const manifest: unknown = JSON.parse(manifestBytes.toString("utf8"));
  const manifestDependencies = v.parse(
    v.object({ devDependencies: v.record(v.string(), v.string()) }),
    manifest
  ).devDependencies;
  const lockBytes = delivery.find(
    (file) => file.path === "pnpm-lock.yaml"
  )?.data;
  if (!lockBytes)
    throw new Error("frozen candidate input missing: pnpm-lock.yaml");
  const lock: unknown = parseYaml(lockBytes.toString("utf8"));
  const dependencies = v.parse(
    v.object({
      importers: v.object({
        ".": v.object({
          devDependencies: v.record(
            v.string(),
            v.object({ specifier: v.string(), version: v.string() })
          )
        })
      })
    }),
    lock
  ).importers["."].devDependencies;
  for (const name of [
    "@ast-grep/cli",
    "fast-glob",
    "fflate",
    "github-slugger",
    "mdast-util-from-markdown",
    "mdast-util-to-string",
    "neverthrow",
    "simple-git",
    "valibot",
    "yaml"
  ]) {
    await verifyPreparedDependency(
      modules,
      name,
      dependencies[name],
      manifestDependencies[name]
    );
  }
  await fs.symlink(
    modules,
    path.join(root, "node_modules"),
    process.platform === "win32" ? "junction" : "dir"
  );
}

/** Execute the captured worker; this process never composes candidate bytes from worktree sources. */
export async function generatePrivateNativeCandidate(
  stage: string,
  snapshot: NativeCandidateSnapshot,
  runtimeVersion: string,
  nodeModules: string
): Promise<Prepared> {
  return await generateNativeCandidate(
    stage,
    snapshot,
    runtimeVersion,
    nodeModules,
    false
  );
}

/** Formal skill archives are copied from the captured pending snapshot without transformation. */
export async function generateFormalNativeCandidate(
  stage: string,
  snapshot: NativeCandidateSnapshot,
  runtimeVersion: string,
  nodeModules: string
): Promise<Prepared> {
  if (runtimeVersion === "0.1.0")
    throw new Error("private runtime cannot be formal");
  return await generateNativeCandidate(
    stage,
    snapshot,
    runtimeVersion,
    nodeModules,
    true
  );
}

async function generateNativeCandidate(
  stage: string,
  snapshot: NativeCandidateSnapshot,
  runtimeVersion: string,
  nodeModules: string,
  formal: boolean
): Promise<Prepared> {
  const delivery = await readStagedDelivery(stage, snapshot.deliveryHash);
  if (digestNativeSource(delivery) !== snapshot.deliveryHash)
    throw new Error("staged delivery does not match candidate snapshot");
  if (!delivery.find((file) => file.path === worker))
    throw new Error(`frozen candidate generator missing: ${worker}`);
  const root = path.join(stage, "candidate-generator");
  await fs.mkdir(root);
  for (const file of delivery) {
    const target = path.join(root, ...file.path.split("/"));
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, file.data, { flag: "wx" });
  }
  await attachPreparedModules(root, nodeModules, delivery);
  const encode = (files: readonly { path: string; data: Buffer }[]) =>
    files.map((file) => ({
      path: file.path,
      data: file.data.toString("base64")
    }));
  const skills = {} as Record<NativeRole, ReturnType<typeof encode>>;
  const hashes = {} as Record<NativeRole, string>;
  for (const role of nativeRoles) {
    const files = snapshot.skills.filesBySkill.get(role);
    if (!files) throw new Error(`frozen skill missing: ${role}`);
    skills[role] = encode(files);
    hashes[role] = digestNativeSource(files);
  }
  await fs.writeFile(
    path.join(root, "candidate-input.json"),
    JSON.stringify({
      formal,
      runtimeVersion,
      sourceHash: snapshot.sourceHash,
      deliveryHash: snapshot.deliveryHash,
      source: encode(snapshot.source),
      delivery: encode(delivery),
      skills
    }),
    { flag: "wx" }
  );
  await run(process.execPath, [path.join(root, worker)], {
    cwd: root,
    maxBuffer: 16 * 1024 * 1024
  });
  const output: unknown = JSON.parse(
    await fs.readFile(path.join(root, "candidate-output.json"), "utf8")
  );
  const parsed = v.parse(outputSchema, output);
  if (
    parsed.sourceHash !== snapshot.sourceHash ||
    parsed.deliveryHash !== snapshot.deliveryHash ||
    nativeRoles.some((role) => parsed.skillInputHashes[role] !== hashes[role])
  )
    throw new Error(
      "frozen candidate output identity differs from captured inputs"
    );
  return {
    packages: {
      "decision-records": decodeArchive(parsed.packages["decision-records"]),
      "investigation-report": decodeArchive(
        parsed.packages["investigation-report"]
      )
    },
    bootstrap: decodeArchive(parsed.bootstrap),
    versions: parsed.versions
  };
}

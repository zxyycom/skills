import fs from "node:fs/promises";
import path from "node:path";
import * as v from "valibot";
import { prepareNativeBundle } from "../../../tools/skill-updater/src/native/bundle.ts";
import {
  nativeRoles,
  nativeTargets,
  type NativeRole,
  type NativeTarget
} from "../../../tools/skill-package/src/native-release-manifest.ts";
import type { NativeCandidateSnapshot } from "./capture.ts";
import { stageNativeCandidateInputs } from "./staging.ts";
import { generatePrivateNativeCandidate } from "./candidate-generate.ts";
import { validatePlatformSourceEvidence } from "./candidate-release.ts";
import { hash, json } from "./ci-bootstrap-process.ts";

const asset = (name: string, bytes: Uint8Array) => ({
  name,
  byteLength: bytes.byteLength,
  sha256: hash(bytes)
});
const reportSchema = v.object({
  runtimeVersion: v.string(),
  sourceHash: v.string(),
  target: v.picklist(nativeTargets),
  toolchain: v.object({ rustc: v.string(), cargo: v.string() }),
  environment: v.object({
    platform: v.string(),
    architecture: v.string(),
    glibc: v.nullable(v.string())
  }),
  assets: v.array(
    v.object({
      role: v.picklist(nativeRoles),
      name: v.string(),
      byteLength: v.number(),
      sha256: v.string()
    })
  )
});
function validateReport(
  report: v.InferOutput<typeof reportSchema>,
  target: NativeTarget,
  version: string,
  sourceHash: string
): void {
  if (
    report.target !== target ||
    report.runtimeVersion !== version ||
    report.sourceHash !== sourceHash ||
    report.assets.length !== 2
  )
    throw new Error(`invalid platform build evidence: ${target}`);
  if (
    report.environment.architecture !== "x64" ||
    report.environment.platform !==
      (target.includes("windows") ? "win32" : "linux") ||
    report.environment.glibc !== (target.includes("windows") ? null : "2.35")
  )
    throw new Error(`invalid platform build evidence: ${target}`);
  if (
    !report.toolchain.rustc.startsWith("rustc 1.98.1 ") ||
    !report.toolchain.rustc.includes(`host: ${target}`) ||
    !report.toolchain.cargo.startsWith("cargo 1.98.1 ")
  )
    throw new Error(`invalid platform build evidence: ${target}`);
}

async function platformArchives(
  snapshot: NativeCandidateSnapshot,
  version: string,
  revision: string,
  target: NativeTarget,
  directory: string
): Promise<Record<NativeRole, Buffer>> {
  const source = await json(path.join(directory, version, "source-files.json"));
  const comparison = await json(path.join(directory, "comparison.json"));
  const selected = validatePlatformSourceEvidence({
    source,
    comparison,
    snapshot,
    version,
    revision,
    target
  });
  if (
    selected.buildDelivery.sha256 !== snapshot.deliveryHash ||
    JSON.stringify(selected.buildDelivery.files) !==
      JSON.stringify(snapshot.delivery.map((file) => file.path))
  )
    throw new Error(
      `build delivery differs from current pending inputs: ${target}`
    );
  const report = v.parse(
    reportSchema,
    await json(path.join(directory, version, "native.json"))
  );
  validateReport(report, target, version, snapshot.sourceHash);
  const archives = {} as Record<NativeRole, Buffer>;
  for (const role of nativeRoles) {
    const name = `${role}-${version}-${target}.zip`;
    const bytes = await fs.readFile(path.join(directory, version, name));
    const expected = report.assets.filter(
      (item) => item.role === role && item.name === name
    );
    if (
      expected.length !== 1 ||
      expected[0]?.byteLength !== bytes.length ||
      expected[0]?.sha256 !== hash(bytes)
    )
      throw new Error(`platform asset mismatch: ${name}`);
    archives[role] = bytes;
  }
  return archives;
}
export async function versions(
  root: string,
  snapshot: NativeCandidateSnapshot,
  version: string,
  revision: string,
  directories: Record<NativeTarget, string>
) {
  const stage = await stageNativeCandidateInputs(root, snapshot);
  const prepared = await generatePrivateNativeCandidate(
    stage,
    snapshot,
    version,
    path.join(root, "node_modules")
  );
  const archives = {} as Record<NativeRole, Record<NativeTarget, Buffer>>;
  for (const role of nativeRoles)
    archives[role] = {} as Record<NativeTarget, Buffer>;
  for (const target of nativeTargets) {
    const platform = await platformArchives(
      snapshot,
      version,
      revision,
      target,
      directories[target]
    );
    for (const role of nativeRoles) archives[role][target] = platform[role];
  }
  const skills = Object.fromEntries(
    nativeRoles.map((role) => [
      role,
      {
        version: prepared.versions[role],
        native: {
          schemaVersion: 1,
          runtimeVersion: version,
          sourceHash: snapshot.sourceHash,
          package: prepared.packages[role].asset,
          targets: Object.fromEntries(
            nativeTargets.map((target) => [
              target,
              asset(`${role}-${version}-${target}.zip`, archives[role][target])
            ])
          ),
          bootstrap: prepared.bootstrap.asset
        }
      }
    ])
  );
  const manifest = { schemaVersion: 1, skills };
  for (const role of nativeRoles)
    for (const target of nativeTargets)
      prepareNativeBundle({
        role,
        target,
        manifest,
        packageZip: prepared.packages[role].bytes,
        runtimeZip: archives[role][target]
      });
  return {
    prepared,
    archives,
    manifestBytes: Buffer.from(JSON.stringify(manifest)),
    version,
    sourceHash: snapshot.sourceHash
  };
}
export type Release = Awaited<ReturnType<typeof versions>>;
export function mockedRelease(release: Release) {
  const assets: { name: string; url: string }[] = [];
  const data = new Map<string, Uint8Array>();
  const add = (name: string, bytes: Uint8Array) => {
    const url = `https://api.github.com/repos/zxyycom/skills/releases/assets/${assets.length + 1}`;
    assets.push({ name, url });
    data.set(url, bytes);
  };
  for (const role of nativeRoles) {
    add(
      release.prepared.packages[role].asset.name,
      release.prepared.packages[role].bytes
    );
    for (const target of nativeTargets)
      add(
        `${role}-${release.version}-${target}.zip`,
        release.archives[role][target]
      );
  }
  add("skill-release-manifest.json", release.manifestBytes);
  const mocked = async (request: string | URL | Request): Promise<Response> => {
    const url =
      typeof request === "string"
        ? request
        : request instanceof URL
          ? request.href
          : request.url;
    if (url.endsWith("/releases/latest"))
      return Response.json({
        assets,
        tag_name: "private-ci",
        html_url: "https://github.com/zxyycom/skills/releases/tag/private-ci"
      });
    const bytes = data.get(url);
    if (!bytes) throw new Error(`unexpected private fixture request: ${url}`);
    return new Response(bytes);
  };
  return Object.assign(mocked, { preconnect: globalThis.fetch.preconnect });
}

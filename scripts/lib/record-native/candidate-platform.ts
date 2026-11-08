import { createHash } from "node:crypto";
import * as v from "valibot";
import {
  nativeRoles,
  nativeTargets,
  type NativeRole,
  type NativeTarget
} from "../../../tools/skill-package/src/native-release-manifest.ts";
import type { NativeCandidateSnapshot } from "./capture.ts";
export type PlatformInput = Readonly<{
  revision: string;
  sourceFiles: readonly string[];
  sourceHash: string;
  buildDelivery: { sha256: string; files: string[] };
  metadata: unknown;
  archives: Readonly<Record<NativeRole, Uint8Array>>;
}>;
const hash = v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/));
const reportSchema = v.object({
  schemaVersion: v.literal(1),
  runtimeVersion: v.string(),
  sourceHash: hash,
  target: v.picklist(nativeTargets),
  toolchain: v.object({ rustc: v.string(), cargo: v.string() }),
  environment: v.object({
    platform: v.string(),
    architecture: v.string(),
    kernel: v.string(),
    glibc: v.nullable(v.string())
  }),
  assets: v.array(
    v.object({
      role: v.picklist(nativeRoles),
      name: v.string(),
      byteLength: v.number(),
      sha256: hash
    })
  )
});
function asset(name: string, bytes: Uint8Array) {
  return {
    name,
    byteLength: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex")
  };
}
function validatePlatformBaseline(
  report: v.InferOutput<typeof reportSchema>,
  target: NativeTarget
): void {
  const expectedPlatform =
    target === "x86_64-pc-windows-msvc" ? "win32" : "linux";
  if (
    report.environment.platform !== expectedPlatform ||
    report.environment.architecture !== "x64" ||
    !report.environment.kernel ||
    (expectedPlatform === "linux"
      ? report.environment.glibc !== "2.35"
      : report.environment.glibc !== null) ||
    !report.toolchain.rustc.startsWith("rustc 1.98.1 ") ||
    !report.toolchain.rustc.includes(`host: ${target}`) ||
    !report.toolchain.cargo.startsWith("cargo 1.98.1 ")
  )
    throw new Error(`candidate platform baseline mismatch: ${target}`);
}
export function validatePlatform(
  input: PlatformInput,
  target: NativeTarget,
  snapshot: NativeCandidateSnapshot,
  version: string,
  revision: string
): v.InferOutput<typeof reportSchema> {
  const report = v.parse(reportSchema, input.metadata);
  if (
    input.revision !== revision ||
    report.target !== target ||
    report.runtimeVersion !== version ||
    report.sourceHash !== snapshot.sourceHash ||
    input.sourceHash !== snapshot.sourceHash ||
    JSON.stringify(input.sourceFiles) !==
      JSON.stringify(snapshot.source.map((file) => file.path))
  )
    throw new Error(`candidate platform provenance mismatch: ${target}`);
  validatePlatformBaseline(report, target);
  for (const role of nativeRoles) {
    const name = `${role}-${version}-${target}.zip`;
    const entries = report.assets.filter(
      (item) => item.role === role && item.name === name
    );
    const actual = asset(name, input.archives[role]);
    if (
      entries.length !== 1 ||
      entries[0]?.byteLength !== actual.byteLength ||
      entries[0]?.sha256 !== actual.sha256
    )
      throw new Error(`candidate platform asset mismatch: ${role} ${target}`);
  }
  if (report.assets.length !== nativeRoles.length)
    throw new Error(`candidate platform asset set is invalid: ${target}`);
  return report;
}

/** Bind the platform's comparison record and source list to the pending snapshot. */
export function validatePlatformSourceEvidence(input: {
  source: unknown;
  comparison: unknown;
  snapshot: NativeCandidateSnapshot;
  version: string;
  revision: string;
  target: NativeTarget;
}): {
  source: { sha256: string; files: string[] };
  buildDelivery: { sha256: string; files: string[] };
} {
  const source = v.parse(
    v.strictObject({ sha256: hash, files: v.array(v.string()) }),
    input.source
  );
  const comparison = v.parse(
    v.object({
      revision: v.string(),
      delivery: v.object({ sha256: hash, files: v.array(v.string()) }),
      versions: v.array(v.string()),
      sources: v.array(v.object({ sha256: hash, files: v.array(v.string()) }))
    }),
    input.comparison
  );
  const index = comparison.versions.indexOf(input.version);
  if (
    comparison.revision !== input.revision ||
    index < 0 ||
    comparison.versions.length !== comparison.sources.length ||
    new Set(comparison.versions).size !== comparison.versions.length
  )
    throw new Error(
      `candidate platform revision or version missing: ${input.target}`
    );
  const selected = comparison.sources[index];
  if (
    !selected ||
    source.sha256 !== selected.sha256 ||
    source.sha256 !== input.snapshot.sourceHash ||
    JSON.stringify(source.files) !== JSON.stringify(selected.files) ||
    JSON.stringify(source.files) !==
      JSON.stringify(input.snapshot.source.map((file) => file.path))
  )
    throw new Error(
      `candidate platform source evidence differs: ${input.target}`
    );
  return { source, buildDelivery: comparison.delivery };
}

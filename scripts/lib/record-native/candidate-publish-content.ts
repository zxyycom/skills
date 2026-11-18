import { validateCandidateSchema } from "./candidate-schemas.ts";
import type { NativeRole } from "../../../tools/skill-package/src/native-release-manifest.ts";
import * as v from "valibot";
import { extractNativeArchive } from "../../../tools/skill-updater/src/native/archive.ts";
import { prepareNativeBundle } from "../../../tools/skill-updater/src/native/bundle.ts";
import { readSkillPackageIdentityFromMarkdown } from "../../../tools/skill-package/src/version.ts";
import { skillReleaseManifestSchema } from "../../../tools/skill-package/src/release-manifest.ts";
import {
  nativeRoles,
  nativeTargets,
  parseNativeReleaseSet
} from "../../../tools/skill-package/src/native-release-manifest.ts";
import type { CandidatePublishAsset } from "./candidate-publish.ts";
function verifyOtherArchives(
  skills: Record<string, { version: number }>,
  requireBytes: (name: string) => Uint8Array
): void {
  for (const name of Object.keys(skills)) {
    if (nativeRoles.some((role) => role === name)) continue;
    const contents = extractNativeArchive(requireBytes(`${name}.zip`));
    if ([...contents.keys()].some((file) => !file.startsWith(`${name}/`)))
      throw new Error(`other skill archive has unrelated members: ${name}`);
    const entry = contents.get(`${name}/SKILL.md`);
    if (!entry) throw new Error(`other skill entry missing: ${name}`);
    const identity = readSkillPackageIdentityFromMarkdown(
      new TextDecoder("utf-8", { fatal: true }).decode(entry)
    );
    if (identity.name !== name || identity.version !== skills[name]?.version)
      throw new Error(`other skill archive identity mismatch: ${name}`);
  }
}

export function verifyAssetContents(
  manifest: unknown,
  assets: readonly CandidatePublishAsset[],
  schemas: Readonly<Record<NativeRole, readonly Uint8Array[]>>
): void {
  const pair = parseNativeReleaseSet(manifest);
  const base = v.parse(skillReleaseManifestSchema, manifest);
  const lookup = new Map(assets.map((item) => [item.name, item.bytes]));
  const requireBytes = (name: string) => {
    const bytes = lookup.get(name);
    if (!bytes) throw new Error(`candidate asset missing: ${name}`);
    return bytes;
  };
  for (const role of nativeRoles) {
    const release = pair[role];
    const packageZip = requireBytes(release.native.package.name);
    for (const target of nativeTargets)
      prepareNativeBundle({
        role,
        target,
        release,
        packageZip,
        runtimeZip: requireBytes(release.native.targets[target].name)
      });
    validateCandidateSchema(role, packageZip, schemas[role]);
    const contents = extractNativeArchive(packageZip);
    if (
      [...contents.keys()].some((name) => {
        const relative = name.slice(role.length + 1);
        return (
          /^scripts\/(?:decision-records(?:-sdk\/|\.ts$|\.d\.mts$)|check-investigations(?:\.ts$|\.d\.mts$))/i.test(
            relative
          ) ||
          /^scripts\/runtime\/tools\/(?:decision-records|investigation-report|record-operations|index-runtime)\//.test(
            relative
          ) ||
          /(?:^|\/)(?:bin|node_modules)\//.test(relative) ||
          /\.(?:exe|dll|so|dylib)$/i.test(relative)
        );
      })
    )
      throw new Error(`retired SDK or binary in source package: ${role}`);
    const skillText = new TextDecoder("utf-8", { fatal: true }).decode(
      contents.get(`${role}/SKILL.md`)
    );
    if (
      skillText.includes(
        "description: Private native candidate for isolated verification only."
      )
    )
      throw new Error(`private candidate cannot be published: ${role}`);
    for (const file of ["package.json", "pnpm-lock.yaml"])
      if (!contents.get(`${role}/${file}`)?.length)
        throw new Error(`candidate dependency file missing: ${role}/${file}`);
  }
  const bootstrap = extractNativeArchive(
    requireBytes(pair["decision-records"].native.bootstrap.name)
  );
  for (const file of [
    "package.json",
    "pnpm-lock.yaml",
    "README.md",
    "scripts/decision-records.ts",
    "scripts/investigation-report.ts",
    "scripts/resource-records.ts"
  ])
    if (!bootstrap.get(`record-native-installer/${file}`)?.length)
      throw new Error(`candidate bootstrap file missing: ${file}`);
  const readme = new TextDecoder("utf-8", { fatal: true }).decode(
    bootstrap.get("record-native-installer/README.md")
  );
  if (readme.startsWith("# Private native installer"))
    throw new Error("private candidate bootstrap cannot be published");
  verifyOtherArchives(base.skills, requireBytes);
}

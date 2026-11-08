import { zipSync } from "fflate";
import { readSkillPackageIdentityFromMarkdown } from "../../../skill-package/src/version.ts";
import { parseNativeReleasePair } from "../../../skill-package/src/native-release-manifest.ts";
import {
  prepareBundleWithEvidence,
  verifyInstalledNativeEvidence,
  type NativeEvidenceInput
} from "./installed-evidence.ts";
import { planNativeHandoff } from "./native-plan.ts";
import { activateWithPolicy } from "./legacy-transaction.ts";
import { digest, receiptPath } from "./legacy-state.ts";
import { readTargetFile } from "./transaction-files.ts";
import type { LegacyFile } from "./legacy-preflight.ts";
import type { LegacyHandoffPlan, LegacyManifest } from "./legacy-plan.ts";

async function previousManifest(
  input: NativeEvidenceInput,
  root: string
): Promise<{ legacy: LegacyManifest; recoveryProof?: Buffer }> {
  const saved = await readTargetFile(root, receiptPath);
  if (!saved) return { legacy: { version: 0, files: {} } };
  const previous = await verifyInstalledNativeEvidence(
    root,
    input.role,
    input.target
  );
  const entry = previous.find((file) => file.path === "SKILL.md")!;
  const identity = readSkillPackageIdentityFromMarkdown(
    new TextDecoder("utf-8", { fatal: true }).decode(entry.data)
  );
  if (identity.version === null)
    throw new Error("installed native version is missing");
  const files: Record<string, LegacyFile> = Object.fromEntries(
    previous.map((file) => [
      file.path,
      { byteLength: file.data.length, sha256: digest(file.data) }
    ])
  );
  files[receiptPath] = {
    byteLength: saved.bytes.length,
    sha256: digest(saved.bytes)
  };
  const evidence = (name: string) => {
    const file = previous.find(
      (item) => item.path === `.record-native-evidence/${name}`
    );
    if (!file) throw new Error(`missing previous release proof: ${name}`);
    return file.data;
  };
  const recoveryProof = Buffer.from(
    zipSync(
      {
        "manifest.json": evidence("manifest.json"),
        "package.zip": evidence("package.zip"),
        "runtime.zip": evidence("runtime.zip"),
        "receipt.json": saved.bytes
      },
      { level: 0, mtime: new Date(1980, 0, 1) }
    )
  );
  return { legacy: { version: identity.version, files }, recoveryProof };
}

/** Activate a verified bundle only after confirmed, repeated ownership preflight. */
export async function activateNativeBundle(
  input: NativeEvidenceInput & {
    destination: string;
    confirm: (plan: LegacyHandoffPlan) => Promise<boolean>;
    validatePrepared: (root: string) => Promise<void>;
  }
): Promise<void> {
  const files = prepareBundleWithEvidence(input);
  const manifest: unknown = JSON.parse(
    new TextDecoder("utf-8", { fatal: true }).decode(input.manifestBytes)
  );
  const release = parseNativeReleasePair(manifest)[input.role];
  const { legacy, recoveryProof } = await previousManifest(
    input,
    input.destination
  );
  const options = {
    target: input.destination,
    role: input.role,
    legacy,
    ...(recoveryProof ? { recoveryProof } : {}),
    files,
    runtimeVersion: release.native.runtimeVersion,
    sourceHash: release.native.sourceHash,
    confirm: input.confirm,
    validatePrepared: input.validatePrepared
  };
  await activateWithPolicy(options, {
    allowEqual: true,
    plan: async (root) =>
      await planNativeHandoff({
        target: root,
        role: input.role,
        platform: input.target,
        files
      })
  });
}

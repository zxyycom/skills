/*
 * Synced TypeScript runtime; repository maintenance edits tools/skill-updater/src/native/native-resume.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/skill-updater/src/native/native-resume.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/skill-updater/src/native/native-resume.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
import fs from "node:fs/promises";
import path from "node:path";
import * as v from "valibot";
import { assertNativeRelativePaths } from "../../../skill-package/src/native-paths.ts";
import { parseNativeReleasePair } from "../../../skill-package/src/native-release-manifest.ts";
import { readSkillPackageIdentityFromMarkdown } from "../../../skill-package/src/version.ts";
import { extractNativeArchive } from "./archive.ts";
import { assertNativeDirectory } from "./directory.ts";
import {
  prepareBundleWithEvidence,
  proveEvidenceReceipt,
  verifyInstalledNativeEvidence,
  type NativeEvidenceInput
} from "./installed-evidence.ts";
import { resumeWithPolicy } from "./legacy-resume.ts";
import { digest, receiptPath } from "./legacy-state.ts";
import { readTargetFile, sameFileState } from "./transaction-files.ts";
import type { LegacyFile } from "./legacy-preflight.ts";
import type { LegacyHandoffPlan, LegacyManifest } from "./legacy-plan.ts";

function platformPath(value: string): string {
  return process.platform === "win32" ? value.toLowerCase() : value;
}

const recoverySchema = v.object({
  schemaVersion: v.literal(1),
  state: v.picklist(["cleanup-pending", "complete"]),
  role: v.string(),
  legacyVersion: v.pipe(v.number(), v.integer(), v.minValue(0)),
  backup: v.string(),
  retired: v.array(v.string())
});
type NativeResumeInput = NativeEvidenceInput & {
  destination: string;
  confirm: (plan: LegacyHandoffPlan) => Promise<boolean>;
  validatePrepared: (root: string) => Promise<void>;
};

function previousFromProof(
  input: NativeResumeInput,
  proof: Buffer
): LegacyManifest {
  const archive = extractNativeArchive(proof);
  const get = (name: string) => {
    const bytes = archive.get(name);
    if (!bytes) throw new Error(`missing previous recovery proof: ${name}`);
    return bytes;
  };
  if (archive.size !== 4)
    throw new Error("invalid previous recovery proof members");
  const receiptBytes = get("receipt.json");
  const { files } = proveEvidenceReceipt(
    {
      ...input,
      manifestBytes: get("manifest.json"),
      packageZip: get("package.zip"),
      runtimeZip: get("runtime.zip")
    },
    receiptBytes
  );
  const entry = files.find((file) => file.path === "SKILL.md")!;
  const identity = readSkillPackageIdentityFromMarkdown(
    new TextDecoder("utf-8", { fatal: true }).decode(entry.data)
  );
  if (identity.version === null)
    throw new Error("previous recovery proof lacks a version");
  const owned: Record<string, LegacyFile> = Object.fromEntries(
    files.map((file) => [
      file.path,
      { byteLength: file.data.length, sha256: digest(file.data) }
    ])
  );
  owned[receiptPath] = {
    byteLength: receiptBytes.length,
    sha256: digest(receiptBytes)
  };
  return { version: identity.version, files: owned };
}

type RecoveryContext = Readonly<{
  root: string;
  stage: string;
  stageExists: boolean;
  saved: NonNullable<Awaited<ReturnType<typeof readTargetFile>>>;
  receipt: v.InferOutput<typeof recoverySchema>;
  names: string[];
}>;

async function finishEmptyRecovery(
  input: NativeResumeInput,
  context: RecoveryContext
): Promise<void> {
  const { root, stage, stageExists, saved } = context;
  const retired = context.receipt.retired;
  const installed = await verifyInstalledNativeEvidence(
    root,
    input.role,
    input.target
  );
  const expected = prepareBundleWithEvidence(input);
  const byName = new Map(installed.map((file) => [file.path, file.data]));
  const mismatch = expected.some(
    (file) => !byName.get(file.path)?.equals(file.data)
  );
  if (byName.size !== expected.length || mismatch)
    throw new Error("installed native bundle does not match selected release");
  for (const name of retired)
    if (await readTargetFile(root, name))
      throw new Error(`retired file remains: ${name}`);
  await input.validatePrepared(root);
  if (!sameFileState(saved, await readTargetFile(root, receiptPath)))
    throw new Error("native receipt changed during verification");
  if (stageExists) {
    if (!(await input.confirm({ add: [], replace: [], retire: [] })))
      throw new Error("native cleanup cancelled before writes");
    if ((await fs.readdir(stage)).length)
      throw new Error("recovery directory is not empty");
    await fs.rmdir(stage);
  }
}

async function loadRecovery(
  input: NativeResumeInput
): Promise<RecoveryContext> {
  const root = path.resolve(input.destination);
  await assertNativeDirectory(root);
  const saved = await readTargetFile(root, receiptPath);
  if (!saved) throw new Error("native cleanup receipt is missing");
  const raw: unknown = JSON.parse(
    new TextDecoder("utf-8", { fatal: true }).decode(saved.bytes)
  );
  const parsed = v.safeParse(recoverySchema, raw);
  if (!parsed.success || parsed.output.role !== input.role)
    throw new Error("invalid native recovery receipt");
  const receipt = parsed.output;
  assertNativeRelativePaths(receipt.retired);
  const stage = path.resolve(receipt.backup);
  if (
    stage !== receipt.backup ||
    platformPath(path.dirname(stage)) !== platformPath(path.dirname(root)) ||
    !platformPath(path.basename(stage)).startsWith(
      platformPath(`.${path.basename(root)}.native-`)
    )
  )
    throw new Error("invalid native recovery directory");
  const stageExists = await fs.lstat(stage).then(
    () => true,
    (error: unknown) => {
      if (error instanceof Error && "code" in error && error.code === "ENOENT")
        return false;
      throw error;
    }
  );
  if (stageExists) await assertNativeDirectory(stage);
  const names = stageExists ? await fs.readdir(stage) : [];
  return { root, stage, stageExists, saved, receipt, names };
}

/** Resume from retained package proof; a receipt never independently authorizes retirement. */
export async function resumeNativeCleanup(
  input: NativeResumeInput
): Promise<void> {
  const context = await loadRecovery(input);
  const { receipt, names } = context;
  if (receipt.state === "complete" && names.length === 0) {
    await finishEmptyRecovery(input, context);
    return;
  }
  await resumeRetainedProof(input, context);
}

async function resumeRetainedProof(
  input: NativeResumeInput,
  context: RecoveryContext
): Promise<void> {
  const { root, stage, stageExists, receipt } = context;
  if (!stageExists) throw new Error("native recovery directory is unavailable");
  const proofFile = await readTargetFile(stage, "native-previous-proof.zip");
  if (receipt.legacyVersion > 0 && !proofFile)
    throw new Error("previous native recovery proof is missing");
  const legacy = proofFile
    ? previousFromProof(input, proofFile.bytes)
    : { version: 0, files: {} };
  if (legacy.version !== receipt.legacyVersion)
    throw new Error("previous native recovery version differs");
  const files = prepareBundleWithEvidence(input);
  const manifest: unknown = JSON.parse(
    new TextDecoder("utf-8", { fatal: true }).decode(input.manifestBytes)
  );
  const release = parseNativeReleasePair(manifest)[input.role];
  await resumeWithPolicy(
    {
      target: root,
      role: input.role,
      legacy,
      files,
      runtimeVersion: release.native.runtimeVersion,
      sourceHash: release.native.sourceHash,
      ...(proofFile ? { recoveryProof: proofFile.bytes } : {}),
      confirm: input.confirm,
      validatePrepared: input.validatePrepared
    },
    true
  );
}

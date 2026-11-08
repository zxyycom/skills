import { assertNativeRelativePaths } from "../../../skill-package/src/native-paths.ts";
import * as v from "valibot";
import {
  parseNativeReleasePair,
  type NativeRole,
  type NativeTarget
} from "../../../skill-package/src/native-release-manifest.ts";
import type { SkillFile } from "../types.ts";
import { prepareNativeBundle } from "./bundle.ts";
import { assertFileModePolicy, digest, receiptPath } from "./legacy-state.ts";
import { readTargetFile } from "./transaction-files.ts";

const evidenceDirectory = ".record-native-evidence";
const evidencePaths = ["manifest.json", "package.zip", "runtime.zip"].map(
  (name) => `${evidenceDirectory}/${name}`
);
const utf8 = new TextDecoder("utf-8", { fatal: true });
const fileRecord = v.strictObject({
  path: v.string(),
  byteLength: v.pipe(v.number(), v.integer(), v.minValue(0)),
  sha256: v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/)),
  mode: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(0o777))
});
const receiptSchema = v.object({
  schemaVersion: v.literal(1),
  state: v.literal("complete"),
  role: v.string(),
  runtimeVersion: v.string(),
  sourceHash: v.string(),
  files: v.array(fileRecord)
});

export type NativeEvidenceInput = Readonly<{
  role: NativeRole;
  target: NativeTarget;
  manifestBytes: Uint8Array;
  packageZip: Uint8Array;
  runtimeZip: Uint8Array;
}>;

/** Produce only the current release's proof; activation owns atomic replacement. */
export function prepareBundleWithEvidence(
  input: NativeEvidenceInput
): SkillFile[] {
  const manifest: unknown = JSON.parse(utf8.decode(input.manifestBytes));
  const files = prepareNativeBundle({ ...input, manifest });
  if (
    files.some(
      ({ path }) =>
        path === evidenceDirectory ||
        path.startsWith(`${evidenceDirectory}/`) ||
        path === receiptPath
    )
  )
    throw new Error("native bundle occupies a reserved evidence path");
  assertNativeRelativePaths([
    ...files.map((file) => file.path),
    ...evidencePaths,
    receiptPath
  ]);
  return [
    ...files,
    { path: evidencePaths[0]!, data: Buffer.from(input.manifestBytes) },
    { path: evidencePaths[1]!, data: Buffer.from(input.packageZip) },
    { path: evidencePaths[2]!, data: Buffer.from(input.runtimeZip) }
  ];
}

async function requiredFile(root: string, name: string): Promise<Buffer> {
  const file = await readTargetFile(root, name);
  if (!file)
    throw new Error(`missing installed native evidence or file: ${name}`);
  return file.bytes;
}

type ReceiptRecord = v.InferOutput<typeof fileRecord>;

async function verifyMembers(
  root: string,
  files: readonly SkillFile[],
  records: ReadonlyMap<string, ReceiptRecord>
): Promise<void> {
  const modes = new Map<string, number>();
  for (const file of files) {
    const record = records.get(file.path);
    const current = await readTargetFile(root, file.path);
    if (
      !record ||
      !current ||
      record.byteLength !== file.data.byteLength ||
      record.sha256 !== digest(file.data) ||
      !current.bytes.equals(file.data) ||
      record.mode !== current.mode
    )
      throw new Error(
        `installed native member differs from verified bundle: ${file.path}`
      );
    modes.set(file.path, current.mode);
  }
  assertFileModePolicy(files, modes);
}

function verifyReceiptMembers(
  files: readonly SkillFile[],
  records: ReadonlyMap<string, ReceiptRecord>
): void {
  const modes = new Map<string, number>();
  for (const file of files) {
    const record = records.get(file.path);
    if (
      !record ||
      record.byteLength !== file.data.byteLength ||
      record.sha256 !== digest(file.data)
    )
      throw new Error(
        `installed native receipt member differs from verified bundle: ${file.path}`
      );
    modes.set(file.path, record.mode);
  }
  assertFileModePolicy(files, modes);
}

/** Verify retained package identity and its receipt without treating receipt as authority. */
export function proveEvidenceReceipt(
  input: NativeEvidenceInput,
  receiptBytes: Uint8Array
): {
  files: SkillFile[];
  records: ReadonlyMap<string, ReceiptRecord>;
} {
  const manifest: unknown = JSON.parse(utf8.decode(input.manifestBytes));
  const release = parseNativeReleasePair(manifest)[input.role];
  const files = prepareBundleWithEvidence(input);
  const saved: unknown = JSON.parse(utf8.decode(receiptBytes));
  const parsed = v.safeParse(receiptSchema, saved);
  if (
    !parsed.success ||
    parsed.output.role !== input.role ||
    parsed.output.runtimeVersion !== release.native.runtimeVersion ||
    parsed.output.sourceHash !== release.native.sourceHash
  )
    throw new Error("installed native receipt does not match verified release");
  const records = new Map(parsed.output.files.map((file) => [file.path, file]));
  if (
    records.size !== files.length ||
    parsed.output.files.length !== files.length
  )
    throw new Error(
      "installed native receipt member set differs from verified bundle"
    );
  verifyReceiptMembers(files, records);
  return { files, records };
}

/** Reconstruct ownership from the installed, release-verified bundle and current bytes.
 * This cooperative local evidence is not a signature against an actor able to rewrite it all. */
export async function verifyInstalledNativeEvidence(
  root: string,
  role: NativeRole,
  target: NativeTarget
): Promise<SkillFile[]> {
  const manifestBytes = await requiredFile(root, evidencePaths[0]!);
  const packageZip = await requiredFile(root, evidencePaths[1]!);
  const runtimeZip = await requiredFile(root, evidencePaths[2]!);
  const receiptBytes = await requiredFile(root, receiptPath);
  const { files, records } = proveEvidenceReceipt(
    { role, target, manifestBytes, packageZip, runtimeZip },
    receiptBytes
  );
  await verifyMembers(root, files, records);
  return files;
}

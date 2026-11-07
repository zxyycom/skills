import * as v from "valibot";
import { createHash } from "node:crypto";

const digest = v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/));
const target = v.picklist([
  "x86_64-unknown-linux-gnu",
  "x86_64-pc-windows-msvc"
]);
const version = v.pipe(
  v.string(),
  v.regex(/^[0-9]+\.[0-9]+\.[0-9]+(?:-[a-zA-Z0-9.-]+)?$/)
);
const asset = v.strictObject({
  role: v.picklist(["decision-records", "investigation-report"]),
  file: v.string(),
  size: v.pipe(
    v.number(),
    v.integer(),
    v.minValue(1),
    v.maxValue(Number.MAX_SAFE_INTEGER)
  ),
  sha256: digest
});
export const manifestSchema = v.strictObject({
  schemaVersion: v.literal(1),
  version,
  target,
  source: v.strictObject({
    sha256: digest,
    rustc: v.pipe(v.string(), v.minLength(1)),
    cargo: v.pipe(v.string(), v.minLength(1))
  }),
  assets: v.pipe(v.array(asset), v.length(2))
});
export type Manifest = v.InferOutput<typeof manifestSchema>;
export type Target = Manifest["target"];

export function parseManifest(input: unknown): Manifest {
  const parsed = v.parse(manifestSchema, input);
  const roles = new Set<string>();
  for (const item of parsed.assets) {
    if (
      item.file !== assetName(item.role, parsed.target) ||
      roles.has(item.role)
    ) {
      throw new Error("invalid or duplicate asset role/file");
    }
    roles.add(item.role);
  }
  return parsed;
}

export function assetName(role: string, target: Target): string {
  return target === "x86_64-pc-windows-msvc" ? `${role}.exe` : role;
}

export function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function hostTarget(): Target {
  if (process.arch !== "x64") throw new Error("unsupported host architecture");
  if (process.platform === "win32") return "x86_64-pc-windows-msvc";
  let rawReport: unknown;
  try {
    rawReport = process.report.getReport();
  } catch {
    throw new Error("unsupported host platform");
  }
  const report = v.safeParse(
    v.object({
      header: v.object({ glibcVersionRuntime: v.optional(v.string()) })
    }),
    rawReport
  );
  if (
    process.platform === "linux" &&
    report.success &&
    report.output.header.glibcVersionRuntime
  )
    return "x86_64-unknown-linux-gnu";
  throw new Error("unsupported host platform");
}

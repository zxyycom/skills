import * as v from "valibot";
import { snapshotFailure } from "./snapshot-files.ts";

const nonEmpty = v.pipe(v.string(), v.minLength(1));
const targetSchema = v.object({
  name: nonEmpty,
  kind: v.pipe(v.array(nonEmpty), v.minLength(1))
});
const packageSchema = v.object({
  id: nonEmpty,
  targets: v.array(v.object({ ...targetSchema.entries, test: v.boolean() }))
});
const metadataSchema = v.object({
  packages: v.array(packageSchema),
  workspace_members: v.array(nonEmpty)
});
const artifactSchema = v.object({
  reason: v.literal("compiler-artifact"),
  package_id: nonEmpty,
  executable: v.nullable(nonEmpty),
  target: targetSchema,
  profile: v.object({ test: v.boolean() })
});
export type Artifact = v.InferOutput<typeof artifactSchema>;

function parseJson(output: string, label: string): unknown {
  try {
    return JSON.parse(output);
  } catch {
    throw snapshotFailure(`invalid ${label} JSON`);
  }
}

export function cargoPackage(
  output: string
): v.InferOutput<typeof packageSchema> {
  const parsed = v.safeParse(
    metadataSchema,
    parseJson(output, "Cargo metadata")
  );
  if (!parsed.success) throw snapshotFailure("invalid Cargo metadata shape");
  const members = parsed.output.packages.filter((item) =>
    parsed.output.workspace_members.includes(item.id)
  );
  if (parsed.output.workspace_members.length !== 1 || members.length !== 1)
    throw snapshotFailure(
      "Cargo test scope requires exactly one workspace package"
    );
  const pkg = members[0];
  if (!pkg) throw snapshotFailure("Cargo package missing");
  return pkg;
}

export function cargoArtifacts(
  output: string,
  pkg: v.InferOutput<typeof packageSchema>
): ReadonlyMap<string, Artifact> {
  const targetKeys = pkg.targets
    .filter((target) => target.test)
    .map((target) => `${target.kind.join(",")}\0${target.name}`);
  const expected = new Set(targetKeys);
  if (!expected.size) throw snapshotFailure("Cargo has no test targets");
  if (expected.size !== targetKeys.length)
    throw snapshotFailure("duplicate Cargo metadata test target");
  const artifacts = new Map<string, Artifact>();
  for (const line of output.split(/\r?\n/u)) {
    if (!line.startsWith("{")) continue;
    const message = parseJson(line, "Cargo message");
    const reason = v.safeParse(v.object({ reason: v.string() }), message);
    if (!reason.success) throw snapshotFailure("invalid Cargo message shape");
    if (reason.output.reason !== "compiler-artifact") continue;
    const result = v.safeParse(artifactSchema, message);
    if (!result.success) throw snapshotFailure("invalid Cargo artifact shape");
    const value = result.output;
    if (value.package_id !== pkg.id || !value.profile.test || !value.executable)
      continue;
    const key = `${value.target.kind.join(",")}\0${value.target.name}`;
    if (artifacts.has(key))
      throw snapshotFailure(`duplicate Cargo test target: ${key}`);
    artifacts.set(key, value);
  }
  if (
    artifacts.size !== expected.size ||
    [...expected].some((key) => !artifacts.has(key))
  )
    throw snapshotFailure("Cargo test targets do not match metadata");
  return artifacts;
}

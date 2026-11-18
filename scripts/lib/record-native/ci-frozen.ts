import { nativeRoles } from "../../../tools/skill-package/src/native-release-manifest.ts";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as v from "valibot";
import { unzipSync } from "fflate";
import {
  captureNativeCandidateSnapshot,
  digestNativeSource,
  type NativeCandidateSnapshot
} from "./capture.ts";
import { stageNativeCandidateInputs } from "./staging.ts";
import { buildStagedNativeCandidate } from "./build.ts";
import { reusePreparedCiRuntime } from "./ci-prepared.ts";
import {
  assetName,
  hostTarget,
  parseManifest
} from "../../../tools/record-cli/delivery/manifest.ts";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../.."
);
const digest = v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/));
const evidenceSchema = v.strictObject({
  revision: v.pipe(v.string(), v.regex(/^[a-f0-9]{40,64}$/)),
  versions: v.tuple([v.literal("0.1.0"), v.literal("0.1.1")]),
  delivery: v.strictObject({ sha256: digest, files: v.array(v.string()) }),
  sources: v.tuple([
    v.strictObject({ sha256: digest, files: v.array(v.string()) }),
    v.strictObject({ sha256: digest, files: v.array(v.string()) })
  ])
});

export function compareEvidence(first: unknown, second: unknown): void {
  const a = v.parse(evidenceSchema, first);
  const b = v.parse(evidenceSchema, second);
  if (a.revision !== b.revision) throw new Error("platform revisions differ");
  if (JSON.stringify(a.delivery) !== JSON.stringify(b.delivery))
    throw new Error("platform delivery source differs");
  for (const index of [0, 1] as const) {
    if (JSON.stringify(a.sources[index]) !== JSON.stringify(b.sources[index]))
      throw new Error(`platform source differs for ${a.versions[index]}`);
  }
  if (a.sources[0].sha256 === a.sources[1].sha256)
    throw new Error("private successor source did not change");
}

function successor(snapshot: NativeCandidateSnapshot): NativeCandidateSnapshot {
  const replacements = new Map([
    [
      "Cargo.toml",
      [
        '[package]\nname = "record-cli"\nversion = "0.1.0"',
        '[package]\nname = "record-cli"\nversion = "0.1.1"'
      ]
    ],
    [
      "Cargo.lock",
      [
        'name = "record-cli"\nversion = "0.1.0"',
        'name = "record-cli"\nversion = "0.1.1"'
      ]
    ]
  ]);
  const source = snapshot.source.map((file) => {
    const replacement = replacements.get(file.path);
    if (!replacement) return file;
    const text = file.data.toString("utf8");
    const [before, after] = replacement;
    if (!before || !after || text.split(before).length !== 2)
      throw new Error(`unexpected successor input: ${file.path}`);
    replacements.delete(file.path);
    return { ...file, data: Buffer.from(text.replace(before, after)) };
  });
  if (replacements.size) throw new Error("missing private successor inputs");
  return { ...snapshot, source, sourceHash: digestNativeSource(source) };
}

async function build(): Promise<void> {
  const revision = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8"
  });
  const pending = spawnSync("git", ["diff", "--cached", "--quiet"], {
    cwd: root
  });
  if (revision.status !== 0 || pending.status !== 0)
    throw new Error("CI requires an unmodified Git index at HEAD");
  const output = path.join(root, "dist", "record-cli-frozen-ci");
  await mkdir(output); // exclusive ownership: never reuse or remove an old run
  const target = hostTarget();
  const first = await captureNativeCandidateSnapshot(root);
  const snapshots = [first, successor(first)] as const;
  const versions = ["0.1.0", "0.1.1"] as const;
  const sources = [];
  const stages: string[] = [];
  for (const index of [0, 1] as const) {
    const snapshot = snapshots[index];
    const stage = await stageNativeCandidateInputs(root, snapshot);
    if (index === 0 && process.platform === "win32")
      await reusePreparedCiRuntime(root, stage, snapshot.sourceHash);
    else await buildStagedNativeCandidate(root, stage, versions[index]);
    stages.push(stage);
    const dest = path.join(output, versions[index]);
    await mkdir(dest);
    await copyFile(
      path.join(stage, "source-files.json"),
      path.join(dest, "source-files.json")
    );
    await copyFile(
      path.join(stage, "delivery-files.json"),
      path.join(dest, "delivery-files.json")
    );
    await copyFile(
      path.join(stage, `native-${target}.json`),
      path.join(dest, "native.json")
    );
    for (const role of nativeRoles) {
      const name = `${role}-${versions[index]}-${target}.zip`;
      await copyFile(
        path.join(stage, "native-assets", name),
        path.join(dest, name)
      );
    }
    await preparePrivateVerification(
      stage,
      versions[index],
      target,
      snapshot.sourceHash
    );
    sources.push({
      sha256: snapshot.sourceHash,
      files: snapshot.source.map((file) => file.path)
    });
  }
  await writeFile(
    path.join(output, "comparison.json"),
    `${JSON.stringify({ revision: revision.stdout.trim(), versions, delivery: { sha256: first.deliveryHash, files: first.delivery.map((file) => file.path) }, sources }, null, 2)}\n`,
    { flag: "wx" }
  );
  const verify = spawnSync(
    process.execPath,
    [path.join(root, "tools/record-cli/delivery/verify-real.ts"), ...stages],
    { cwd: root, encoding: "utf8" }
  );
  const log = `${verify.stdout ?? ""}${verify.stderr ?? ""}`;
  await writeFile(path.join(output, "private-verification.log"), log, {
    flag: "wx"
  });
  process.stdout.write(log);
  if (verify.error || verify.status !== 0)
    throw new Error("private frozen asset verification failed");
}

async function preparePrivateVerification(
  stage: string,
  version: string,
  target: ReturnType<typeof hostTarget>,
  sourceHash: string
): Promise<void> {
  const metadata = v.parse(
    v.object({
      runtimeVersion: v.literal(version),
      sourceHash: v.literal(sourceHash),
      target: v.literal(target),
      toolchain: v.object({ rustc: v.string(), cargo: v.string() }),
      assets: v.array(
        v.object({
          role: v.string(),
          name: v.string(),
          byteLength: v.number(),
          sha256: digest
        })
      )
    }),
    JSON.parse(
      await readFile(path.join(stage, `native-${target}.json`), "utf8")
    ) as unknown
  );
  const assets = [];
  const directory = path.join(stage, "assets");
  await mkdir(directory);
  for (const role of nativeRoles) {
    const name = `${role}-${version}-${target}.zip`;
    const entries = metadata.assets.filter(
      (item) => item.role === role && item.name === name
    );
    if (entries.length !== 1 || !entries[0])
      throw new Error(`invalid frozen asset metadata: ${role}`);
    const archive = await readFile(path.join(stage, "native-assets", name));
    if (
      archive.length !== entries[0].byteLength ||
      createHash("sha256").update(archive).digest("hex") !== entries[0].sha256
    )
      throw new Error(`frozen asset digest mismatch: ${role}`);
    const extracted = unzipSync(archive);
    const file = assetName(role, target);
    const bytes = extracted[file];
    if (!bytes || Object.keys(extracted).length !== 1)
      throw new Error(`invalid frozen asset contents: ${role}`);
    await writeFile(path.join(directory, file), bytes, {
      flag: "wx",
      mode: 0o755
    });
    assets.push({
      role,
      file,
      size: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex")
    });
  }
  const manifest = parseManifest({
    schemaVersion: 2,
    version,
    target,
    source: { sha256: sourceHash, ...metadata.toolchain },
    assets
  });
  await writeFile(
    path.join(directory, "record-cli-candidate.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    { flag: "wx" }
  );
}

async function main(args: string[]): Promise<void> {
  if (args.length === 1 && args[0] === "build") return build();
  if (args.length === 3 && args[0] === "compare" && args[1] && args[2]) {
    compareEvidence(
      JSON.parse(await readFile(args[1], "utf8")) as unknown,
      JSON.parse(await readFile(args[2], "utf8")) as unknown
    );
    process.stdout.write(
      "Both private versions have identical frozen inputs across platforms.\n"
    );
    return;
  }
  throw new Error(
    "usage: ci-frozen.ts build | compare <linux.json> <windows.json>"
  );
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main(process.argv.slice(2)).catch((error: unknown) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`
    );
    process.exitCode = 1;
  });
}

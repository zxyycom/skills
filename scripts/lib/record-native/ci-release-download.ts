import { spawnSync } from "node:child_process";
import { appendFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import * as v from "valibot";
import { captureNativeCandidateSnapshot } from "./capture.ts";
import {
  readNativeBuildRecipe,
  verifyNativeBuildRecipe
} from "./candidate-build-recipe.ts";
import {
  validateRuntimeRecovery,
  validateRuntimeReuse
} from "./ci-release-reuse.ts";
import { extractNativeArchive } from "../../../tools/skill-updater/src/native/archive.ts";
import { nativeTargets } from "../../../tools/skill-package/src/native-release-manifest.ts";

const repo = "repos/zxyycom/skills";
function gh(args: string[]): Buffer {
  const result = spawnSync("gh", ["api", "--hostname", "github.com", ...args], {
    maxBuffer: 128 * 1024 * 1024,
    env: process.env
  });
  if (result.error || result.status !== 0)
    throw new Error(`GitHub release read failed: ${args.at(-1)}`);
  return Buffer.from(result.stdout);
}
const releaseSchema = v.object({
  id: v.pipe(v.number(), v.integer(), v.minValue(1)),
  assets: v.array(
    v.object({
      id: v.pipe(v.number(), v.integer(), v.minValue(1)),
      name: v.string(),
      size: v.number(),
      digest: v.nullable(v.string())
    })
  )
});

function readPublishedAssets() {
  const release = v.parse(
    releaseSchema,
    JSON.parse(
      gh([`${repo}/releases/tags/skills-latest`]).toString("utf8")
    ) as unknown
  );
  const recovery = release.assets.filter(
    (item) => item.name === "record-native-recovery-0.2.0.zip"
  );
  const proof = release.assets.filter(
    (item) => item.name === "record-native-build-0.2.0.json"
  );
  if (recovery.length > 1 || proof.length > 1)
    throw new Error("ambiguous published provenance");
  if (recovery.length === 0 && proof.length === 0) {
    if (
      release.assets.some((item) =>
        /^(decision-records|investigation-report)-0\.2\.0-/.test(item.name)
      )
    )
      throw new Error("runtime exists without durable recovery evidence");
    return undefined;
  }
  const selected = release.assets.filter(
    (item) =>
      item.name === "record-native-recovery-0.2.0.zip" ||
      item.name === "record-native-build-0.2.0.json" ||
      /^(decision-records|investigation-report)-0\.2\.0-(x86_64-unknown-linux-gnu|x86_64-pc-windows-msvc)\.zip$/.test(
        item.name
      )
  );
  const downloaded = new Map<number, Uint8Array>();
  for (const item of selected)
    downloaded.set(
      item.id,
      gh([
        "-H",
        "Accept: application/octet-stream",
        `${repo}/releases/assets/${item.id}`
      ])
    );
  const members = recovery[0]
    ? extractNativeArchive(downloaded.get(recovery[0].id)!)
    : undefined;
  return { release, recovery, proof, downloaded, members };
}

async function writeReusedAssets(
  root: string,
  provenance: ReturnType<typeof validateRuntimeReuse>,
  release: v.InferOutput<typeof releaseSchema>,
  recovery: v.InferOutput<typeof releaseSchema>["assets"],
  downloaded: ReadonlyMap<number, Uint8Array>,
  members: ReadonlyMap<string, Buffer> | undefined
): Promise<void> {
  const output = path.join(root, "dist", "record-cli-reused-release");
  await mkdir(output);
  if (recovery[0])
    await writeFile(
      path.join(output, "recovery.zip"),
      downloaded.get(recovery[0].id)!,
      { flag: "wx" }
    );
  for (const target of nativeTargets) {
    const dir = path.join(output, target);
    await mkdir(dir);
    const version = path.join(dir, "0.2.0");
    await mkdir(version);
    const comparison = {
      revision: provenance.buildRevision,
      versions: ["0.2.0"],
      delivery: provenance.buildDelivery,
      sources: [provenance.source]
    };
    for (const [name, value] of [
      ["comparison.json", comparison],
      ["0.2.0/source-files.json", provenance.source],
      ["0.2.0/delivery-files.json", provenance.buildDelivery],
      ["0.2.0/native.json", provenance.platforms[target]]
    ] as const)
      await writeFile(
        path.join(dir, name),
        `${JSON.stringify(value, null, 2)}\n`,
        { flag: "wx" }
      );
    for (const item of provenance.assets.filter((entry) =>
      entry.name.endsWith(`${target}.zip`)
    )) {
      const remote = release.assets.find((entry) => entry.name === item.name);
      const bytes =
        members?.get(item.name) ?? (remote && downloaded.get(remote.id));
      if (!bytes) throw new Error(`recovery runtime missing: ${item.name}`);
      await writeFile(path.join(version, item.name), bytes, { flag: "wx" });
    }
  }
}

/** Recover only a pinned release's verified bytes; caller never follows an artifact search. */
async function main(): Promise<void> {
  const root = process.cwd();
  const recovered = readPublishedAssets();
  if (!recovered) {
    if (process.env.GITHUB_OUTPUT)
      await appendFile(process.env.GITHUB_OUTPUT, "reuse=false\n");
    console.log("No published 0.2.0 runtime; build inputs required.");
    return;
  }
  const { release, recovery, proof, downloaded, members } = recovered;
  const proofBytes =
    members?.get("record-native-build-0.2.0.json") ??
    (proof[0] && downloaded.get(proof[0].id));
  if (!proofBytes) throw new Error("build provenance missing");
  const raw = JSON.parse(Buffer.from(proofBytes).toString("utf8")) as unknown;
  const head = v.parse(
    v.object({
      buildRevision: v.pipe(v.string(), v.regex(/^[a-f0-9]{40,64}$/))
    }),
    raw
  );
  const snapshot = await captureNativeCandidateSnapshot(root);
  const recipe = verifyNativeBuildRecipe(
    snapshot.delivery,
    readNativeBuildRecipe(root, head.buildRevision)
  );
  const common = {
    source: {
      sha256: snapshot.sourceHash,
      files: snapshot.source.map((item) => item.path)
    },
    recipe,
    releaseId: release.id,
    remoteAssets: release.assets,
    downloaded
  };
  const provenance = recovery[0]
    ? validateRuntimeRecovery({ ...common, recoveryId: recovery[0].id })
    : validateRuntimeReuse({ ...common, provenanceId: proof[0]!.id });
  await writeReusedAssets(
    root,
    provenance,
    release,
    recovery,
    downloaded,
    members
  );
  if (process.env.GITHUB_OUTPUT)
    await appendFile(
      process.env.GITHUB_OUTPUT,
      `reuse=true\nrevision=${provenance.buildRevision}\nrecovery=${recovery[0] ? "true" : "false"}\n`
    );
  console.log(
    `Reused verified release ${release.id}, recovery asset ${recovery[0]?.id ?? "none"}, original build ${provenance.buildRevision}`
  );
}
main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

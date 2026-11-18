import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import * as v from "valibot";
import {
  nativeRoles,
  nativeSchemaFiles,
  type NativeRole
} from "../tools/skill-package/src/native-release-manifest.ts";
import { candidateGithubRemote } from "./lib/record-native/candidate-publish-github.ts";
import { publishCandidateRelease } from "./lib/record-native/candidate-publish.ts";
import { isMainModule } from "../tools/shared/src/node/main-module.ts";

const digest = v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/));
async function validatePublicationStage(
  root: string,
  marker: string,
  revision: string
): Promise<string> {
  const head = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8"
  });
  if (head.status !== 0 || head.stdout.trim() !== revision)
    throw new Error("publication checkout differs from tested revision");
  const stage = path.resolve((await fs.readFile(marker, "utf8")).trim());
  const stageRoot = path.join(root, "dist", "skill-release");
  if (
    path.dirname(stage) !== stageRoot ||
    !path.basename(stage).startsWith("candidate-") ||
    (await fs.realpath(stage)) !== stage
  )
    throw new Error("invalid owned release stage");
  return stage;
}

/** Read all authorities from the frozen delivery, never from the worktree. */
export async function readCandidateSchemas(
  stage: string
): Promise<Record<NativeRole, readonly Uint8Array[]>> {
  const schemas = {} as Record<NativeRole, readonly Uint8Array[]>;
  for (const role of nativeRoles) {
    schemas[role] = await Promise.all(
      nativeSchemaFiles[role].map((name) =>
        fs.readFile(
          path.join(
            stage,
            "delivery",
            "tools",
            "record-contracts",
            "schemas",
            name
          )
        )
      )
    );
  }
  return schemas;
}

async function readCandidateRelease(stage: string, revision: string) {
  const output = path.join(stage, "candidate-release");
  const provenance = v.parse(
    v.looseObject({
      pendingBaseRevision: v.string(),
      pendingMatchesBase: v.literal(true),
      assetHashes: v.record(v.string(), digest),
      buildRevision: v.string(),
      sourceHash: digest,
      sourceFiles: v.array(v.string()),
      buildDeliveryHash: digest,
      buildDeliveryFiles: v.array(v.string()),
      recipeHashes: v.record(v.string(), digest),
      platforms: v.record(v.string(), v.unknown())
    }),
    JSON.parse(
      await fs.readFile(path.join(output, "provenance.json"), "utf8")
    ) as unknown
  );
  if (provenance.pendingBaseRevision !== revision)
    throw new Error("publication provenance revision differs");
  const assets = [];
  for (const [name, expected] of Object.entries(provenance.assetHashes)) {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(name))
      throw new Error("invalid explicit asset name");
    const bytes = await fs.readFile(path.join(output, name));
    if (
      !bytes.length ||
      createHash("sha256").update(bytes).digest("hex") !== expected
    )
      throw new Error(`publication asset digest mismatch: ${name}`);
    assets.push({
      asset: { name, byteLength: bytes.length, sha256: expected },
      bytes
    });
  }
  const schemas = await readCandidateSchemas(stage);
  const release = {
    manifest: JSON.parse(
      await fs.readFile(
        path.join(output, "skill-release-manifest.json"),
        "utf8"
      )
    ) as unknown,
    assets,
    schemas,
    provenance
  };
  return release;
}
async function main(): Promise<void> {
  const [mode, marker] = process.argv.slice(2);
  if (
    (mode !== "rolling" && mode !== "snapshot") ||
    !marker ||
    !process.env.GH_TOKEN ||
    !process.env.GITHUB_SHA ||
    !process.env.PACKAGE_HASH
  )
    throw new Error(
      "usage: publish-native-skills.ts <rolling|snapshot> <stage-marker>; GH_TOKEN, GITHUB_SHA and PACKAGE_HASH required"
    );
  const root = process.cwd();
  const stage = await validatePublicationStage(
    root,
    marker,
    process.env.GITHUB_SHA
  );
  const release = await readCandidateRelease(stage, process.env.GITHUB_SHA);
  const result = await publishCandidateRelease(
    {
      release,
      mode,
      commit: process.env.GITHUB_SHA,
      packageHash: process.env.PACKAGE_HASH
    },
    candidateGithubRemote(root)
  );
  console.log(JSON.stringify(result));
  if (result.status === "failed")
    throw new Error(`publication failed at ${result.phase}: ${result.error}`);
}
if (isMainModule(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}

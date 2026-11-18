import {
  nativeRoles,
  nativeSchemaFiles
} from "../../../../tools/skill-package/src/native-release-manifest.ts";
import { createHash } from "node:crypto";
import { zipSync, strToU8 } from "fflate";
import type { assembleCandidateRelease } from "../candidate-release.ts";
import { nativeBuildRecipePaths } from "../candidate-build-recipe.ts";

export const commit = "a".repeat(40);
export const hash = "b".repeat(64);
export function fixture(
  privateCandidate = false,
  runtimeVersion = "1.0.0",
  malformedSchema = false,
  retiredSdk = false
): ReturnType<typeof assembleCandidateRelease> {
  const assets: ReturnType<typeof assembleCandidateRelease>["assets"] = [];
  const schemas = {
    "decision-records": [
      Buffer.from(malformedSchema ? "not json" : '{"title":"decision"}')
    ],
    "investigation-report": [Buffer.from('{"title":"investigation"}')],
    "resource-records": [
      Buffer.from('{"title":"resource"}'),
      Buffer.from('{"title":"resource index"}')
    ]
  };
  const add = (name: string, contents: Record<string, string>) => {
    const bytes = Buffer.from(
      zipSync(
        Object.fromEntries(
          Object.entries(contents).map(([key, value]) => [key, strToU8(value)])
        )
      )
    );
    const asset = {
      name,
      byteLength: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex")
    };
    assets.push({ asset, bytes });
    return asset;
  };
  const bootstrap = add(
    "record-native-installer.zip",
    Object.fromEntries(
      [
        "package.json",
        "pnpm-lock.yaml",
        "README.md",
        "scripts/decision-records.ts",
        "scripts/investigation-report.ts",
        "scripts/resource-records.ts"
      ].map((name) => [`record-native-installer/${name}`, "fixture"])
    )
  );
  const skills: Record<string, unknown> = { other: { version: 1 } };
  add("other.zip", {
    "other/SKILL.md": "---\nname: other\nmetadata:\n  version: '1'\n---\n"
  });
  for (const role of nativeRoles) {
    const linux = "x86_64-unknown-linux-gnu",
      windows = "x86_64-pc-windows-msvc";
    const descriptor = JSON.stringify({
      schemaVersion: 1,
      role,
      runtimeVersion,
      sourceHash: hash,
      targets: [linux, windows]
    });
    const pkg = add(`${role}-native.zip`, {
      [`${role}/SKILL.md`]: `---\nname: ${role}\n${privateCandidate ? "description: Private native candidate for isolated verification only.\n" : ""}metadata:\n  version: '2'\n---\n`,
      [`${role}/native-runtime.json`]: descriptor,
      ...Object.fromEntries(
        nativeSchemaFiles[role].map((schema, index) => [
          `${role}/references/${schema}`,
          schemas[role][index]!.toString()
        ])
      ),
      [`${role}/scripts/update-skill.ts`]: "fixture",
      ...(retiredSdk && role === "decision-records"
        ? { [`${role}/scripts/decision-records-sdk/cli.d.mts`]: "retired" }
        : {}),
      [`${role}/package.json`]: "{}",
      [`${role}/pnpm-lock.yaml`]: "lock"
    });
    skills[role] = {
      version: 2,
      native: {
        schemaVersion: 1,
        runtimeVersion,
        sourceHash: hash,
        package: pkg,
        bootstrap,
        targets: {
          [linux]: add(`${role}-${runtimeVersion}-${linux}.zip`, {
            [role]: "binary"
          }),
          [windows]: add(`${role}-${runtimeVersion}-${windows}.zip`, {
            [`${role}.exe`]: "binary"
          })
        }
      }
    };
  }
  const provenance = {
    buildRevision: commit,
    pendingBaseRevision: commit,
    pendingMatchesBase: true,
    buildDeliveryHash: hash,
    sourceHash: hash,
    currentDeliveryHash: hash,
    recipeHashes: Object.fromEntries(
      nativeBuildRecipePaths.map((name) => [name, "d".repeat(64)])
    ),
    sourceFiles: [],
    buildDeliveryFiles: [],
    skillInputHashes: {},
    platforms: Object.fromEntries(
      ["x86_64-unknown-linux-gnu", "x86_64-pc-windows-msvc"].map((target) => [
        target,
        {
          schemaVersion: 1 as const,
          runtimeVersion,
          sourceHash: hash,
          target: target as
            | "x86_64-unknown-linux-gnu"
            | "x86_64-pc-windows-msvc",
          toolchain: { rustc: "fixture", cargo: "fixture" },
          environment: {
            platform: "fixture",
            architecture: "x64",
            kernel: "fixture",
            glibc: null
          },
          assets: []
        }
      ])
    ),
    assetHashes: {}
  };
  const runtimeAssets = nativeRoles.flatMap((role) =>
    ["x86_64-unknown-linux-gnu", "x86_64-pc-windows-msvc"].map(
      (target) =>
        assets.find(
          (item) =>
            item.asset.name === `${role}-${runtimeVersion}-${target}.zip`
        )!.asset
    )
  );
  const proof = Buffer.from(
    `${JSON.stringify({ schemaVersion: 1, buildRevision: commit, runtimeVersion, source: { sha256: hash, files: [] }, buildDelivery: { sha256: hash, files: [] }, recipe: provenance.recipeHashes, platforms: provenance.platforms, assets: runtimeAssets }, null, 2)}\n`
  );
  assets.push({
    asset: {
      name: `record-native-build-${runtimeVersion}.json`,
      byteLength: proof.length,
      sha256: createHash("sha256").update(proof).digest("hex")
    },
    bytes: proof
  });
  const recovery = Buffer.from(
    zipSync(
      Object.fromEntries([
        [
          `record-native-build-${runtimeVersion}.json`,
          [proof, { level: 9, mtime: new Date(1980, 0, 1) }]
        ],
        ...runtimeAssets.map((entry) => [
          entry.name,
          [
            assets.find((item) => item.asset.name === entry.name)!.bytes,
            { level: 9, mtime: new Date(1980, 0, 1) }
          ]
        ])
      ])
    )
  );
  assets.unshift({
    asset: {
      name: `record-native-recovery-${runtimeVersion}.zip`,
      byteLength: recovery.length,
      sha256: createHash("sha256").update(recovery).digest("hex")
    },
    bytes: recovery
  });
  return {
    manifest: { schemaVersion: 1, skills },
    assets,
    schemas,
    provenance
  };
}

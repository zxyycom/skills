import { createHash } from "node:crypto";
import { zipSync, strToU8 } from "fflate";
import type { assembleCandidateRelease } from "../candidate-release.ts";

export const commit = "a".repeat(40);
export const hash = "b".repeat(64);
export function fixture(
  privateCandidate = false,
  runtimeVersion = "1.0.0",
  malformedSchema = false
): ReturnType<typeof assembleCandidateRelease> {
  const assets: ReturnType<typeof assembleCandidateRelease>["assets"] = [];
  const schemas = {
    "decision-records": Buffer.from(
      malformedSchema ? "not json" : '{"title":"decision"}'
    ),
    "investigation-report": Buffer.from('{"title":"investigation"}')
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
        "scripts/investigation-report.ts"
      ].map((name) => [`record-native-installer/${name}`, "fixture"])
    )
  );
  const skills: Record<string, unknown> = { other: { version: 1 } };
  add("other.zip", {
    "other/SKILL.md": "---\nname: other\nmetadata:\n  version: '1'\n---\n"
  });
  for (const role of ["decision-records", "investigation-report"]) {
    const linux = "x86_64-unknown-linux-gnu",
      windows = "x86_64-pc-windows-msvc";
    const descriptor = JSON.stringify({
      schemaVersion: 1,
      role,
      runtimeVersion,
      sourceHash: hash,
      targets: [linux, windows]
    });
    const schema =
      role === "decision-records"
        ? "decision-index.schema.json"
        : "investigation-index.schema.json";
    const pkg = add(`${role}-native.zip`, {
      [`${role}/SKILL.md`]: `---\nname: ${role}\n${privateCandidate ? "description: Private native candidate for isolated verification only.\n" : ""}metadata:\n  version: '2'\n---\n`,
      [`${role}/native-runtime.json`]: descriptor,
      [`${role}/references/${schema}`]:
        schemas[role as keyof typeof schemas].toString(),
      [`${role}/scripts/update-skill.ts`]: "fixture",
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
  return {
    manifest: { schemaVersion: 1, skills },
    assets,
    schemas,
    provenance: {
      buildRevision: commit,
      pendingBaseRevision: commit,
      pendingMatchesBase: true,
      buildDeliveryHash: hash,
      sourceHash: hash,
      currentDeliveryHash: hash,
      recipeHashes: {},
      sourceFiles: [],
      buildDeliveryFiles: [],
      skillInputHashes: {},
      platforms: {},
      assetHashes: {}
    }
  };
}

import { createHash } from "node:crypto";
import { strToU8, zipSync } from "fflate";

export function releaseFixture() {
  const role = "decision-records";
  const target = "x86_64-unknown-linux-gnu";
  const hash = "a".repeat(64);
  const descriptor = {
    schemaVersion: 1,
    role,
    runtimeVersion: "0.1.0",
    sourceHash: hash,
    targets: [target, "x86_64-pc-windows-msvc"]
  };
  const packageZip = zipSync({
    [`${role}/SKILL.md`]: strToU8(
      '---\nname: decision-records\nmetadata:\n  version: "110"\n---\n'
    ),
    [`${role}/native-runtime.json`]: strToU8(JSON.stringify(descriptor)),
    [`${role}/references/decision-index.schema.json`]: strToU8("{}"),
    [`${role}/scripts/update-skill.ts`]: strToU8("// fixture updater\n")
  });
  const runtimeZip = zipSync({
    [role]: strToU8(
      '#!/bin/sh\nif [ "$1" = --version ]; then echo decision-records 0.1.0; fi\n'
    )
  });
  const windowsRuntimeZip = zipSync({ [`${role}.exe`]: strToU8("binary") });
  const packageName = `${role}-native.zip`;
  const runtimeName = `${role}-0.1.0-${target}.zip`;
  const asset = (name: string, bytes: Uint8Array) => ({
    name,
    byteLength: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex")
  });
  const manifest = {
    schemaVersion: 1,
    skills: {
      [role]: {
        version: 110,
        native: {
          schemaVersion: 1,
          runtimeVersion: "0.1.0",
          sourceHash: hash,
          package: asset(packageName, packageZip),
          targets: {
            [target]: asset(runtimeName, runtimeZip),
            "x86_64-pc-windows-msvc": asset(
              `${role}-0.1.0-x86_64-pc-windows-msvc.zip`,
              windowsRuntimeZip
            )
          },
          bootstrap: asset("record-native-installer.zip", runtimeZip)
        }
      },
      "investigation-report": {
        version: 99,
        native: {
          schemaVersion: 1,
          runtimeVersion: "0.1.0",
          sourceHash: hash,
          package: asset("investigation-report-native.zip", packageZip),
          targets: {
            [target]: asset(
              `investigation-report-0.1.0-${target}.zip`,
              runtimeZip
            ),
            "x86_64-pc-windows-msvc": asset(
              "investigation-report-0.1.0-x86_64-pc-windows-msvc.zip",
              runtimeZip
            )
          },
          bootstrap: asset("record-native-installer.zip", runtimeZip)
        }
      }
    }
  };
  const base = "https://api.github.com/repos/owner/repo/releases/assets/";
  const assets = [
    "skill-release-manifest.json",
    packageName,
    runtimeName,
    `${role}-0.1.0-x86_64-pc-windows-msvc.zip`
  ].map((name, index) => ({ name, url: `${base}${index + 1}` }));
  const payloads = [
    strToU8(JSON.stringify(manifest)),
    packageZip,
    runtimeZip,
    windowsRuntimeZip
  ];
  return {
    role,
    target,
    packageZip,
    runtimeZip,
    packageName,
    manifest,
    assets,
    payloads
  } as const;
}

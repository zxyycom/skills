import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { strToU8, zipSync } from "fflate";
import { prepareNativeBundle } from "../src/native/bundle.ts";

test("native bundle binds role, target, skill version and source before planning", () => {
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
  const pack = (override: Record<string, string> = {}) =>
    zipSync(
      Object.fromEntries(
        Object.entries({
          "SKILL.md":
            '---\nname: decision-records\nmetadata:\n  version: "110"\n---\n',
          "native-runtime.json": JSON.stringify(descriptor),
          "references/decision-index.schema.json": "{}",
          "scripts/update-skill.ts": "// fixture",
          ...override
        }).map(([name, value]) => [`${role}/${name}`, strToU8(value)])
      )
    );
  const packageZip = pack();
  const runtimeZip = zipSync({ [role]: strToU8("private binary") });
  const asset = (name: string, data: Uint8Array) => ({
    name,
    byteLength: data.byteLength,
    sha256: createHash("sha256").update(data).digest("hex")
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
          package: asset(`${role}-native.zip`, packageZip),
          targets: {
            [target]: asset(`${role}-0.1.0-${target}.zip`, runtimeZip),
            "x86_64-pc-windows-msvc": asset(
              `${role}-0.1.0-x86_64-pc-windows-msvc.zip`,
              runtimeZip
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
  const input = { role, target, manifest, packageZip, runtimeZip } as const;
  const files = prepareNativeBundle(input);
  assert.equal(
    files.find((file) => file.path === `bin/${role}`)?.data.toString(),
    "private binary"
  );
  assert.throws(
    () => prepareNativeBundle({ ...input, runtimeZip: strToU8("wrong") }),
    /does not match manifest/
  );
  const badPackage = pack({
    "native-runtime.json": JSON.stringify({
      ...descriptor,
      sourceHash: "b".repeat(64)
    })
  });
  const badManifest = structuredClone(manifest);
  badManifest.skills[role].native.package = asset(
    `${role}-native.zip`,
    badPackage
  );
  assert.throws(
    () =>
      prepareNativeBundle({
        ...input,
        manifest: badManifest,
        packageZip: badPackage
      }),
    /descriptor/
  );
  const wrongVersion = pack({
    "SKILL.md":
      '---\nname: decision-records\nmetadata:\n  version: "111"\n---\n'
  });
  const versionManifest = structuredClone(manifest);
  versionManifest.skills[role].native.package = asset(
    `${role}-native.zip`,
    wrongVersion
  );
  assert.throws(
    () =>
      prepareNativeBundle({
        ...input,
        manifest: versionManifest,
        packageZip: wrongVersion
      }),
    /skill identity/
  );
  const wrongBinary = zipSync({
    "investigation-report": strToU8("private binary")
  });
  const binaryManifest = structuredClone(manifest);
  binaryManifest.skills[role].native.targets[target] = asset(
    `${role}-0.1.0-${target}.zip`,
    wrongBinary
  );
  assert.throws(
    () =>
      prepareNativeBundle({
        ...input,
        manifest: binaryManifest,
        runtimeZip: wrongBinary
      }),
    /selected binary/
  );
});

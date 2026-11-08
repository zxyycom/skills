import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { unzipSync, zipSync } from "fflate";
import { createHash } from "node:crypto";
import { digestNativeSource } from "../capture.ts";
import {
  prepareCandidateSourcePackages,
  verifyCandidatePackageManifest,
  writeCandidateSourcePackages
} from "../candidate-package.ts";
import type { SkillPackageFile } from "../../skill-package/skill-package-hash.ts";

test("candidate source archives bind frozen identities and never overwrite output", async () => {
  const source = [{ path: "Cargo.toml", data: Buffer.from("source") }];
  const sourceHash = digestNativeSource(source);
  const roles = ["decision-records", "investigation-report"] as const;
  const schemas = {
    "decision-records": Buffer.from("decision schema"),
    "investigation-report": Buffer.from("investigation schema")
  };
  const filesBySkill = new Map<string, SkillPackageFile[]>();
  for (const role of roles) {
    const schema =
      role === "decision-records"
        ? "decision-index.schema.json"
        : "investigation-index.schema.json";
    const entries: SkillPackageFile[] = [
      {
        path: "SKILL.md",
        data: Buffer.from(
          `---\nname: ${role}\nmetadata:\n  version: '111'\n---\n`
        )
      },
      { path: "scripts/update-skill.ts", data: Buffer.from("updater") },
      { path: "package.json", data: Buffer.from("{}") },
      { path: "pnpm-lock.yaml", data: Buffer.from("lock") },
      { path: `references/${schema}`, data: schemas[role] },
      {
        path: "native-runtime.json",
        data: Buffer.from(
          JSON.stringify({
            schemaVersion: 1,
            role,
            runtimeVersion: "1.0.0",
            sourceHash,
            targets: ["x86_64-unknown-linux-gnu", "x86_64-pc-windows-msvc"]
          })
        )
      }
    ];
    filesBySkill.set(role, entries);
  }
  const delivery = [
    {
      path: "tools/record-contracts/schemas/decision-index.schema.json",
      data: schemas["decision-records"]
    },
    {
      path: "tools/record-contracts/schemas/investigation-index.schema.json",
      data: schemas["investigation-report"]
    }
  ];
  const input = {
    snapshot: {
      delivery,
      deliveryHash: digestNativeSource(delivery),
      source,
      sourceHash,
      skills: {
        skills: roles.map((name) => ({ name, directory: `/skills/${name}` })),
        filesBySkill
      }
    },
    runtimeVersion: "1.0.0",
    schemas,
    bootstrap: {
      entry: "installer.ts",
      files: [
        "installer.ts",
        "package.json",
        "pnpm-lock.yaml",
        "README.md"
      ].map((name) => ({ path: name, data: Buffer.from(name) }))
    }
  };
  const badFiles = new Map(filesBySkill);
  badFiles.set(
    "decision-records",
    filesBySkill.get("decision-records")!.map((file) =>
      file.path === "SKILL.md"
        ? {
            ...file,
            data: Buffer.from(
              "---\nname: impostor\nmetadata:\n  version: '111'\n---\n"
            )
          }
        : file
    )
  );
  assert.throws(
    () =>
      prepareCandidateSourcePackages({
        ...input,
        snapshot: {
          ...input.snapshot,
          skills: { ...input.snapshot.skills, filesBySkill: badFiles }
        }
      }),
    /identity mismatch/
  );
  const result = prepareCandidateSourcePackages(input);
  assert.equal(result.versions["decision-records"], 111);
  assert.deepEqual(
    Buffer.from(
      unzipSync(result.packages["decision-records"].bytes)[
        "decision-records/references/decision-index.schema.json"
      ]!
    ),
    schemas["decision-records"]
  );
  assert.throws(
    () =>
      prepareCandidateSourcePackages({
        ...input,
        schemas: { ...schemas, "decision-records": Buffer.from("different") }
      }),
    /schema differs/
  );
  assert.throws(
    () =>
      prepareCandidateSourcePackages({
        ...input,
        snapshot: { ...input.snapshot, sourceHash: "0".repeat(64) }
      }),
    /digest changed/
  );
  assert.throws(
    () =>
      prepareCandidateSourcePackages({
        ...input,
        bootstrap: { ...input.bootstrap, entry: "missing.ts" }
      }),
    /missing or empty/
  );
  const targets = [
    "x86_64-unknown-linux-gnu",
    "x86_64-pc-windows-msvc"
  ] as const;
  const targetFiles = (role: string) => ({
    "x86_64-unknown-linux-gnu": zipSync({ [role]: Buffer.from("binary") }),
    "x86_64-pc-windows-msvc": zipSync({
      [`${role}.exe`]: Buffer.from("binary")
    })
  });
  const targetArchives = {
    "decision-records": targetFiles("decision-records"),
    "investigation-report": targetFiles("investigation-report")
  };
  const asset = (name: string, bytes: Uint8Array) => ({
    name,
    byteLength: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex")
  });
  const manifest = {
    schemaVersion: 1,
    skills: Object.fromEntries(
      roles.map((role) => [
        role,
        {
          version: 111,
          native: {
            schemaVersion: 1,
            runtimeVersion: "1.0.0",
            sourceHash,
            package: result.packages[role].asset,
            bootstrap: result.bootstrap.asset,
            targets: Object.fromEntries(
              targets.map((target) => [
                target,
                asset(
                  `${role}-1.0.0-${target}.zip`,
                  targetArchives[role][target]
                )
              ])
            )
          }
        }
      ])
    )
  };
  verifyCandidatePackageManifest(
    manifest,
    result,
    sourceHash,
    "1.0.0",
    targetArchives
  );
  targetArchives["decision-records"][targets[0]] = Buffer.from("corrupt");
  assert.throws(
    () =>
      verifyCandidatePackageManifest(
        manifest,
        result,
        sourceHash,
        "1.0.0",
        targetArchives
      ),
    /does not match manifest/
  );
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "native-package-test-")
  );
  try {
    const output = await writeCandidateSourcePackages(directory, result);
    assert.deepEqual(
      await readFile(path.join(output, "record-native-installer.zip")),
      result.bootstrap.bytes
    );
    await assert.rejects(
      writeCandidateSourcePackages(directory, result),
      /EEXIST/
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

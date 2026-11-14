import {
  nativeRoles,
  nativeSchemaFiles
} from "../../../../tools/skill-package/src/native-release-manifest.ts";
import { nativeBuildRecipePaths } from "../candidate-build-recipe.ts";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { unzipSync, zipSync } from "fflate";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { digestNativeSource } from "../capture.ts";
import {
  prepareCandidateSourcePackages,
  verifyCandidatePackageManifest,
  writeCandidateSourcePackages
} from "../candidate-package.ts";
import {
  assembleCandidateRelease,
  validatePlatformSourceEvidence,
  writeCandidateRelease
} from "../candidate-release.ts";
import type { SkillPackageFile } from "../../skill-package/skill-package-hash.ts";

test("candidate source archives bind frozen identities and never overwrite output", async () => {
  const usage = spawnSync(
    process.execPath,
    ["scripts/build/assemble-native-candidate.ts"],
    { cwd: process.cwd(), encoding: "utf8" }
  );
  assert.equal(usage.status, 1);
  assert.match(usage.stderr, /Usage:/);

  const source = [{ path: "Cargo.toml", data: Buffer.from("source") }];
  const sourceHash = digestNativeSource(source);
  const roles = nativeRoles;
  const schemas = {
    "decision-records": [Buffer.from('{"title":"decision"}')],
    "investigation-report": [Buffer.from('{"title":"investigation"}')],
    "resource-records": [
      Buffer.from('{"title":"resource"}'),
      Buffer.from('{"title":"resource index"}')
    ]
  };
  const filesBySkill = new Map<string, SkillPackageFile[]>();
  for (const role of roles) {
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
      ...nativeSchemaFiles[role].map((schema, index) => ({
        path: `references/${schema}`,
        data: schemas[role][index]!
      })),
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
  const delivery = roles.flatMap((role) =>
    nativeSchemaFiles[role].map((schema, index) => ({
      path: `tools/record-contracts/schemas/${schema}`,
      data: schemas[role][index]!
    }))
  );
  const buildRecipe = nativeBuildRecipePaths.map((name) => ({
    path: name,
    data: Buffer.from(`recipe:${name}`)
  }));
  delivery.push(...buildRecipe);
  delivery.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
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
  assert.throws(
    () =>
      prepareCandidateSourcePackages({
        ...input,
        schemas: {
          ...schemas,
          "resource-records": [schemas["resource-records"][0]!]
        }
      }),
    /schema count mismatch/
  );
  const missingResourceSchema = new Map(filesBySkill);
  missingResourceSchema.set(
    "resource-records",
    filesBySkill
      .get("resource-records")!
      .filter((file) => file.path !== "references/resource-index.schema.json")
  );
  assert.throws(
    () =>
      prepareCandidateSourcePackages({
        ...input,
        snapshot: {
          ...input.snapshot,
          skills: {
            ...input.snapshot.skills,
            filesBySkill: missingResourceSchema
          }
        }
      }),
    /missing or empty/
  );
  const result = prepareCandidateSourcePackages(input);
  assert.equal(result.versions["decision-records"], 111);
  assert.deepEqual(
    Buffer.from(
      unzipSync(result.packages["decision-records"].bytes)[
        "decision-records/references/decision-index.schema.json"
      ]!
    ),
    schemas["decision-records"][0]
  );
  const resourcePackage = unzipSync(result.packages["resource-records"].bytes);
  for (const [index, name] of [
    "resource-record.schema.json",
    "resource-index.schema.json"
  ].entries()) {
    assert.deepEqual(
      Buffer.from(resourcePackage[`resource-records/references/${name}`]!),
      schemas["resource-records"][index]
    );
  }
  assert.throws(
    () =>
      prepareCandidateSourcePackages({
        ...input,
        schemas: { ...schemas, "decision-records": [Buffer.from("different")] }
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
    "investigation-report": targetFiles("investigation-report"),
    "resource-records": targetFiles("resource-records")
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
  const revision = "a".repeat(40);
  const buildDelivery = {
    sha256: "d".repeat(64),
    files: ["historical-delivery"]
  };
  const platform = (target: (typeof targets)[number]) => ({
    revision,
    buildDelivery,
    sourceHash,
    sourceFiles: source.map((file) => file.path),
    metadata: {
      schemaVersion: 1,
      runtimeVersion: "1.0.0",
      sourceHash,
      target,
      toolchain: {
        rustc: `rustc 1.98.1 (fixture)\nhost: ${target}`,
        cargo: "cargo 1.98.1 (fixture)"
      },
      environment: {
        platform: target === targets[0] ? "linux" : "win32",
        architecture: "x64",
        kernel: "fixture",
        glibc: target === targets[0] ? "2.35" : null
      },
      assets: roles.map((role) => ({
        role,
        ...asset(`${role}-1.0.0-${target}.zip`, targetArchives[role][target])
      }))
    },
    archives: {
      "decision-records": targetArchives["decision-records"][target],
      "investigation-report": targetArchives["investigation-report"][target],
      "resource-records": targetArchives["resource-records"][target]
    }
  });
  const otherFiles = [
    {
      path: "SKILL.md",
      data: Buffer.from("---\nname: other\nmetadata:\n  version: '5'\n---\n")
    }
  ];
  const releaseSnapshot = {
    ...input.snapshot,
    skills: {
      skills: [
        ...input.snapshot.skills.skills,
        { name: "other", directory: "/skills/other" }
      ],
      filesBySkill: new Map([
        ...input.snapshot.skills.filesBySkill,
        ["other", otherFiles]
      ])
    }
  };
  const releaseInput = {
    snapshot: releaseSnapshot,
    buildRecipe,
    otherArchives: {
      other: zipSync({ "other/SKILL.md": otherFiles[0]!.data })
    },
    prepared: result,
    baseManifest: {
      schemaVersion: 1,
      skills: {
        "decision-records": { version: 109 },
        "investigation-report": { version: 98 },
        other: { version: 5 }
      }
    },
    runtimeVersion: "1.0.0",
    revision,
    pendingBaseRevision: "f".repeat(40),
    pendingMatchesBase: true,
    platforms: {
      "x86_64-unknown-linux-gnu": platform(targets[0]),
      "x86_64-pc-windows-msvc": platform(targets[1])
    }
  };
  const sourceEvidence = {
    sha256: sourceHash,
    files: source.map((file) => file.path)
  };
  const comparison = {
    revision,
    delivery: buildDelivery,
    versions: ["1.0.0"],
    sources: [sourceEvidence]
  };
  const evidenceInput = {
    source: sourceEvidence,
    comparison,
    snapshot: releaseSnapshot,
    version: "1.0.0",
    revision,
    target: targets[0]
  };
  assert.deepEqual(validatePlatformSourceEvidence(evidenceInput), {
    source: sourceEvidence,
    buildDelivery
  });
  const wrongSource = { ...sourceEvidence, sha256: "0".repeat(64) };
  assert.throws(
    () =>
      validatePlatformSourceEvidence({
        ...evidenceInput,
        source: wrongSource,
        comparison: { ...comparison, sources: [wrongSource] }
      }),
    /source evidence differs/
  );
  const release = assembleCandidateRelease(releaseInput);
  assert.equal(release.assets.length, 11);
  const formalInput = {
    ...releaseInput,
    formal: true,
    baseManifest: {
      schemaVersion: 1,
      skills: {
        "decision-records": { version: result.versions["decision-records"] },
        "investigation-report": {
          version: result.versions["investigation-report"]
        },
        "resource-records": { version: result.versions["resource-records"] },
        other: { version: 5 }
      }
    }
  };
  const formal = assembleCandidateRelease(formalInput);
  assert.ok(
    formal.assets.some(
      (item) => item.asset.name === "record-native-build-1.0.0.json"
    )
  );
  const recovery = formal.assets.find(
    (item) => item.asset.name === "record-native-recovery-1.0.0.zip"
  )!;
  const alternate = Buffer.from(
    zipSync(unzipSync(recovery.bytes), { level: 0 })
  );
  assert.notDeepEqual(alternate, recovery.bytes);
  const reused = assembleCandidateRelease({
    ...formalInput,
    recoveryBytes: alternate
  });
  assert.deepEqual(
    reused.assets.find((item) => item.asset.name === recovery.asset.name)!
      .bytes,
    alternate
  );
  const alteredMembers = unzipSync(alternate);
  alteredMembers[
    Object.keys(alteredMembers).find((name) => name.endsWith(".zip"))!
  ] = new Uint8Array([1]);
  assert.throws(
    () =>
      assembleCandidateRelease({
        ...formalInput,
        recoveryBytes: zipSync(alteredMembers)
      }),
    /recovery members differ/
  );
  const changedSkills = new Map(releaseSnapshot.skills.filesBySkill);
  const decision = changedSkills.get("decision-records")!;
  changedSkills.set("decision-records", [
    ...decision,
    { path: "unexpected.txt", data: Buffer.from("different") }
  ]);
  assert.throws(
    () =>
      assembleCandidateRelease({
        ...formalInput,
        snapshot: {
          ...releaseSnapshot,
          skills: { ...releaseSnapshot.skills, filesBySkill: changedSkills }
        }
      }),
    /formal package differs from pending snapshot/
  );
  assert.ok(release.assets.some((item) => item.asset.name === "other.zip"));
  const changedRecipe = buildRecipe.map((file, index) =>
    index === 0 ? { ...file, data: Buffer.from("changed") } : file
  );
  assert.throws(
    () =>
      assembleCandidateRelease({ ...releaseInput, buildRecipe: changedRecipe }),
    /build recipe changed/
  );
  assert.throws(
    () =>
      assembleCandidateRelease({
        ...releaseInput,
        platforms: {
          ...releaseInput.platforms,
          [targets[1]]: {
            ...releaseInput.platforms[targets[1]],
            buildDelivery: { ...buildDelivery, sha256: "e".repeat(64) }
          }
        }
      }),
    /build delivery evidence differs/
  );
  const wrongPlatform = structuredClone(releaseInput.platforms[targets[0]]);
  wrongPlatform.metadata.environment.glibc = "2.43";
  assert.throws(
    () =>
      assembleCandidateRelease({
        ...releaseInput,
        platforms: { ...releaseInput.platforms, [targets[0]]: wrongPlatform }
      }),
    /platform baseline mismatch/
  );
  assert.equal(release.provenance.buildDeliveryHash, buildDelivery.sha256);
  assert.equal(
    release.provenance.currentDeliveryHash,
    input.snapshot.deliveryHash
  );

  assert.throws(
    () =>
      assembleCandidateRelease({
        ...releaseInput,
        platforms: {
          ...releaseInput.platforms,
          [targets[1]]: {
            ...releaseInput.platforms[targets[1]],
            sourceHash: "0".repeat(64)
          }
        }
      }),
    /provenance mismatch/
  );
  assert.deepEqual(release.manifest.skills.other, { version: 5 });
  assert.throws(
    () => assembleCandidateRelease({ ...releaseInput, otherArchives: {} }),
    /archive set/
  );
  assert.throws(
    () =>
      assembleCandidateRelease({
        ...releaseInput,
        otherArchives: {
          other: zipSync({ "other/SKILL.md": Buffer.from("changed") })
        }
      }),
    /differs from frozen snapshot/
  );
  assert.throws(
    () =>
      assembleCandidateRelease({
        ...releaseInput,
        platforms: {
          ...releaseInput.platforms,
          [targets[1]]: {
            ...releaseInput.platforms[targets[1]],
            revision: "b".repeat(40)
          }
        }
      }),
    /provenance mismatch/
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
    const releaseOutput = await writeCandidateRelease(directory, release);
    assert.ok(
      (
        await readFile(
          path.join(releaseOutput, "skill-release-manifest.json"),
          "utf8"
        )
      ).includes("decision-records-native.zip")
    );
    await assert.rejects(writeCandidateRelease(directory, release), /EEXIST/);
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

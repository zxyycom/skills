import fs from "node:fs/promises";
import path from "node:path";
import * as v from "valibot";
import {
  nativeTargets,
  type NativeRole
} from "../../../../tools/skill-package/src/native-release-manifest.ts";
import { captureNativeCandidateSnapshot } from "../../record-native/capture.ts";
import { candidateLock } from "../../record-native/candidate-lock.ts";
import { rootDir } from "../../project.ts";
import {
  nativeSkillGitIgnorePatterns,
  nativeUpdaterEntry,
  nativeUpdaterResources
} from "../native-updater-entry.ts";
import type { GeneratedFileMode } from "../generated-file.ts";
import {
  buildSourceRuntimeArtifacts,
  syncSourceRuntimeArtifacts,
  type SourceRuntimeFacts
} from "./source-runtime.ts";

const legacySchema = v.object({
  skills: v.record(
    v.string(),
    v.object({ files: v.record(v.string(), v.unknown()) })
  )
});

async function retiredRuntimePaths(role: NativeRole): Promise<string[]> {
  const legacy = v.parse(
    legacySchema,
    JSON.parse(
      await fs.readFile(
        path.join(
          rootDir,
          "tools/skill-updater/src/native/legacy-manifests.json"
        ),
        "utf8"
      )
    )
  );
  const old = legacy.skills[role];
  if (!old) throw new Error(`legacy paths unavailable: ${role}`);
  const retiredPaths = Object.keys(old.files).filter((name) =>
    /^scripts\/(?:decision-records(?:-sdk\/|\.ts$|\.d\.mts$)|check-investigations(?:\.ts$|\.d\.mts$))/.test(
      name
    )
  );
  retiredPaths.push(
    role === "decision-records"
      ? "scripts/decision-records.mjs"
      : "scripts/check-investigations.mjs"
  );
  return retiredPaths;
}

/** 同步原生 skill 的更新入口、运行时描述符、索引 Schema 与随包配置。 */
export async function syncNativeSkillRuntime(
  role: NativeRole,
  mode: GeneratedFileMode,
  facts?: SourceRuntimeFacts
): Promise<boolean> {
  const skillRoot = path.join(rootDir, "skills", role);
  const snapshot = await captureNativeCandidateSnapshot(rootDir);
  const cargo = snapshot.source
    .find((file) => file.path === "Cargo.toml")
    ?.data.toString("utf8");
  const version = cargo && /^version = "(\d+\.\d+\.\d+)"$/m.exec(cargo)?.[1];
  if (!version || version === "0.1.0")
    throw new Error("formal native runtime version is missing or private");
  const artifacts = await buildSourceRuntimeArtifacts(
    {
      workspaceRoot: rootDir,
      skillName: role,
      entries: [nativeUpdaterEntry(role, false)],
      rebuildCommand:
        role === "decision-records"
          ? "bun run sync:decision-records-cli"
          : "bun run sync:investigation-report-check",
      nodeEngine: ">=24.18",
      additionalGitIgnorePatterns: nativeSkillGitIgnorePatterns,
      resources: nativeUpdaterResources
    },
    facts
  );
  const manifest = artifacts.find(
    (item) => item.path === path.join(skillRoot, "package.json")
  );
  if (!manifest) throw new Error("native updater manifest missing");
  const lock = candidateLock(
    Buffer.from(manifest.content),
    await fs.readFile(path.join(skillRoot, "pnpm-lock.yaml"))
  );
  const schemaName =
    role === "decision-records"
      ? "decision-index.schema.json"
      : "investigation-index.schema.json";
  const schemaPath = `tools/record-contracts/schemas/${schemaName}`;
  artifacts.push(
    {
      path: path.join(skillRoot, "pnpm-lock.yaml"),
      content: lock.toString("utf8"),
      sourcePath: "tools/skill-updater/src/native/cli.ts"
    },
    {
      path: path.join(skillRoot, "native-runtime.json"),
      content: `${JSON.stringify({ schemaVersion: 1, role, runtimeVersion: version, sourceHash: snapshot.sourceHash, targets: nativeTargets }, null, 2)}\n`,
      sourcePath: "tools/record-cli/Cargo.toml"
    },
    {
      path: path.join(skillRoot, "references", schemaName),
      content: await fs.readFile(path.join(rootDir, schemaPath), "utf8"),
      sourcePath: schemaPath
    }
  );
  const retiredPaths = await retiredRuntimePaths(role);
  return await syncSourceRuntimeArtifacts(artifacts, {
    mode,
    skillName: role,
    retiredPaths
  });
}

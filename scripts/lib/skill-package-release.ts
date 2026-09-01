import fs from "node:fs/promises";
import path from "node:path";
import { type Zippable, zipSync } from "fflate";
import {
  calculateSkillPackageSnapshotHash,
  getSkillPackageVersionIssues,
  readPendingSkillPackageSnapshot,
  readSkillPackageSnapshotVersionBaseline,
  readSkillPackageVersion,
  type SkillPackageFile,
  type SkillPackageHash,
  type SkillPackageSnapshot,
  type SkillPackageVersionBaseline
} from "./skill-package-hash.ts";
import type { SkillPackage } from "./project.ts";
import {
  skillReleaseManifestFileName,
  stringifySkillReleaseManifest,
  type SkillReleaseManifest
} from "../../tools/skill-package/src/release-manifest.ts";

const zipEntryOptions = { level: 9 as const, mtime: new Date(1980, 0, 1) };

export type PreparedSkillPackageRelease = Readonly<{
  baseline: SkillPackageVersionBaseline;
  baselineRef: string;
  currentPackage: SkillPackageHash;
  snapshot: SkillPackageSnapshot;
  versionIssues: readonly string[];
}>;

export type PackedSkillPackageSnapshot = Readonly<{
  archives: readonly Readonly<{
    byteLength: number;
    outputPath: string;
    skillName: string;
  }>[];
  manifestOutputPath: string;
}>;

/** Captures one pending package snapshot and pins all version-analysis inputs. */
export async function prepareSkillPackageRelease(
  workspaceRoot: string,
  baselineRef: string
): Promise<PreparedSkillPackageRelease> {
  const snapshot = await readPendingSkillPackageSnapshot(workspaceRoot);
  const currentPackage = calculateSkillPackageSnapshotHash(snapshot);
  const baseline = await readSkillPackageSnapshotVersionBaseline(
    snapshot,
    baselineRef,
    workspaceRoot
  );
  return {
    baseline,
    baselineRef,
    currentPackage,
    snapshot,
    versionIssues: getSkillPackageVersionIssues(currentPackage, baseline)
  };
}

function buildZip(
  skill: SkillPackage,
  files: readonly SkillPackageFile[]
): Buffer {
  const entries = Object.fromEntries(
    files.map((file) => [
      `${skill.name}/${file.path}`,
      [file.data, zipEntryOptions]
    ])
  ) as Zippable;
  return Buffer.from(zipSync(entries, zipEntryOptions));
}

/** Writes release artifacts from an already captured pending package snapshot. */
export async function packSkillPackageSnapshot(
  snapshot: SkillPackageSnapshot,
  distDirectory: string
): Promise<PackedSkillPackageSnapshot> {
  await fs.rm(distDirectory, { force: true, recursive: true });
  await fs.mkdir(distDirectory, { recursive: true });

  const archives: Array<{
    byteLength: number;
    outputPath: string;
    skillName: string;
  }> = [];
  const skills: SkillReleaseManifest["skills"] = {};
  for (const skill of snapshot.skills) {
    const files = snapshot.filesBySkill.get(skill.name) ?? [];
    const archive = buildZip(skill, files);
    const outputPath = path.join(distDirectory, `${skill.name}.zip`);
    await fs.writeFile(outputPath, archive);
    archives.push({
      byteLength: archive.byteLength,
      outputPath,
      skillName: skill.name
    });
    skills[skill.name] = {
      version: readSkillPackageVersion(skill.name, files)
    };
  }
  const manifestOutputPath = path.join(
    distDirectory,
    skillReleaseManifestFileName
  );
  await fs.writeFile(
    manifestOutputPath,
    stringifySkillReleaseManifest({ schemaVersion: 1, skills }),
    "utf8"
  );
  return { archives, manifestOutputPath };
}

/*
 * Synced TypeScript runtime; repository maintenance edits tools/skill-updater/src/types.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/skill-updater/src/types.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/skill-updater/src/types.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/dependency-boundary-design
 * Rebuild: bun run sync:skill-updaters
 */
export type UpdaterConfig = {
  releaseAssetName: string;
  releaseManifestAssetName: string;
  repo: string;
  /** Expected SKILL.md frontmatter name for the local target and remote package. */
  skillName: string;
  sourcePath: string;
};

export type CliOptions = {
  check: boolean;
  help: boolean;
  releaseTag: string | null;
  targetDir: string;
  yes: boolean;
};

export type SkillFile = {
  data: Buffer;
  path: string;
};

export type LocalSkillState =
  | {
      state: "missing";
    }
  | {
      state: "unversioned";
    }
  | {
      state: "versioned";
      version: number;
    };

export type RemoteSkillPackage = {
  version: number;
};

export type SkillUpdatePlanEntry = {
  action: "add" | "replace";
  path: string;
};

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

export type UpdaterConfig = {
  packageLockAssetName: string;
  releaseAssetName: string;
  repo: string;
  skillName: string;
  sourcePath: string;
};

export type CliOptions = {
  check: boolean;
  releaseTag: string | null;
  targetDir: string;
  yes: boolean;
};

export type SkillFile = {
  data: Buffer;
  path: string;
};

export type RemoteSkillPackage =
  | {
      aggregateHash: string;
      files: null;
      fingerprint: string;
      source: "package-lock";
    }
  | {
      aggregateHash: null;
      files: SkillFile[];
      fingerprint: string;
      source: "zip";
    };

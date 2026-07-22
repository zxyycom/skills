export type UpdaterConfig = {
  packageLockAssetName: string;
  releaseAssetName: string;
  repo: string;
  skillName: string;
  sourcePath: string;
};

export declare const skillUpdaterConfig: Readonly<UpdaterConfig>;

export declare function runSkillUpdaterCli(
  argv?: readonly string[]
): Promise<number>;

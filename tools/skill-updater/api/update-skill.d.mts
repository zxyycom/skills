export type UpdaterConfig = {
  releaseAssetName: string;
  releaseManifestAssetName: string;
  repo: string;
  skillName: string;
  sourcePath: string;
};

export declare const skillUpdaterConfig: Readonly<UpdaterConfig>;

export declare function runSkillUpdaterCli(
  argv?: readonly string[]
): Promise<number>;

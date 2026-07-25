export type UpdaterConfig = {
  releaseAssetName: string;
  releaseManifestAssetName: string;
  repo: string;
  /** Expected SKILL.md frontmatter name for the local target and remote package. */
  skillName: string;
  sourcePath: string;
};

export declare const skillUpdaterConfig: Readonly<UpdaterConfig>;

export declare function runSkillUpdaterCli(
  argv?: readonly string[]
): Promise<number>;

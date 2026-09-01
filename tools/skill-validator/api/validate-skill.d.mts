export type SkillStructureValidationOptions = {
  allowedFrontmatterKeys?: readonly string[];
  linkValidation?: "complete" | "skip";
};

export type SkillStructureValidationResult = {
  errors: string[];
  markdownFileCount: number;
  skillDirectory: string;
};

export declare function runSkillValidatorCli(
  argv?: readonly string[]
): Promise<number>;

export declare function validateSkillDirectory(
  directory: string,
  options?: SkillStructureValidationOptions
): Promise<SkillStructureValidationResult>;

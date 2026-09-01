import { discoverSkillPackages, rootDir } from "./lib/project.ts";
import { ValidationReporter } from "./lib/validation.ts";
import { isMainModule } from "../tools/shared/src/node/main-module.ts";
import { validateSkillDirectory } from "../tools/skill-validator/src/validation.ts";
import {
  validatePackageScripts,
  validateOxcConfigurationFiles,
  validateRepositoryPermissionRules,
  validateRequiredProjectFiles,
  validateSkillPackageVersions
} from "./validators/project-config.ts";

const allowedFrontmatterKeys = [
  "name",
  "description",
  "license",
  "compatibility",
  "metadata"
];

export type RepositoryValidationResult = {
  errors: readonly string[];
  skillCount: number;
};

export async function validateRepository(
  workspaceRoot: string = rootDir
): Promise<RepositoryValidationResult> {
  const reporter = new ValidationReporter();
  const discovery = await discoverSkillPackages(workspaceRoot);
  reporter.addAll(discovery.errors);

  for (const skill of discovery.skills) {
    const result = await validateSkillDirectory(skill.directory, {
      allowedFrontmatterKeys,
      validateMarkdownLinks: false
    });
    for (const error of result.errors) {
      reporter.report(`skills/${skill.name}/${error}`);
    }
  }

  await validatePackageScripts(reporter.report, workspaceRoot);
  await validateRequiredProjectFiles(reporter.report, workspaceRoot);
  await validateOxcConfigurationFiles(reporter.report, workspaceRoot);
  await validateRepositoryPermissionRules(reporter.report, workspaceRoot);
  await validateSkillPackageVersions(reporter.report, discovery.skills);

  return { errors: reporter.errors, skillCount: discovery.skills.length };
}

if (isMainModule(import.meta.url)) {
  const result = await validateRepository();
  if (result.errors.length > 0) {
    console.error("Validation failed:");
    for (const error of result.errors) {
      console.error(`- ${error}`);
    }
    process.exitCode = 1;
  } else {
    console.log(`Validation passed (${result.skillCount} skills checked).`);
  }
}

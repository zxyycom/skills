import {
  collectMainMarkdownFiles,
  discoverSkillPackages,
  rootDir
} from "./lib/project.ts";
import { ValidationReporter } from "./lib/validation.ts";
import { validateMarkdownLinks } from "../tools/shared/src/markdown/links.ts";
import { validateSkillDirectory } from "../tools/skill-validator/src/validation.ts";
import {
  validatePackageScripts,
  validateRequiredProjectFiles
} from "./validators/project-config.ts";

const reporter = new ValidationReporter();
const discovery = await discoverSkillPackages(rootDir);
reporter.addAll(discovery.errors);

const allowedFrontmatterKeys = ["name", "description", "license", "compatibility", "metadata"];
let skillMarkdownFileCount = 0;
for (const skill of discovery.skills) {
  const result = await validateSkillDirectory(skill.directory, { allowedFrontmatterKeys });
  skillMarkdownFileCount += result.markdownFileCount;
  for (const error of result.errors) {
    reporter.report(`skills/${skill.name}/${error}`);
  }
}

const mainMarkdownFiles = await collectMainMarkdownFiles(rootDir);
await validateMarkdownLinks(mainMarkdownFiles, reporter.report, rootDir);

await validatePackageScripts(reporter.report, rootDir);
await validateRequiredProjectFiles(reporter.report, rootDir);

if (reporter.hasErrors()) {
  console.error("Validation failed:");
  for (const error of reporter.errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(
  `Validation passed (${discovery.skills.length} skills, `
  + `${mainMarkdownFiles.length + skillMarkdownFileCount} markdown files checked).`
);

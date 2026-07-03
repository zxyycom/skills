import {
  collectFiles,
  collectMainMarkdownFiles,
  discoverSkillPackages,
  rootDir
} from "./lib/project.ts";
import { ValidationReporter } from "./lib/validation.ts";
import { validateDecisionRecords } from "./validators/decision-records.ts";
import { validateMarkdownLinks } from "./validators/markdown-links.ts";
import {
  validatePackageScripts,
  validateRequiredProjectFiles
} from "./validators/project-config.ts";
import { validateSkillFrontmatter } from "./validators/skill-frontmatter.ts";

const reporter = new ValidationReporter();
const discovery = await discoverSkillPackages(rootDir);
reporter.addAll(discovery.errors);

for (const skill of discovery.skills) {
  await validateSkillFrontmatter(skill, reporter.report, rootDir);
}

const mainMarkdownFiles = await collectMainMarkdownFiles(rootDir);
const skillMarkdownFiles = (await Promise.all(discovery.skills.map((skill) => collectFiles(skill.directory))))
  .flat()
  .filter((filePath) => filePath.endsWith(".md"));
const markdownFiles = [...mainMarkdownFiles, ...skillMarkdownFiles];

await validateMarkdownLinks(markdownFiles, reporter.report, rootDir);

const decisionValidation = await validateDecisionRecords(rootDir);
reporter.addAll(decisionValidation.errors);

await validatePackageScripts(reporter.report, rootDir);
await validateRequiredProjectFiles(reporter.report, rootDir);

if (reporter.hasErrors()) {
  console.error("Validation failed:");
  for (const error of reporter.errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(`Validation passed (${discovery.skills.length} skills, ${markdownFiles.length} markdown files checked).`);

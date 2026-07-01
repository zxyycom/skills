import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fg from "fast-glob";
import { parse as parseYaml } from "yaml";
import { extractMarkdownHeadingAnchors, extractMarkdownLinks } from "./markdown-links.ts";
import { validateDecisionRecords } from "./validate-decisions.ts";

type SkillPackage = {
  name: string;
  directory: string;
  submodulePath: string;
};

type Frontmatter = {
  error: string | null;
  keys: string[];
  values: Record<string, unknown>;
};

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors: string[] = [];
const ignoredDirectoryNames = new Set([".git", ".agents", "node_modules", "dist"]);

function report(message: string): void {
  errors.push(message);
}

async function exists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function toPosix(relativePath: string): string {
  return relativePath.split(path.sep).join("/");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readSubmodulePaths(): Promise<string[]> {
  const gitmodulesPath = path.join(rootDir, ".gitmodules");
  if (!await exists(gitmodulesPath)) {
    report(".gitmodules is required for the multi-repository skill layout");
    return [];
  }

  const gitmodules = await fs.readFile(gitmodulesPath, "utf8");
  return [...gitmodules.matchAll(/^\s*path\s*=\s*(.+?)\s*$/gm)].map((match) => match[1]);
}

async function discoverSkills(submodulePaths: string[]): Promise<SkillPackage[]> {
  const skills: SkillPackage[] = [];
  const seenNames = new Set<string>();

  for (const submodulePath of submodulePaths) {
    const submoduleDir = path.join(rootDir, submodulePath);
    const skillRoot = path.join(submoduleDir, "skill");

    if (!await exists(skillRoot)) {
      report(`${submodulePath} must contain a skill/ directory`);
      continue;
    }

    const entries = await fs.readdir(skillRoot, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const skillDir = path.join(skillRoot, entry.name);
      const skillMdPath = path.join(skillDir, "SKILL.md");
      if (!await exists(skillMdPath)) {
        report(`${toPosix(path.relative(rootDir, skillDir))} must contain SKILL.md`);
        continue;
      }

      if (seenNames.has(entry.name)) {
        report(`Duplicate skill package name: ${entry.name}`);
        continue;
      }

      seenNames.add(entry.name);
      skills.push({ directory: skillDir, name: entry.name, submodulePath });
    }
  }

  if (skills.length === 0) {
    report("No skill packages discovered under submodule skill/ directories");
  }

  return skills.sort((a, b) => a.name.localeCompare(b.name));
}

async function collectFiles(directory: string): Promise<string[]> {
  const files = await fg("**/*", {
    cwd: directory,
    dot: true,
    ignore: [...ignoredDirectoryNames].map((directoryName) => `${directoryName}/**`),
    onlyFiles: true
  });

  return files.sort((a, b) => a.localeCompare(b)).map((filePath) => path.join(directory, filePath));
}

async function collectMainMarkdownFiles(submodulePaths: string[]): Promise<string[]> {
  const ignoredPaths = [
    ...submodulePaths.map((submodulePath) => `${toPosix(submodulePath)}/**`),
    ...[...ignoredDirectoryNames].map((directoryName) => `${directoryName}/**`)
  ];
  const markdownFiles = await fg(["*.md", "**/*.md"], {
    cwd: rootDir,
    dot: true,
    ignore: ignoredPaths,
    onlyFiles: true
  });

  return markdownFiles.sort((a, b) => a.localeCompare(b)).map((filePath) => path.join(rootDir, filePath));
}

function parseFrontmatter(markdown: string): Frontmatter | null {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) {
    return null;
  }

  try {
    const values = parseYaml(match[1]) as unknown;
    if (!isRecord(values)) {
      return { error: "must be a YAML mapping", keys: [], values: {} };
    }

    return { error: null, keys: Object.keys(values), values };
  } catch (error) {
    const message = error instanceof Error ? error.message : "invalid YAML";
    return { error: message, keys: [], values: {} };
  }
}

async function validateSkillFrontmatter(skill: SkillPackage): Promise<void> {
  const skillMdPath = path.join(skill.directory, "SKILL.md");
  const markdown = await fs.readFile(skillMdPath, "utf8");
  const frontmatter = parseFrontmatter(markdown);
  const relativeSkillMdPath = toPosix(path.relative(rootDir, skillMdPath));

  if (!frontmatter) {
    report(`${relativeSkillMdPath} must start with YAML frontmatter`);
    return;
  }

  if (frontmatter.error) {
    report(`${relativeSkillMdPath} frontmatter ${frontmatter.error}`);
    return;
  }

  const allowedKeys = new Set(["name", "description", "license", "compatibility", "metadata"]);
  const unknownKeys = frontmatter.keys.filter((key) => !allowedKeys.has(key));
  if (unknownKeys.length > 0) {
    report(`${relativeSkillMdPath} frontmatter has unsupported keys: ${unknownKeys.join(", ")}`);
  }

  for (const key of ["name", "description"]) {
    if (!frontmatter.keys.includes(key)) {
      report(`${relativeSkillMdPath} frontmatter is missing ${key}`);
    }
  }

  const name = frontmatter.values.name;
  if (name !== skill.name) {
    report(`${relativeSkillMdPath} name must be ${skill.name}`);
  }

  if (typeof name !== "string" || !/^[a-z0-9-]+$/.test(name)) {
    report(`${relativeSkillMdPath} name must use lowercase letters, digits, and hyphens`);
  }
}

type NormalizedMarkdownTarget =
  | { kind: "empty"; target: string }
  | { kind: "external"; target: string }
  | { anchor: string | null; kind: "internal"; pathTarget: string | null; target: string };

function normalizeMarkdownTarget(rawTarget: string): NormalizedMarkdownTarget {
  const target = rawTarget.trim().replace(/^<|>$/g, "");
  if (target.length === 0) {
    return { kind: "empty", target };
  }

  if (/^[a-z][a-z0-9+.-]*:/i.test(target)) {
    return { kind: "external", target };
  }

  const hashIndex = target.indexOf("#");
  const pathTarget = hashIndex >= 0 ? target.slice(0, hashIndex) : target;
  const anchor = hashIndex >= 0 ? target.slice(hashIndex + 1) : null;

  return { anchor, kind: "internal", pathTarget: pathTarget.length > 0 ? pathTarget : null, target };
}

function decodeMarkdownAnchor(anchor: string): string | null {
  try {
    return decodeURIComponent(anchor);
  } catch {
    return null;
  }
}

async function validateMarkdownLinks(markdownFiles: string[]): Promise<void> {
  const headingAnchorsByPath = new Map<string, Set<string>>();

  async function getHeadingAnchors(filePath: string): Promise<Set<string>> {
    const cached = headingAnchorsByPath.get(filePath);
    if (cached) {
      return cached;
    }

    const markdown = await fs.readFile(filePath, "utf8");
    const anchors = extractMarkdownHeadingAnchors(markdown);
    headingAnchorsByPath.set(filePath, anchors);
    return anchors;
  }

  for (const filePath of markdownFiles) {
    const markdown = await fs.readFile(filePath, "utf8");
    const { targets, missingReferenceLabels } = extractMarkdownLinks(markdown);
    const relativeFilePath = toPosix(path.relative(rootDir, filePath));

    for (const label of missingReferenceLabels) {
      report(`${relativeFilePath} has an undefined markdown reference link: ${label}`);
    }

    for (const { target } of targets) {
      const normalized = normalizeMarkdownTarget(target);
      if (normalized.kind === "empty") {
        report(`${relativeFilePath} has an empty markdown link target`);
        continue;
      }

      if (normalized.kind === "external") {
        continue;
      }

      const resolved = normalized.pathTarget
        ? path.resolve(path.dirname(filePath), normalized.pathTarget)
        : filePath;
      const relativeToRoot = path.relative(rootDir, resolved);
      if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) {
        report(`${relativeFilePath} links outside the repository: ${target}`);
        continue;
      }

      if (!await exists(resolved)) {
        report(`${relativeFilePath} has a missing link target: ${target}`);
        continue;
      }

      if (normalized.anchor === null) {
        continue;
      }

      const decodedAnchor = decodeMarkdownAnchor(normalized.anchor);
      if (decodedAnchor === null || decodedAnchor.length === 0) {
        report(`${relativeFilePath} has an invalid markdown anchor: ${target}`);
        continue;
      }

      if (path.extname(resolved) !== ".md") {
        report(`${relativeFilePath} uses an anchor on a non-markdown target: ${target}`);
        continue;
      }

      const anchors = await getHeadingAnchors(resolved);
      if (!anchors.has(decodedAnchor)) {
        report(`${relativeFilePath} links to a missing markdown heading anchor: ${target}`);
      }
    }
  }
}

async function validatePackageScripts(): Promise<void> {
  const packageJsonPath = path.join(rootDir, "package.json");
  if (!await exists(packageJsonPath)) {
    report("package.json is required for local validation and packaging scripts");
    return;
  }

  const packageJson = JSON.parse(await fs.readFile(packageJsonPath, "utf8"));
  for (const scriptName of [
    "typecheck",
    "validate",
    "validate:decisions",
    "pack:skills",
    "check",
    "deploy:package"
  ]) {
    if (!packageJson.scripts?.[scriptName]) {
      report(`package.json is missing script ${scriptName}`);
    }
  }
}

async function validateRequiredProjectFiles(): Promise<void> {
  for (const relativePath of [
    ".gitmodules",
    "README.md",
    "AGENTS.md",
    "pnpm-workspace.yaml",
    "tsconfig.json",
    "docs/tooling.md",
    ".github/workflows/package-skills.yml"
  ]) {
    if (!await exists(path.join(rootDir, relativePath))) {
      report(`${relativePath} is required`);
    }
  }
}

async function validateCiWorkflow(): Promise<void> {
  const workflowPath = path.join(rootDir, ".github", "workflows", "package-skills.yml");
  if (!await exists(workflowPath)) {
    return;
  }

  const workflow = await fs.readFile(workflowPath, "utf8");
  const requiredPatterns = [
    { label: "package job", pattern: /^\s*package:\s*$/m },
    { label: "publish job", pattern: /^\s*publish:\s*$/m },
    { label: "artifact upload", pattern: /actions\/upload-artifact@v4/ },
    { label: "artifact download", pattern: /actions\/download-artifact@v4/ },
    { label: "main branch publish guard", pattern: /github\.ref == 'refs\/heads\/main'/ },
    { label: "release write permission", pattern: /contents:\s*write/ },
    { label: "latest release tag", pattern: /RELEASE_TAG:\s*skills-latest/ },
    { label: "release creation", pattern: /gh release create/ },
    { label: "release asset upload", pattern: /gh release upload/ },
    { label: "all skill zips", pattern: /dist\/\*\.zip/ }
  ];

  for (const { label, pattern } of requiredPatterns) {
    if (!pattern.test(workflow)) {
      report(`CI workflow is missing ${label}`);
    }
  }
}

const submodulePaths = await readSubmodulePaths();
const skills = await discoverSkills(submodulePaths);
for (const skill of skills) {
  await validateSkillFrontmatter(skill);
}

const mainMarkdownFiles = await collectMainMarkdownFiles(submodulePaths);
const skillMarkdownFiles = (await Promise.all(skills.map((skill) => collectFiles(skill.directory))))
  .flat()
  .filter((filePath) => filePath.endsWith(".md"));
const markdownFiles = [...mainMarkdownFiles, ...skillMarkdownFiles];

await validateMarkdownLinks(markdownFiles);
const decisionValidation = await validateDecisionRecords(rootDir);
for (const error of decisionValidation.errors) {
  report(error);
}
await validatePackageScripts();
await validateRequiredProjectFiles();
await validateCiWorkflow();

if (errors.length > 0) {
  console.error("Validation failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(`Validation passed (${skills.length} skills, ${markdownFiles.length} markdown files checked).`);

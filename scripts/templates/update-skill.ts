import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { createInterface } from "node:readline/promises";
import { parseArgs } from "node:util";
import { unzipSync } from "fflate";

type UpdaterConfig = {
  packageLockAssetName: string;
  releaseAssetName: string;
  repo: string;
  skillName: string;
  sourcePath: string;
};

type CliOptions = {
  check: boolean;
  releaseTag: string | null;
  targetDir: string;
  yes: boolean;
};

type GitHubRelease = {
  assets: Array<{
    name: string;
    url: string;
  }>;
  html_url: string;
  tag_name: string;
};

type SkillPackageLock = {
  aggregateHash: string;
  schemaVersion: number;
  skills: Record<string, string>;
};

type SkillFile = {
  data: Buffer;
  path: string;
};

const UPDATE_CONFIG = JSON.parse("__SKILL_UPDATE_CONFIG_JSON__") as UpdaterConfig;
const sourceRepositoryUrl = `https://github.com/${UPDATE_CONFIG.repo}`;
const updaterSourceUrl = `${sourceRepositoryUrl}/blob/main/scripts/templates/update-skill.ts`;
const ignoredDirectoryNames = new Set([".git", "node_modules"]);

function skillSourceDirectoryUrl(ref: string): string {
  return `https://github.com/${UPDATE_CONFIG.repo}/tree/${ref}/${UPDATE_CONFIG.sourcePath}`;
}

function latestReleaseUrl(): string {
  return `https://github.com/${UPDATE_CONFIG.repo}/releases/latest`;
}

function latestReleaseAssetUrl(assetName: string): string {
  return `https://github.com/${UPDATE_CONFIG.repo}/releases/latest/download/${assetName}`;
}

function printHelp(): void {
  console.log([
    `Usage: node ${path.basename(currentScriptPath())} [--check] [--yes] [--target-dir <dir>] [--release-tag <tag>]`,
    "",
    `Checks and updates ${UPDATE_CONFIG.skillName} from ${UPDATE_CONFIG.repo} release assets.`,
    "",
    "Maintenance:",
    `  Repository: ${sourceRepositoryUrl}`,
    `  Updater source: ${updaterSourceUrl}`,
    `  Skill source directory: ${skillSourceDirectoryUrl("main")}`,
    `  Default release: ${latestReleaseUrl()}`,
    `  Package lock asset: ${latestReleaseAssetUrl(UPDATE_CONFIG.packageLockAssetName)}`,
    `  Skill zip asset: ${latestReleaseAssetUrl(UPDATE_CONFIG.releaseAssetName)}`,
    "",
    "Options:",
    "  --check             Check whether the target differs from the remote source, without updating.",
    "  --yes, -y           Update without prompting.",
    "  --target-dir <dir>  Skill directory to check or update. Defaults to this script's parent skill directory.",
    "  --release-tag <tag> GitHub release tag to read from. Defaults to the latest release.",
    "  --help, -h          Show this help."
  ].join("\n"));
}

function currentScriptPath(): string {
  return path.resolve(process.argv[1] ?? process.cwd());
}

function defaultTargetDir(): string {
  const scriptDir = path.dirname(currentScriptPath());
  if (path.basename(scriptDir) === "scripts") {
    return path.dirname(scriptDir);
  }

  return process.cwd();
}

function parseCliOptions(argv: string[]): CliOptions {
  const parsed = parseArgs({
    args: argv,
    options: {
      check: { type: "boolean" },
      help: { short: "h", type: "boolean" },
      "release-tag": { type: "string" },
      "target-dir": { type: "string" },
      yes: { short: "y", type: "boolean" }
    },
    strict: true
  });

  if (parsed.values.help) {
    printHelp();
    process.exit(0);
  }

  return {
    check: parsed.values.check ?? false,
    releaseTag: parsed.values["release-tag"] ?? null,
    targetDir: path.resolve(parsed.values["target-dir"] ?? defaultTargetDir()),
    yes: parsed.values.yes ?? false
  };
}

function toPosix(filePath: string): string {
  return filePath.split(path.sep).join("/");
}

function isFileSystemError(error: unknown, code: string): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === code;
}

function normalizeRepoPath(repoPath: string): string {
  return repoPath.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
}

function isInsideDirectory(candidate: string, directory: string): boolean {
  const relativePath = path.relative(path.resolve(directory), path.resolve(candidate));
  return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
}

function safeJoin(root: string, relativePath: string): string {
  const fullPath = path.resolve(root, relativePath);
  if (!isInsideDirectory(fullPath, root)) {
    throw new Error(`Refusing to write outside target directory: ${relativePath}`);
  }

  return fullPath;
}

function githubHeaders(accept: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: accept,
    "User-Agent": "skill-self-updater",
    "X-GitHub-Api-Version": "2022-11-28"
  };
  const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

async function fetchGitHubRelease(releaseTag: string | null): Promise<GitHubRelease> {
  const encodedRepo = UPDATE_CONFIG.repo.split("/").map(encodeURIComponent).join("/");
  const encodedTag = releaseTag === null ? null : encodeURIComponent(releaseTag);
  const releaseApiUrl = encodedTag === null
    ? `https://api.github.com/repos/${encodedRepo}/releases/latest`
    : `https://api.github.com/repos/${encodedRepo}/releases/tags/${encodedTag}`;
  const response = await fetch(releaseApiUrl, {
    headers: githubHeaders("application/vnd.github+json")
  });

  if (!response.ok) {
    throw new Error(`GitHub release lookup failed (${response.status}): ${await response.text()}`);
  }

  return await response.json() as GitHubRelease;
}

function findReleaseAsset(release: GitHubRelease, assetName: string): GitHubRelease["assets"][number] | null {
  return release.assets.find((candidate) => candidate.name === assetName) ?? null;
}

async function fetchReleaseAsset(release: GitHubRelease, assetName: string): Promise<Uint8Array> {
  const asset = findReleaseAsset(release, assetName);
  if (!asset) {
    const availableAssets = release.assets.map((candidate) => candidate.name).join(", ") || "(none)";
    throw new Error(`Release ${release.tag_name} does not contain ${assetName}. Available assets: ${availableAssets}`);
  }

  const response = await fetch(asset.url, {
    headers: githubHeaders("application/octet-stream")
  });

  if (!response.ok) {
    throw new Error(`GitHub release asset download failed (${response.status}): ${await response.text()}`);
  }

  return new Uint8Array(await response.arrayBuffer());
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

async function fetchReleasePackageLock(release: GitHubRelease): Promise<SkillPackageLock | null> {
  if (!findReleaseAsset(release, UPDATE_CONFIG.packageLockAssetName)) {
    return null;
  }

  const data = await fetchReleaseAsset(release, UPDATE_CONFIG.packageLockAssetName);
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(data).toString("utf8"));
  } catch {
    throw new Error(`Release ${release.tag_name} contains invalid ${UPDATE_CONFIG.packageLockAssetName} JSON`);
  }

  const lock = parsed as Partial<SkillPackageLock>;
  if (lock.schemaVersion !== 1 || !isSha256(lock.aggregateHash) || typeof lock.skills !== "object" || lock.skills === null) {
    throw new Error(`Release ${release.tag_name} contains invalid ${UPDATE_CONFIG.packageLockAssetName}`);
  }

  const skillHash = lock.skills[UPDATE_CONFIG.skillName];
  if (!isSha256(skillHash)) {
    throw new Error(`${UPDATE_CONFIG.packageLockAssetName} does not contain a valid hash for ${UPDATE_CONFIG.skillName}`);
  }

  return lock as SkillPackageLock;
}

async function fetchReleaseAssetZip(release: GitHubRelease): Promise<Uint8Array> {
  return await fetchReleaseAsset(release, UPDATE_CONFIG.releaseAssetName);
}

function extractSkillFilesFromReleaseAsset(zipData: Uint8Array): SkillFile[] {
  const sourcePath = normalizeRepoPath(UPDATE_CONFIG.skillName);
  const files = unzipSync(zipData);
  const entries = Object.entries(files).sort(([left], [right]) => left.localeCompare(right));
  const sourcePrefix = `${sourcePath}/`;
  const skillFiles = entries
    .filter(([entryPath]) => entryPath.startsWith(sourcePrefix))
    .filter(([entryPath]) => !entryPath.endsWith("/"))
    .map(([entryPath, data]) => ({
      data: Buffer.from(data),
      path: entryPath.slice(sourcePrefix.length)
    }))
    .filter((file) => file.path.length > 0)
    .sort((left, right) => left.path.localeCompare(right.path));

  if (!skillFiles.some((file) => file.path === "SKILL.md")) {
    throw new Error(`Remote release asset does not contain ${sourcePath}/SKILL.md`);
  }

  return skillFiles;
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch (error) {
    if (isFileSystemError(error, "ENOENT")) {
      return false;
    }

    throw error;
  }
}

async function collectLocalFiles(directory: string, baseDirectory = directory): Promise<string[]> {
  let entries;
  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (isFileSystemError(error, "ENOENT")) {
      return [];
    }

    throw error;
  }

  const files: string[] = [];
  for (const entry of entries) {
    if (entry.isDirectory() && ignoredDirectoryNames.has(entry.name)) {
      continue;
    }

    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectLocalFiles(fullPath, baseDirectory));
      continue;
    }

    if (entry.isFile()) {
      files.push(toPosix(path.relative(baseDirectory, fullPath)));
    }
  }

  return files.sort((left, right) => left.localeCompare(right));
}

function packageFingerprint(files: SkillFile[]): string {
  const hash = crypto.createHash("sha256");
  hash.update(`skill-self-update-v1\0${UPDATE_CONFIG.skillName}\0`);

  for (const file of files) {
    hash.update(`file\0${file.path}\0${file.data.byteLength}\0`);
    hash.update(file.data);
    hash.update("\0");
  }

  return hash.digest("hex");
}

async function localFingerprint(targetDir: string): Promise<string | null> {
  if (!await pathExists(targetDir)) {
    return null;
  }

  const stats = await fs.stat(targetDir);
  if (!stats.isDirectory()) {
    throw new Error(`Target path exists but is not a directory: ${targetDir}`);
  }

  const localPaths = await collectLocalFiles(targetDir);
  const files = await Promise.all(localPaths.map(async (relativePath) => ({
    data: await fs.readFile(safeJoin(targetDir, relativePath)),
    path: relativePath
  })));

  return packageFingerprint(files);
}

async function writeSkillFiles(files: SkillFile[], tempDir: string): Promise<void> {
  await fs.mkdir(tempDir, { recursive: true });

  for (const file of files) {
    const outputPath = safeJoin(tempDir, file.path);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, file.data);
  }
}

async function replaceDirectory(targetDir: string, tempDir: string): Promise<void> {
  const parentDir = path.dirname(targetDir);
  const baseName = path.basename(targetDir);
  const backupDir = path.join(parentDir, `.${baseName}.backup-${process.pid}-${Date.now()}`);
  const targetExists = await pathExists(targetDir);

  if (isInsideDirectory(process.cwd(), targetDir)) {
    process.chdir(os.tmpdir());
  }

  try {
    if (targetExists) {
      await fs.rename(targetDir, backupDir);
    }

    await fs.rename(tempDir, targetDir);

    if (targetExists) {
      await fs.rm(backupDir, { force: true, recursive: true });
    }
  } catch (error) {
    if (!await pathExists(targetDir) && await pathExists(backupDir)) {
      await fs.rename(backupDir, targetDir);
    }

    throw error;
  }
}

async function confirmUpdate(options: CliOptions): Promise<boolean> {
  if (options.yes) {
    return true;
  }

  if (!process.stdin.isTTY) {
    console.error("Update available. Run again with --yes to update without an interactive prompt.");
    return false;
  }

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });

  try {
    const answer = await rl.question("Update this skill now? [y/N] ");
    return /^y(es)?$/i.test(answer.trim());
  } finally {
    rl.close();
  }
}

async function main(): Promise<void> {
  const options = parseCliOptions(process.argv.slice(2));
  const targetDir = path.resolve(options.targetDir);

  console.log(`Skill: ${UPDATE_CONFIG.skillName}`);
  console.log(`Repository: ${sourceRepositoryUrl}`);
  console.log(`Updater source: ${updaterSourceUrl}`);
  console.log(`Skill source directory: ${skillSourceDirectoryUrl("main")}`);
  console.log(`Release: ${options.releaseTag ?? "latest"}`);
  console.log(`Package lock asset: ${UPDATE_CONFIG.packageLockAssetName}`);
  console.log(`Release asset: ${UPDATE_CONFIG.releaseAssetName}`);
  console.log(`Target: ${targetDir}`);

  const release = await fetchGitHubRelease(options.releaseTag);
  console.log(`Resolved release: ${release.tag_name} (${release.html_url})`);

  const packageLock = await fetchReleasePackageLock(release);
  let remoteFiles: SkillFile[] | null = null;
  let remoteHash = packageLock?.skills[UPDATE_CONFIG.skillName] ?? null;

  if (packageLock) {
    console.log(`Package lock asset: ${UPDATE_CONFIG.packageLockAssetName}`);
    console.log(`Package aggregate fingerprint: ${packageLock.aggregateHash}`);
  } else {
    console.log(`Package lock asset: ${UPDATE_CONFIG.packageLockAssetName} (missing; falling back to zip fingerprint)`);
    remoteFiles = extractSkillFilesFromReleaseAsset(await fetchReleaseAssetZip(release));
    remoteHash = packageFingerprint(remoteFiles);
  }

  const currentHash = await localFingerprint(targetDir);

  console.log(`Remote fingerprint: ${remoteHash}`);
  console.log(`Local fingerprint: ${currentHash ?? "(missing)"}`);

  if (currentHash === remoteHash) {
    console.log("Status: current");
    return;
  }

  console.log(currentHash ? "Status: update available" : "Status: target missing");

  if (options.check) {
    process.exitCode = 1;
    return;
  }

  if (!await confirmUpdate(options)) {
    process.exitCode = 1;
    return;
  }

  if (remoteFiles === null) {
    remoteFiles = extractSkillFilesFromReleaseAsset(await fetchReleaseAssetZip(release));
    const zipHash = packageFingerprint(remoteFiles);
    if (zipHash !== remoteHash) {
      throw new Error(`Release asset ${UPDATE_CONFIG.releaseAssetName} fingerprint ${zipHash} does not match ${UPDATE_CONFIG.packageLockAssetName} hash ${remoteHash}`);
    }
  }

  const parentDir = path.dirname(targetDir);
  await fs.mkdir(parentDir, { recursive: true });
  const tempDir = path.join(parentDir, `.${path.basename(targetDir)}.update-${process.pid}-${Date.now()}`);

  try {
    await writeSkillFiles(remoteFiles, tempDir);
    await replaceDirectory(targetDir, tempDir);
    console.log("Updated skill successfully.");
  } finally {
    if (await pathExists(tempDir)) {
      await fs.rm(tempDir, { force: true, recursive: true });
    }
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

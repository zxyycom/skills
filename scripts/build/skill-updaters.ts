import { isMainModule } from "../../tools/shared/src/node/main-module.ts";
import { parseGeneratedFileMode } from "../lib/generated-file.ts";
import { githubRepository } from "../lib/project.ts";
import type { SourceRuntimeOptions } from "../lib/source-runtime.ts";
import { skillReleaseManifestFileName } from "../../tools/skill-package/src/release-manifest.ts";
import type { UpdaterConfig } from "../../tools/skill-updater/src/types.ts";

export const updaterRetiredPaths: readonly string[] = [
  "scripts/update-skill.mjs",
  "scripts/update-skill.mjs.map",
  "scripts/update-skill.d.mts",
  "scripts/update-skill.cjs",
  "scripts/update-skill.cjs.map",
  "scripts/update-skill.d.cts",
  "scripts/update-skill.js",
  "scripts/update-skill.js.map"
];

/** The caller combines this entry with all domain entries before one sync. */
export function buildSkillUpdaterEntry(
  skillName: string
): SourceRuntimeOptions["entries"][number] {
  const config: UpdaterConfig = {
    releaseAssetName: `${skillName}.zip`,
    releaseManifestAssetName: skillReleaseManifestFileName,
    repo: githubRepository,
    skillName,
    sourcePath: `skills/${skillName}`
  };
  return {
    sourcePath: "tools/skill-updater/src/index.ts",
    outputName: "update-skill.ts",
    body: `// Release manifest asset: https://github.com/${config.repo}/releases/latest/download/${config.releaseManifestAssetName}
// Release asset: https://github.com/${config.repo}/releases/latest/download/${config.releaseAssetName}
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { UpdaterConfig } from "./runtime/tools/skill-updater/src/types.ts";
export type { UpdaterConfig } from "./runtime/tools/skill-updater/src/types.ts";

export const skillUpdaterConfig: Readonly<UpdaterConfig> = Object.freeze(${JSON.stringify(config, null, 2)});

export async function runSkillUpdaterCli(
  argv: readonly string[] = process.argv.slice(2)
): Promise<number> {
  let runtime: typeof import("./runtime/tools/skill-updater/src/index.ts");
  const skillDirectory = fileURLToPath(new URL("../", import.meta.url));
  const installCommand = 'pnpm --dir ' + JSON.stringify(skillDirectory) + ' install --ignore-workspace --prod --frozen-lockfile --config.node-linker=isolated';
  try {
    // Load the complete updater before any package files can be overwritten.
    runtime = await import("./runtime/tools/skill-updater/src/index.ts");
  } catch (error) {
    const diagnostic = error instanceof Error ? error.message : String(error);
    throw new Error('Unable to load skill updater runtime: ' + diagnostic + '\\nRestore compatible dependencies explicitly:\\n  ' + installCommand + '\\nIf runtime files or the manifest/lockfile are damaged, re-obtain this skill and retry. No installation was attempted.', { cause: error });
  }
  return await runtime.runSkillUpdaterCli(skillUpdaterConfig, import.meta.url, argv);
}

if (process.argv[1] !== undefined && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try {
    process.exitCode = await runSkillUpdaterCli();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}`
  };
}

if (isMainModule(import.meta.url)) {
  const mode = parseGeneratedFileMode(process.argv.slice(2));
  // The registry owns each skill's complete entry set, including its updater.
  const { syncAllSkillRuntimes } = await import("../lib/skill-runtime.ts");
  const changed = await syncAllSkillRuntimes(mode);
  if (mode === "check" && changed) process.exitCode = 1;
}

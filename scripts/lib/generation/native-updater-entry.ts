import type { NativeRole } from "../../../tools/skill-package/src/native-release-manifest.ts";
import { githubRepository } from "../project.ts";

export const nativeUpdaterSource = "tools/skill-updater/src/native/cli.ts";
export const nativeUpdaterResources = [
  {
    sourcePath: "tools/skill-updater/src/native/legacy-manifests.json",
    outputPath:
      "scripts/runtime/tools/skill-updater/src/native/legacy-manifests.json"
  }
];

/** Both bootstrap and installed entries call the same native updater engine. */
export function nativeUpdaterEntry(role: NativeRole, bootstrap: boolean) {
  const config = {
    releaseAssetName: `${role}-native.zip`,
    releaseManifestAssetName: "skill-release-manifest.json",
    repo: githubRepository,
    skillName: role,
    sourcePath: `skills/${role}`
  };
  return {
    sourcePath: nativeUpdaterSource,
    outputName: bootstrap ? `${role}.ts` : "update-skill.ts",
    body: `import { runNativeUpdaterCli } from "./runtime/tools/skill-updater/src/native/cli.ts";
import { pathToFileURL } from "node:url";
import path from "node:path";
const config = ${JSON.stringify(config)};
export async function run(argv: readonly string[] = process.argv.slice(2)): Promise<number> {
  return await runNativeUpdaterCli(config, ${JSON.stringify(role)}, import.meta.url, argv, ${bootstrap});
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try { process.exitCode = await run(); } catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
}`
  };
}

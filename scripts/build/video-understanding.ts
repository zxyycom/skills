import type { SourceRuntimeFacts } from "../lib/generation/runtime/source-runtime.ts";
import type { GeneratedFileMode } from "../lib/generation/generated-file.ts";
import {
  buildSkillRuntimeArtifacts,
  syncSkillRuntimeArtifacts,
  runRuntimeAdapter
} from "../lib/generation/runtime/skill-runtime.ts";

const sourcePath = "tools/video-understanding/src/cli-entry.ts";
const runtimePath = `./runtime/${sourcePath}`;
const resourcePaths = [
  "scripts/media.py",
  "scripts/rapidocr.py",
  "scripts/runtime.env",
  "runtime/ocr-profiles.json",
  "runtime/package.json",
  "runtime/pnpm-lock.yaml",
  "runtime/pnpm-workspace.yaml",
  "runtime/prepare-model.py",
  "runtime/prepare-ocr.py",
  "runtime/rapidocr-requirements-lock.txt",
  "runtime/requirements.txt"
];

// This entry owns installation-relative resource binding; the internal factory
// is not part of the distributed public API.
const entryBody = `import { fileURLToPath } from "node:url";
let runtime: typeof import(${JSON.stringify(runtimePath)});
try {
  runtime = await import(${JSON.stringify(runtimePath)});
} catch (error) {
  const directory = fileURLToPath(new URL("../", import.meta.url));
  const diagnostic = error instanceof Error ? error.message : String(error);
  throw new Error(diagnostic + '\\nRestore compatible dependencies explicitly:\\n  pnpm --dir ' + JSON.stringify(directory) + ' install --ignore-workspace --prod --frozen-lockfile --config.node-linker=isolated\\nIf package files or manifest/lockfile are damaged, re-obtain this skill. No installation was attempted.', { cause: error });
}
export type { Failure, VideoCliDefaults } from ${JSON.stringify(runtimePath)};
export type VideoFailure = import(${JSON.stringify(runtimePath)}).VideoFailure;
export const VideoFailure = runtime.VideoFailure;
export const runVideoCli = runtime.createVideoCli(import.meta.url);
if (import.meta.main) {
  await runVideoCli(process.argv.slice(2));
}`;

export async function syncRuntime(
  mode: GeneratedFileMode,
  facts?: SourceRuntimeFacts
): Promise<boolean> {
  const artifacts = await buildSkillRuntimeArtifacts(
    {
      skillName: "video-understanding",
      rebuildCommand: "bun run sync:video-understanding-cli",
      nodeEngine: ">=24.18",
      entries: [{ sourcePath, outputName: "video.ts", body: entryBody }],
      resources: resourcePaths.map((outputPath) => ({
        sourcePath: `tools/video-understanding/resources/${outputPath}`,
        outputPath
      }))
    },
    facts
  );
  return await syncSkillRuntimeArtifacts(artifacts, {
    mode,
    skillName: "video-understanding",
    retiredPaths: []
  });
}

await runRuntimeAdapter(import.meta.url, syncRuntime);

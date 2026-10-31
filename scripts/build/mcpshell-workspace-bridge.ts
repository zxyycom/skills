import fs from "node:fs/promises";
import path from "node:path";
import type { GeneratedFileMode } from "../lib/generation/generated-file.ts";
import type {
  SourceRuntimeOptions,
  SourceRuntimeFacts
} from "../lib/generation/runtime/source-runtime.ts";
import {
  buildSkillRuntimeArtifacts,
  syncSkillRuntimeArtifacts,
  runRuntimeAdapter
} from "../lib/generation/runtime/skill-runtime.ts";
import { rootDir } from "../lib/project.ts";

const rebuildCommand = "bun run sync:mcpshell-workspace-bridge";
const skillName = "mcpshell-workspace-tools";
function entry(initializer: boolean): SourceRuntimeOptions["entries"][number] {
  const module = initializer ? "initializer" : "runtime";
  const runner = initializer ? "runInitializerCli" : "runWorkspaceCli";
  const publicExports = initializer
    ? "runInitializer, readCliRequest"
    : "runWorkspaceOperation";
  const publicTypes = initializer
    ? "InitializerAction, InitializerCommand, InitializerPaths, InitializerRequest, InitializerResult"
    : "RuntimeInput, RuntimeMode, RuntimeOptions";
  const sourcePath = `tools/mcpshell-workspace-bridge/src/${module}.ts`;
  return {
    sourcePath,
    outputName: `${initializer ? "init-" : ""}mcpshell-workspace.ts`,
    body: `import path from "node:path";
import { pathToFileURL } from "node:url";
import { ${runner} } from "./runtime/${sourcePath}";
export { ${publicExports} } from "./runtime/${sourcePath}";
export type { ${publicTypes} } from "./runtime/${sourcePath}";
if (process.argv[1] !== undefined && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  await ${runner}(import.meta.url);
}`
  };
}
export async function syncRuntime(
  mode: GeneratedFileMode,
  facts?: SourceRuntimeFacts
): Promise<boolean> {
  const artifacts = await buildSkillRuntimeArtifacts(
    {
      skillName,
      rebuildCommand,
      nodeEngine: ">=24.18",
      entries: [entry(true), entry(false)]
    },
    facts
  );
  const ignore = artifacts.find(
    (artifact) =>
      artifact.path === path.join(rootDir, `skills/${skillName}/.gitignore`)
  );
  if (ignore === undefined)
    throw new Error("Runtime generation must include .gitignore");
  ignore.content += "/.env.mcpshell\n";
  const sourcePath =
    "tools/mcpshell-workspace-bridge/references/mcpshell-tools.yaml";
  artifacts.push({
    content:
      `# Generated file. Do not edit directly.\n# Source: ${sourcePath}; rebuild: ${rebuildCommand}.\n` +
      (await fs.readFile(path.join(rootDir, sourcePath), "utf8")),
    path: path.join(
      rootDir,
      `skills/${skillName}/references/mcpshell-tools.yaml`
    ),
    sourcePath
  });
  return await syncSkillRuntimeArtifacts(artifacts, {
    mode,
    skillName,
    retiredPaths: [
      "scripts/init-mcpshell-workspace.mjs",
      "scripts/init-mcpshell-workspace.mjs.map",
      "scripts/mcpshell-workspace.mjs",
      "scripts/mcpshell-workspace.mjs.map"
    ]
  });
}
await runRuntimeAdapter(import.meta.url, syncRuntime);

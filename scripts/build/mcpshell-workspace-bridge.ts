import fs from "node:fs/promises";
import path from "node:path";
import {
  buildGeneratedFileHeader,
  bundleWithBun,
  parseGeneratedFileMode,
  syncGeneratedArtifacts,
  type GeneratedArtifact
} from "../lib/generated-file.ts";
import { githubRepository, rootDir } from "../lib/project.ts";

const rebuildCommand = "bun run sync:mcpshell-workspace-bridge";
const sourceDirectory = "tools/mcpshell-workspace-bridge";
const skillDirectory = "skills/mcpshell-workspace-tools";

const scripts = [
  {
    artifactName: "MCPShell workspace initializer",
    output: "scripts/init-mcpshell-workspace.mjs",
    source: "tools/mcpshell-workspace-bridge/src/initializer.ts"
  },
  {
    artifactName: "MCPShell workspace runtime helper",
    output: "scripts/mcpshell-workspace.mjs",
    source: "tools/mcpshell-workspace-bridge/src/runtime.ts"
  }
] as const;

async function buildArtifacts(): Promise<GeneratedArtifact[]> {
  const artifacts: GeneratedArtifact[] = [];
  for (const script of scripts) {
    const outputPath = path.join(rootDir, skillDirectory, script.output);
    const bundle = await bundleWithBun({
      banner: buildGeneratedFileHeader({
        artifactName: script.artifactName,
        rebuildCommand,
        repository: githubRepository,
        skillSourcePath: skillDirectory,
        sourcePath: script.source
      }),
      cwd: rootDir,
      entryPath: path.join(rootDir, script.source),
      format: "esm",
      keepNames: true,
      minify: true,
      outputFileName: path.basename(outputPath),
      sourceMapBaseDirectory: path.dirname(outputPath),
      sourceMap: true
    });
    if (bundle.sourceMap === null) {
      throw new Error(
        `${script.artifactName} bundle must include a source map`
      );
    }
    const serializedRoot = JSON.stringify(rootDir).slice(1, -1);
    if (bundle.code.includes(rootDir) || bundle.code.includes(serializedRoot)) {
      throw new Error(
        `${script.artifactName} bundle contains an absolute workspace path`
      );
    }
    artifacts.push(
      { content: bundle.code, path: outputPath, sourcePath: script.source },
      {
        content: bundle.sourceMap,
        path: `${outputPath}.map`,
        sourcePath: script.source
      }
    );
  }

  const yamlSourcePath = path.join(
    sourceDirectory,
    "references",
    "mcpshell-tools.yaml"
  );
  const yaml = await fs.readFile(path.join(rootDir, yamlSourcePath), "utf8");
  artifacts.push({
    content:
      "# Generated file. Do not edit directly.\n" +
      `# Source: ${yamlSourcePath}; rebuild: ${rebuildCommand}.\n` +
      yaml,
    path: path.join(
      rootDir,
      skillDirectory,
      "references",
      "mcpshell-tools.yaml"
    ),
    sourcePath: yamlSourcePath
  });
  return artifacts;
}

async function main(): Promise<void> {
  const mode = parseGeneratedFileMode(process.argv.slice(2));
  const changed = await syncGeneratedArtifacts(
    await buildArtifacts(),
    mode,
    rootDir,
    sourceDirectory
  );
  if (mode === "check" && changed) {
    process.exit(1);
  }
  if (!changed) {
    console.log("MCPShell workspace bridge generated artifacts are current.");
  }
}

await main();

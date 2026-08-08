import path from "node:path";
import {
  buildGeneratedFileHeader,
  bundleWithBun,
  parseGeneratedFileMode,
  syncGeneratedArtifacts,
  type GeneratedArtifact
} from "../lib/generated-file.ts";
import { githubRepository, rootDir } from "../lib/project.ts";

const rebuildCommand = "bun run sync:change-plan-cli";
const skillSourcePath = "skills/change-plan";
const sourceRelativePath = "tools/change-plan/src/cli.ts";
const outputRelativePath = "skills/change-plan/scripts/change-plan.mjs";

function generatedHeader(): string {
  return buildGeneratedFileHeader({
    artifactName: "change plan lifecycle CLI",
    rebuildCommand,
    repository: githubRepository,
    skillSourcePath,
    sourcePath: sourceRelativePath
  });
}

async function buildArtifacts(): Promise<GeneratedArtifact[]> {
  const bundle = await bundleWithBun({
    banner: generatedHeader(),
    cwd: rootDir,
    entryPath: path.join(rootDir, sourceRelativePath),
    format: "esm",
    keepNames: true,
    minify: true,
    outputFileName: path.basename(outputRelativePath),
    sourceMapBaseDirectory: path.dirname(
      path.join(rootDir, outputRelativePath)
    ),
    sourceMap: true
  });
  if (bundle.sourceMap === null) {
    throw new Error("Change plan CLI bundle must include a source map");
  }

  const outputPath = path.join(rootDir, outputRelativePath);
  return [
    {
      content: bundle.code,
      path: outputPath,
      sourcePath: sourceRelativePath
    },
    {
      content: bundle.sourceMap,
      path: `${outputPath}.map`,
      sourcePath: sourceRelativePath
    }
  ];
}

async function main(): Promise<void> {
  const mode = parseGeneratedFileMode(process.argv.slice(2));
  const changed = await syncGeneratedArtifacts(
    await buildArtifacts(),
    mode,
    rootDir,
    sourceRelativePath
  );

  if (mode === "check" && changed) {
    process.exit(1);
  }
  if (!changed) {
    console.log("Change plan CLI generated artifacts are current.");
  }
}

await main();

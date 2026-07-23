import path from "node:path";
import {
  buildGeneratedDeclaration,
  buildGeneratedFileHeader,
  bundleWithBun,
  parseGeneratedFileMode,
  syncGeneratedArtifacts,
  type BunBundleResult
} from "../lib/generated-file.ts";
import { githubRepository, rootDir } from "../lib/project.ts";

const sourceRelativePath = "tools/change-plan/src/cli.ts";
const declarationSourceRelativePath = "tools/change-plan/api/change-plan.d.mts";
const outputRelativePath = "skills/change-plan/scripts/change-plan.mjs";
const declarationOutputRelativePath = "skills/change-plan/scripts/change-plan.d.mts";

async function buildArtifact(): Promise<BunBundleResult> {
  return await bundleWithBun({
    banner: buildGeneratedFileHeader({
      artifactName: "change plan structure checker",
      rebuildCommand: "bun run sync:change-plan-cli",
      repository: githubRepository,
      skillSourcePath: "skills/change-plan",
      sourcePath: sourceRelativePath
    }),
    cwd: rootDir,
    entryPath: path.join(rootDir, sourceRelativePath),
    format: "esm",
    keepNames: true,
    minify: true,
    outputFileName: path.basename(outputRelativePath),
    sourceMapBaseDirectory: path.dirname(path.join(rootDir, outputRelativePath)),
    sourceMap: true
  });
}

async function main(): Promise<void> {
  const mode = parseGeneratedFileMode(process.argv.slice(2));
  const outputPath = path.join(rootDir, outputRelativePath);
  const expected = await buildArtifact();
  const expectedDeclaration = await buildGeneratedDeclaration({
    banner: buildGeneratedFileHeader({
      artifactName: "change plan checker TypeScript declarations",
      rebuildCommand: "bun run sync:change-plan-cli",
      repository: githubRepository,
      skillSourcePath: "skills/change-plan",
      sourcePath: declarationSourceRelativePath
    }),
    sourcePath: path.join(rootDir, declarationSourceRelativePath)
  });
  if (expected.sourceMap === null) {
    throw new Error("Change plan checker bundle must include a source map");
  }

  const changed = await syncGeneratedArtifacts(
    [
      { content: expected.code, path: outputPath },
      { content: expected.sourceMap, path: `${outputPath}.map` },
      {
        content: expectedDeclaration,
        path: path.join(rootDir, declarationOutputRelativePath),
        sourcePath: declarationSourceRelativePath
      }
    ],
    mode,
    rootDir,
    sourceRelativePath
  );

  if (mode === "check" && changed) {
    process.exit(1);
  }
  if (!changed) {
    console.log("Change plan checker generated artifacts are current.");
  }
}

await main();

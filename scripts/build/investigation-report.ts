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

const sourceRelativePath = "tools/investigation-report/src/cli.ts";
const declarationSourceRelativePath =
  "tools/investigation-report/api/check-investigations.d.mts";
const outputRelativePath =
  "skills/investigation-report/scripts/check-investigations.mjs";
const declarationOutputRelativePath =
  "skills/investigation-report/scripts/check-investigations.d.mts";

async function buildArtifact(): Promise<BunBundleResult> {
  return await bundleWithBun({
    banner: buildGeneratedFileHeader({
      artifactName: "investigation report structure checker",
      rebuildCommand: "bun run sync:investigation-report-check",
      repository: githubRepository,
      skillSourcePath: "skills/investigation-report",
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
      artifactName: "investigation report checker TypeScript declarations",
      rebuildCommand: "bun run sync:investigation-report-check",
      repository: githubRepository,
      skillSourcePath: "skills/investigation-report",
      sourcePath: declarationSourceRelativePath
    }),
    sourcePath: path.join(rootDir, declarationSourceRelativePath)
  });
  if (expected.sourceMap === null) {
    throw new Error("Investigation report checker bundle must include a source map");
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
    console.log("Investigation report checker generated artifacts are current.");
  }
}

await main();

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

const sourceRelativePath = "scripts/test-evidence/src/cli.ts";
const declarationSourceRelativePath = "scripts/test-evidence/test-evidence.d.mts";
const outputRelativePath = "skills/test-evidence-review/scripts/test-evidence.mjs";
const declarationOutputRelativePath =
  "skills/test-evidence-review/scripts/test-evidence.d.mts";

async function buildArtifact(): Promise<BunBundleResult> {
  return await bundleWithBun({
    banner: buildGeneratedFileHeader({
      artifactName: "test-evidence CLI",
      rebuildCommand: "bun run sync:test-evidence-cli",
      repository: githubRepository,
      skillSourcePath: "skills/test-evidence-review",
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
      artifactName: "test-evidence TypeScript declarations",
      rebuildCommand: "bun run sync:test-evidence-cli",
      repository: githubRepository,
      skillSourcePath: "skills/test-evidence-review",
      sourcePath: declarationSourceRelativePath
    }),
    sourcePath: path.join(rootDir, declarationSourceRelativePath)
  });
  if (expected.sourceMap === null) {
    throw new Error("Test evidence CLI bundle must include a source map");
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
    console.log("Test evidence CLI generated artifacts are current.");
  }
}

await main();

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

const sourceRelativePath = "tools/skill-validator/src/cli.ts";
const declarationSourceRelativePath = "tools/skill-validator/api/validate-skill.d.mts";
const outputRelativePath = "skills/skill-maintainer/scripts/validate-skill.mjs";
const declarationOutputRelativePath =
  "skills/skill-maintainer/scripts/validate-skill.d.mts";

async function buildArtifact(): Promise<BunBundleResult> {
  return await bundleWithBun({
    banner: buildGeneratedFileHeader({
      artifactName: "skill structure validator",
      rebuildCommand: "bun run sync:skill-validator",
      repository: githubRepository,
      skillSourcePath: "skills/skill-maintainer",
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
      artifactName: "skill structure validator TypeScript declarations",
      rebuildCommand: "bun run sync:skill-validator",
      repository: githubRepository,
      skillSourcePath: "skills/skill-maintainer",
      sourcePath: declarationSourceRelativePath
    }),
    sourcePath: path.join(rootDir, declarationSourceRelativePath)
  });
  if (expected.sourceMap === null) {
    throw new Error("Skill structure validator bundle must include a source map");
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
    console.log("Skill structure validator generated artifacts are current.");
  }
}

await main();

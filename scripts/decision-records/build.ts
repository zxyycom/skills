import path from "node:path";
import {
  buildGeneratedFileHeader,
  bundleWithBun,
  parseGeneratedFileMode,
  syncGeneratedArtifacts,
  type BunBundleResult
} from "../lib/generated-file.ts";
import { githubRepository, rootDir } from "../lib/project.ts";

const sourceRelativePath = "scripts/decision-records/src/cli.ts";
const outputRelativePath = "skills/decision-records/scripts/decision-records.mjs";

async function buildArtifact(): Promise<BunBundleResult> {
  return await bundleWithBun({
    banner: buildGeneratedFileHeader({
      artifactName: "decision-records CLI",
      rebuildCommand: "bun run sync:decision-records-cli",
      repository: githubRepository,
      skillSourcePath: "skills/decision-records",
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
  if (expected.sourceMap === null) {
    throw new Error("Decision records CLI bundle must include a source map");
  }

  const changed = await syncGeneratedArtifacts(
    [
      { content: expected.code, path: outputPath },
      { content: expected.sourceMap, path: `${outputPath}.map` }
    ],
    mode,
    rootDir,
    sourceRelativePath
  );

  if (mode === "check" && changed) {
    process.exit(1);
  }

  if (!changed) {
    console.log("Decision records CLI generated artifacts are current.");
  }
}

await main();

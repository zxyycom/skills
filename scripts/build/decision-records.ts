import path from "node:path";
import process from "node:process";
import {
  buildGeneratedFileHeader,
  buildGeneratedTypeScriptDeclarationArtifacts,
  bundleWithBun,
  parseGeneratedFileMode,
  removeStaleGeneratedTypeScriptDeclarations,
  syncGeneratedArtifacts,
  type BunBundleResult
} from "../lib/generated-file.ts";
import { githubRepository, rootDir } from "../lib/project.ts";
import { decisionIndexJsonSchema } from "../../tools/decision-records/src/decision-index-json-schema.ts";

const sourceRelativePath = "tools/decision-records/src/cli.ts";
const outputRelativePath = "skills/decision-records/scripts/decision-records.mjs";
const declarationOutputRelativePath =
  "skills/decision-records/scripts/decision-records.d.mts";
const declarationOutputDirectory = path.join(
  rootDir,
  "skills/decision-records/scripts/decision-records-sdk"
);
const schemaSourceRelativePath =
  "tools/decision-records/src/decision-index-json-schema.ts";
const schemaOutputRelativePath =
  "skills/decision-records/references/decision-index.schema.json";

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
  const declarationArtifacts = await buildGeneratedTypeScriptDeclarationArtifacts({
    declarationArtifactName: "decision records TypeScript declaration",
    declarationEntryOutputPath: path.join(rootDir, declarationOutputRelativePath),
    declarationOutputDirectory,
    entrySourcePath: sourceRelativePath,
    rebuildCommand: "bun run sync:decision-records-cli",
    repository: githubRepository,
    skillSourcePath: "skills/decision-records",
    workspaceRoot: rootDir
  });
  const expectedSchema = `${JSON.stringify(decisionIndexJsonSchema, null, 2)}\n`;
  if (expected.sourceMap === null) {
    throw new Error("Decision records CLI bundle must include a source map");
  }

  const changedArtifacts = await syncGeneratedArtifacts(
    [
      { content: expected.code, path: outputPath },
      { content: expected.sourceMap, path: `${outputPath}.map` },
      ...declarationArtifacts,
      {
        content: expectedSchema,
        path: path.join(rootDir, schemaOutputRelativePath),
        sourcePath: schemaSourceRelativePath
      }
    ],
    mode,
    rootDir,
    sourceRelativePath
  );
  const expectedDeclarationPaths = new Set(
    declarationArtifacts
      .map((artifact) => artifact.path)
      .filter(
        (artifactPath) => path.dirname(artifactPath) === declarationOutputDirectory
      )
  );
  const staleDeclarations = await removeStaleGeneratedTypeScriptDeclarations({
    declarationArtifactName: "decision records TypeScript declaration",
    declarationOutputDirectory,
    expectedPaths: expectedDeclarationPaths,
    mode,
    sourcePath: sourceRelativePath,
    workspaceRoot: rootDir
  });
  const changed = changedArtifacts || staleDeclarations.changed;

  if (staleDeclarations.hasUnsupportedEntries || (mode === "check" && changed)) {
    process.exit(1);
  }

  if (!changed) {
    console.log("Decision records CLI generated artifacts are current.");
  }
}

await main();

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
import { decisionIndexJsonSchema } from "../../tools/decision-records/src/decision-index-json-schema.ts";

const sourceRelativePath = "tools/decision-records/src/cli.ts";
const declarationSourceRelativePath =
  "tools/decision-records/api/decision-records.d.mts";
const outputRelativePath = "skills/decision-records/scripts/decision-records.mjs";
const declarationOutputRelativePath =
  "skills/decision-records/scripts/decision-records.d.mts";
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
  const expectedDeclaration = await buildGeneratedDeclaration({
    banner: buildGeneratedFileHeader({
      artifactName: "decision-records TypeScript declarations",
      rebuildCommand: "bun run sync:decision-records-cli",
      repository: githubRepository,
      skillSourcePath: "skills/decision-records",
      sourcePath: declarationSourceRelativePath
    }),
    sourcePath: path.join(rootDir, declarationSourceRelativePath)
  });
  const expectedSchema = `${JSON.stringify(decisionIndexJsonSchema, null, 2)}\n`;
  if (expected.sourceMap === null) {
    throw new Error("Decision records CLI bundle must include a source map");
  }

  const changed = await syncGeneratedArtifacts(
    [
      { content: expected.code, path: outputPath },
      { content: expected.sourceMap, path: `${outputPath}.map` },
      {
        content: expectedDeclaration,
        path: path.join(rootDir, declarationOutputRelativePath),
        sourcePath: declarationSourceRelativePath
      },
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

  if (mode === "check" && changed) {
    process.exit(1);
  }

  if (!changed) {
    console.log("Decision records CLI generated artifacts are current.");
  }
}

await main();

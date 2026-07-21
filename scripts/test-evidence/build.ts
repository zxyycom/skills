import path from "node:path";
import { toJsonSchema } from "@valibot/to-json-schema";
import { compile } from "json-schema-to-typescript";
import {
  buildGeneratedDeclaration,
  buildGeneratedFileHeader,
  bundleWithBun,
  parseGeneratedFileMode,
  syncGeneratedArtifacts,
  type BunBundleResult,
  type GeneratedArtifact
} from "../lib/generated-file.ts";
import { githubRepository, rootDir } from "../lib/project.ts";
import {
  regexCollectorConfigSchema,
  testEntryInventorySchema,
  testEvidenceInspectionSchema,
  testEvidenceLedgerConfigSchema,
  testEvidenceQueryResultSchema,
  testEvidenceReportSchema
} from "./src/schemas.ts";

const rebuildCommand = "bun run sync:test-evidence-cli";
const skillSourcePath = "skills/test-evidence-review";
const publishedScriptsDirectory = path.join(rootDir, skillSourcePath, "scripts");
const publishedSchemasDirectory = path.join(
  rootDir,
  skillSourcePath,
  "references",
  "schemas"
);

const bundleSpecs = [
  {
    artifactName: "test-entry-regex collector CLI",
    declarationSource: "scripts/test-evidence/test-entry-regex.d.mts",
    entrySource: "scripts/test-evidence/src/regex-cli.ts",
    outputName: "test-entry-regex.mjs"
  },
  {
    artifactName: "test-evidence ledger CLI",
    declarationSource: "scripts/test-evidence/test-evidence-ledger.d.mts",
    entrySource: "scripts/test-evidence/src/ledger-cli.ts",
    outputName: "test-evidence-ledger.mjs"
  }
] as const;

const schemaSpecs = [
  {
    fileName: "test-entry-inventory.schema.json",
    mode: "output" as const,
    schema: testEntryInventorySchema,
    typeName: "TestEntryInventory",
    typesFileName: "test-entry-inventory.types.d.mts"
  },
  {
    fileName: "regex-collector-config.schema.json",
    mode: "input" as const,
    schema: regexCollectorConfigSchema,
    typeName: "RegexCollectorConfig",
    typesFileName: "regex-collector-config.types.d.mts"
  },
  {
    fileName: "test-evidence-ledger-config.schema.json",
    mode: "input" as const,
    schema: testEvidenceLedgerConfigSchema,
    typeName: "TestEvidenceLedgerConfig",
    typesFileName: "test-evidence-ledger-config.types.d.mts"
  },
  {
    fileName: "test-evidence-report.schema.json",
    mode: "output" as const,
    schema: testEvidenceReportSchema,
    typeName: "TestEvidenceReport",
    typesFileName: "test-evidence-report.types.d.mts"
  },
  {
    fileName: "test-evidence-inspection.schema.json",
    mode: "output" as const,
    schema: testEvidenceInspectionSchema,
    typeName: "TestEvidenceInspection",
    typesFileName: "test-evidence-inspection.types.d.mts"
  },
  {
    fileName: "test-evidence-query-result.schema.json",
    mode: "output" as const,
    schema: testEvidenceQueryResultSchema,
    typeName: "TestEvidenceQueryResult",
    typesFileName: "test-evidence-query-result.types.d.mts"
  }
] as const;

async function buildBundle(spec: typeof bundleSpecs[number]): Promise<BunBundleResult> {
  return await bundleWithBun({
    banner: buildGeneratedFileHeader({
      artifactName: spec.artifactName,
      rebuildCommand,
      repository: githubRepository,
      skillSourcePath,
      sourcePath: spec.entrySource
    }),
    cwd: rootDir,
    entryPath: path.join(rootDir, spec.entrySource),
    format: "esm",
    keepNames: true,
    minify: true,
    outputFileName: spec.outputName,
    sourceMapBaseDirectory: publishedScriptsDirectory,
    sourceMap: true
  });
}

async function buildSchemaArtifacts(): Promise<GeneratedArtifact[]> {
  const artifacts: GeneratedArtifact[] = [];
  for (const spec of schemaSpecs) {
    const converted = toJsonSchema(spec.schema, {
      target: "draft-2020-12",
      typeMode: spec.mode
    });
    const schemaPath = path.join(publishedSchemasDirectory, spec.fileName);
    const schema = {
      ...converted,
      $id: `https://raw.githubusercontent.com/${githubRepository}/main/`
        + `${skillSourcePath}/references/schemas/${spec.fileName}`,
      title: spec.typeName
    };
    artifacts.push({
      content: `${JSON.stringify(schema, null, 2)}\n`,
      path: schemaPath,
      sourcePath: "scripts/test-evidence/src/schemas.ts"
    });

    const declaration = await compile(
      schema as Parameters<typeof compile>[0],
      spec.typeName,
      {
        bannerComment: "",
        style: {
          bracketSpacing: true,
          printWidth: 88,
          semi: true,
          singleQuote: false,
          tabWidth: 2,
          trailingComma: "none",
          useTabs: false
        },
        unknownAny: true
      }
    );
    artifacts.push({
      content: `${buildGeneratedFileHeader({
        artifactName: `${spec.typeName} schema-derived TypeScript declarations`,
        rebuildCommand,
        repository: githubRepository,
        skillSourcePath,
        sourcePath: "scripts/test-evidence/src/schemas.ts"
      })}\n${declaration.trim()}\n`,
      path: path.join(publishedScriptsDirectory, spec.typesFileName),
      sourcePath: "scripts/test-evidence/src/schemas.ts"
    });
  }
  return artifacts;
}

async function main(): Promise<void> {
  const mode = parseGeneratedFileMode(process.argv.slice(2));
  const bundles = await Promise.all(bundleSpecs.map(buildBundle));
  const artifacts: GeneratedArtifact[] = [];
  for (const [index, spec] of bundleSpecs.entries()) {
    const bundle = bundles[index];
    if (bundle?.sourceMap === null || bundle === undefined) {
      throw new Error(`${spec.outputName} bundle must include a source map`);
    }
    const outputPath = path.join(publishedScriptsDirectory, spec.outputName);
    artifacts.push(
      { content: bundle.code, path: outputPath, sourcePath: spec.entrySource },
      {
        content: bundle.sourceMap,
        path: `${outputPath}.map`,
        sourcePath: spec.entrySource
      },
      {
        content: await buildGeneratedDeclaration({
          banner: buildGeneratedFileHeader({
            artifactName: `${spec.artifactName} TypeScript declarations`,
            rebuildCommand,
            repository: githubRepository,
            skillSourcePath,
            sourcePath: spec.declarationSource
          }),
          sourcePath: path.join(rootDir, spec.declarationSource)
        }),
        path: path.join(
          publishedScriptsDirectory,
          spec.outputName.replace(/\.mjs$/u, ".d.mts")
        ),
        sourcePath: spec.declarationSource
      }
    );
  }
  artifacts.push(...await buildSchemaArtifacts());

  const changed = await syncGeneratedArtifacts(
    artifacts,
    mode,
    rootDir,
    "scripts/test-evidence/src/schemas.ts"
  );
  if (mode === "check" && changed) {
    process.exit(1);
  }
  if (!changed) {
    console.log("Test evidence generated artifacts are current.");
  }
}

await main();

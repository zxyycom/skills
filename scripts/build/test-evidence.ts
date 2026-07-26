import path from "node:path";
import { toJsonSchema } from "@valibot/to-json-schema";
import { compile } from "json-schema-to-typescript";
import {
  buildGeneratedDeclaration,
  buildGeneratedFileHeader,
  bundleWithBun,
  parseGeneratedFileMode,
  syncGeneratedArtifacts,
  type GeneratedArtifact
} from "../lib/generated-file.ts";
import { githubRepository, rootDir } from "../lib/project.ts";
import {
  testEvidenceCaseShowResultSchema,
  testEvidenceConfigSchema,
  testEvidenceIndexSyncResultSchema,
  testEvidenceQueryResultSchema,
  testEvidenceReportSchema,
  testEvidenceStateIndexSchema
} from "../../tools/test-evidence/src/schemas.ts";

const rebuildCommand = "bun run sync:test-evidence-cli";
const schemaSourcePath = "tools/test-evidence/src/schemas.ts";
const skillSourcePath = "skills/test-evidence-review";
const sourceApiDirectory = path.join(
  rootDir,
  "tools",
  "test-evidence",
  "api"
);
const publishedScriptsDirectory = path.join(rootDir, skillSourcePath, "scripts");
const publishedSchemasDirectory = path.join(
  rootDir,
  skillSourcePath,
  "references",
  "schemas"
);

const bundleSpec = {
  artifactName: "test evidence catalog CLI",
  declarationSource:
    "tools/test-evidence/api/test-evidence-catalog.d.mts",
  entrySource: "tools/test-evidence/src/cli.ts",
  outputName: "test-evidence-catalog.mjs"
} as const;

const schemaSpecs = [
  {
    fileName: "test-evidence-config.schema.json",
    mode: "input" as const,
    schema: testEvidenceConfigSchema,
    typeName: "TestEvidenceConfig",
    typesFileName: "test-evidence-config.types.d.mts"
  },
  {
    fileName: "test-evidence-case-show-result.schema.json",
    mode: "output" as const,
    schema: testEvidenceCaseShowResultSchema,
    typeName: "TestEvidenceCaseShowResult",
    typesFileName: "test-evidence-case-show-result.types.d.mts"
  },
  {
    fileName: "test-evidence-report.schema.json",
    mode: "output" as const,
    schema: testEvidenceReportSchema,
    typeName: "TestEvidenceReport",
    typesFileName: "test-evidence-report.types.d.mts"
  },
  {
    fileName: "test-evidence-index-sync-result.schema.json",
    mode: "output" as const,
    schema: testEvidenceIndexSyncResultSchema,
    typeName: "TestEvidenceIndexSyncResult",
    typesFileName: "test-evidence-index-sync-result.types.d.mts"
  },
  {
    fileName: "test-evidence-state-index.schema.json",
    mode: "output" as const,
    schema: testEvidenceStateIndexSchema,
    typeName: "TestEvidenceStateIndex",
    typesFileName: "test-evidence-state-index.types.d.mts"
  },
  {
    fileName: "test-evidence-query-result.schema.json",
    mode: "output" as const,
    schema: testEvidenceQueryResultSchema,
    typeName: "TestEvidenceQueryResult",
    typesFileName: "test-evidence-query-result.types.d.mts"
  }
] as const;

async function buildBundle(): Promise<GeneratedArtifact[]> {
  const bundle = await bundleWithBun({
    banner: buildGeneratedFileHeader({
      artifactName: bundleSpec.artifactName,
      rebuildCommand,
      repository: githubRepository,
      skillSourcePath,
      sourcePath: bundleSpec.entrySource
    }),
    cwd: rootDir,
    entryPath: path.join(rootDir, bundleSpec.entrySource),
    format: "esm",
    keepNames: true,
    minify: true,
    outputFileName: bundleSpec.outputName,
    sourceMapBaseDirectory: publishedScriptsDirectory,
    sourceMap: true
  });
  if (bundle.sourceMap === null) {
    throw new Error(`${bundleSpec.outputName} bundle must include a source map`);
  }
  const outputPath = path.join(
    publishedScriptsDirectory,
    bundleSpec.outputName
  );
  return [
    {
      content: bundle.code,
      path: outputPath,
      sourcePath: bundleSpec.entrySource
    },
    {
      content: bundle.sourceMap,
      path: `${outputPath}.map`,
      sourcePath: bundleSpec.entrySource
    },
    {
      content: await buildGeneratedDeclaration({
        banner: buildGeneratedFileHeader({
          artifactName: `${bundleSpec.artifactName} TypeScript declarations`,
          rebuildCommand,
          repository: githubRepository,
          skillSourcePath,
          sourcePath: bundleSpec.declarationSource
        }),
        sourcePath: path.join(rootDir, bundleSpec.declarationSource)
      }),
      path: path.join(
        publishedScriptsDirectory,
        bundleSpec.outputName.replace(/\.mjs$/u, ".d.mts")
      ),
      sourcePath: bundleSpec.declarationSource
    }
  ];
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
      sourcePath: schemaSourcePath
    });

    const declarationSchema = spec.typesFileName
      === "test-evidence-state-index.types.d.mts"
      ? withExactEmptyMetadataType(
        schema as Parameters<typeof compile>[0]
      )
      : schema;
    const declaration = await compile(
      declarationSchema as Parameters<typeof compile>[0],
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
    const artifactName =
      `${spec.typeName} schema-derived TypeScript declarations`;
    const declarationBody = `${declaration.trim()}\n`;
    artifacts.push(
      {
        content: `${buildGeneratedFileHeader({
          artifactName,
          rebuildCommand,
          repository: githubRepository,
          sourcePath: schemaSourcePath
        })}\n${declarationBody}`,
        path: path.join(sourceApiDirectory, spec.typesFileName),
        sourcePath: schemaSourcePath
      },
      {
        content: `${buildGeneratedFileHeader({
          artifactName,
          rebuildCommand,
          repository: githubRepository,
          skillSourcePath,
          sourcePath: schemaSourcePath
        })}\n${declarationBody}`,
        path: path.join(publishedScriptsDirectory, spec.typesFileName),
        sourcePath: schemaSourcePath
      }
    );
  }
  return artifacts;
}

function withExactEmptyMetadataType(
  schema: Parameters<typeof compile>[0]
): Parameters<typeof compile>[0] {
  const properties = schema.properties;
  if (
    properties === undefined
    || Array.isArray(properties)
    || typeof properties !== "object"
    || properties === null
  ) {
    throw new TypeError(
      "TestEvidenceStateIndex schema must define properties"
    );
  }
  const metadata = properties.metadata;
  if (
    metadata === undefined
    || typeof metadata !== "object"
    || metadata === null
    || Array.isArray(metadata)
  ) {
    throw new TypeError(
      "TestEvidenceStateIndex schema must define object metadata"
    );
  }
  return {
    ...schema,
    properties: {
      ...properties,
      metadata: {
        ...metadata,
        tsType: "Record<string, never>"
      }
    }
  };
}

async function main(): Promise<void> {
  const mode = parseGeneratedFileMode(process.argv.slice(2));
  const artifacts = [
    ...await buildBundle(),
    ...await buildSchemaArtifacts()
  ];
  const changed = await syncGeneratedArtifacts(
    artifacts,
    mode,
    rootDir,
    schemaSourcePath
  );
  if (mode === "check" && changed) {
    process.exit(1);
  }
  if (!changed) {
    console.log("Test evidence generated artifacts are current.");
  }
}

await main();

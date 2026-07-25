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
  verificationCaseShowResultSchema,
  verificationEvidenceConfigSchema,
  verificationEvidenceIndexSyncResultSchema,
  verificationEvidenceQueryResultSchema,
  verificationEvidenceReportSchema,
  verificationEvidenceStateIndexSchema
} from "../../tools/verification-evidence/src/schemas.ts";

const rebuildCommand = "bun run sync:verification-evidence-cli";
const schemaSourcePath = "tools/verification-evidence/src/schemas.ts";
const skillSourcePath = "skills/verification-implementation-review";
const sourceApiDirectory = path.join(
  rootDir,
  "tools",
  "verification-evidence",
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
  artifactName: "verification catalog CLI",
  declarationSource:
    "tools/verification-evidence/api/verification-catalog.d.mts",
  entrySource: "tools/verification-evidence/src/cli.ts",
  outputName: "verification-catalog.mjs"
} as const;

const schemaSpecs = [
  {
    fileName: "verification-evidence-config.schema.json",
    mode: "input" as const,
    schema: verificationEvidenceConfigSchema,
    typeName: "VerificationEvidenceConfig",
    typesFileName: "verification-evidence-config.types.d.mts"
  },
  {
    fileName: "verification-case-show-result.schema.json",
    mode: "output" as const,
    schema: verificationCaseShowResultSchema,
    typeName: "VerificationCaseShowResult",
    typesFileName: "verification-case-show-result.types.d.mts"
  },
  {
    fileName: "verification-evidence-report.schema.json",
    mode: "output" as const,
    schema: verificationEvidenceReportSchema,
    typeName: "VerificationEvidenceReport",
    typesFileName: "verification-evidence-report.types.d.mts"
  },
  {
    fileName: "verification-evidence-index-sync-result.schema.json",
    mode: "output" as const,
    schema: verificationEvidenceIndexSyncResultSchema,
    typeName: "VerificationEvidenceIndexSyncResult",
    typesFileName: "verification-evidence-index-sync-result.types.d.mts"
  },
  {
    fileName: "verification-evidence-state-index.schema.json",
    mode: "output" as const,
    schema: verificationEvidenceStateIndexSchema,
    typeName: "VerificationEvidenceStateIndex",
    typesFileName: "verification-evidence-state-index.types.d.mts"
  },
  {
    fileName: "verification-evidence-query-result.schema.json",
    mode: "output" as const,
    schema: verificationEvidenceQueryResultSchema,
    typeName: "VerificationEvidenceQueryResult",
    typesFileName: "verification-evidence-query-result.types.d.mts"
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
      === "verification-evidence-state-index.types.d.mts"
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
      "VerificationEvidenceStateIndex schema must define properties"
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
      "VerificationEvidenceStateIndex schema must define object metadata"
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
    console.log("Verification evidence generated artifacts are current.");
  }
}

await main();

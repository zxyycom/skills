import { nativeCliEntry } from "../lib/native-cli-entry.ts";
import {
  buildSkillRuntimeArtifacts,
  syncSkillRuntimeArtifacts,
  runRuntimeAdapter
} from "../lib/skill-runtime.ts";
import type { GeneratedFileMode } from "../lib/generated-file.ts";
import path from "node:path";
import { toJsonSchema } from "@valibot/to-json-schema";
import { compile } from "json-schema-to-typescript";
import {
  buildGeneratedDeclaration,
  buildGeneratedFileHeader,
  type GeneratedArtifact
} from "../lib/generated-file.ts";
import { githubRepository, rootDir } from "../lib/project.ts";
import {
  snapshotSchema,
  testEvidenceQueryResultSchema,
  testEvidenceReferenceResultSchema,
  testEvidenceReportSchema,
  testEvidenceSearchResultSchema,
  testEvidenceShowResultSchema,
  testEvidenceStageResultSchema,
  testEvidenceStateIndexSchema,
  testEvidenceSyncResultSchema,
  testEvidenceTagsResultSchema
} from "../../tools/test-evidence/src/core-schemas.ts";

const rebuildCommand = "bun run sync:test-evidence-cli";
const schemaSourcePath = "tools/test-evidence/src/core-schemas.ts";
const skillSourcePath = "skills/test-evidence-review";
const sourceApiDirectory = path.join(rootDir, "tools", "test-evidence", "api");
const publishedScriptsDirectory = path.join(
  rootDir,
  skillSourcePath,
  "scripts"
);
const publishedSchemasDirectory = path.join(
  rootDir,
  skillSourcePath,
  "references",
  "schemas"
);

const runtimeSpec = {
  artifactName: "test evidence catalog CLI",
  declarationSource: "tools/test-evidence/api/test-evidence-catalog.d.mts",
  entrySource: "tools/test-evidence/src/cli.ts",
  outputName: "test-evidence-catalog.ts"
} as const;

const schemaSpecs = [
  {
    fileName: "test-evidence-entity-snapshot.schema.json",
    mode: "input" as const,
    schema: snapshotSchema,
    typeName: "TestEvidenceEntitySnapshot",
    typesFileName: "test-evidence-entity-snapshot.types.d.mts"
  },
  {
    fileName: "test-evidence-reference-result.schema.json",
    mode: "output" as const,
    schema: testEvidenceReferenceResultSchema,
    typeName: "TestEvidenceReferenceResult",
    typesFileName: "test-evidence-reference-result.types.d.mts"
  },
  {
    fileName: "test-evidence-report.schema.json",
    mode: "output" as const,
    schema: testEvidenceReportSchema,
    typeName: "TestEvidenceReport",
    typesFileName: "test-evidence-report.types.d.mts"
  },
  {
    fileName: "test-evidence-query-result.schema.json",
    mode: "output" as const,
    schema: testEvidenceQueryResultSchema,
    typeName: "TestEvidenceQueryResult",
    typesFileName: "test-evidence-query-result.types.d.mts"
  },
  {
    fileName: "test-evidence-tags-result.schema.json",
    mode: "output" as const,
    schema: testEvidenceTagsResultSchema,
    typeName: "TestEvidenceTagsResult",
    typesFileName: "test-evidence-tags-result.types.d.mts"
  },
  {
    fileName: "test-evidence-show-result.schema.json",
    mode: "output" as const,
    schema: testEvidenceShowResultSchema,
    typeName: "TestEvidenceShowResult",
    typesFileName: "test-evidence-show-result.types.d.mts"
  },
  {
    fileName: "test-evidence-search-result.schema.json",
    mode: "output" as const,
    schema: testEvidenceSearchResultSchema,
    typeName: "TestEvidenceSearchResult",
    typesFileName: "test-evidence-search-result.types.d.mts"
  },
  {
    fileName: "test-evidence-sync-result.schema.json",
    mode: "output" as const,
    schema: testEvidenceSyncResultSchema,
    typeName: "TestEvidenceSyncResult",
    typesFileName: "test-evidence-sync-result.types.d.mts"
  },
  {
    fileName: "test-evidence-stage-result.schema.json",
    mode: "output" as const,
    schema: testEvidenceStageResultSchema,
    typeName: "TestEvidenceStageResult",
    typesFileName: "test-evidence-stage-result.types.d.mts"
  },
  {
    fileName: "test-evidence-state-index.schema.json",
    mode: "output" as const,
    schema: testEvidenceStateIndexSchema,
    typeName: "TestEvidenceStateIndex",
    typesFileName: "test-evidence-state-index.types.d.mts"
  }
] as const;

async function buildRuntimeArtifacts(): Promise<GeneratedArtifact[]> {
  const runtime = await buildSkillRuntimeArtifacts({
    skillName: "test-evidence-review",
    rebuildCommand,
    nodeEngine: ">=24.18",
    entries: [
      await nativeCliEntry({
        sourcePath: runtimeSpec.entrySource,
        outputName: runtimeSpec.outputName,
        runner: "runTestEvidenceCatalogCli",
        declarationName: "test-evidence-catalog.d.mts",
        typedExports: [
          "runTestEvidenceCatalogCli",
          "listTestEvidenceTags",
          "queryTestEvidence",
          "searchTestEvidence",
          "showTestEvidenceCase",
          "stageTestEvidenceIndex",
          "syncTestEvidenceIndex",
          "validateTestEvidence",
          "validateTestEvidenceReferences"
        ]
      })
    ]
  });
  return [
    ...runtime,
    {
      content: await buildGeneratedDeclaration({
        banner: buildGeneratedFileHeader({
          artifactName: `${runtimeSpec.artifactName} TypeScript declarations`,
          rebuildCommand,
          repository: githubRepository,
          skillSourcePath,
          sourcePath: runtimeSpec.declarationSource
        }),
        sourcePath: path.join(rootDir, runtimeSpec.declarationSource)
      }),
      path: path.join(
        publishedScriptsDirectory,
        runtimeSpec.outputName.replace(/\.ts$/u, ".d.mts")
      ),
      sourcePath: runtimeSpec.declarationSource
    }
  ];
}

async function buildSchemaArtifacts(): Promise<GeneratedArtifact[]> {
  const artifacts: GeneratedArtifact[] = [];
  for (const spec of schemaSpecs) {
    const converted = toJsonSchema(spec.schema, {
      errorMode: "ignore",
      target: "draft-2020-12",
      typeMode: spec.mode
    });
    const schemaPath = path.join(publishedSchemasDirectory, spec.fileName);
    const schema = {
      ...converted,
      $id:
        `https://raw.githubusercontent.com/${githubRepository}/main/` +
        `${skillSourcePath}/references/schemas/${spec.fileName}`,
      title: spec.typeName
    };
    artifacts.push({
      content: `${JSON.stringify(schema, null, 2)}\n`,
      path: schemaPath,
      sourcePath: schemaSourcePath
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
    const artifactName = `${spec.typeName} schema-derived TypeScript declarations`;
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

export async function syncRuntime(mode: GeneratedFileMode): Promise<boolean> {
  const artifacts = [
    ...(await buildRuntimeArtifacts()),
    ...(await buildSchemaArtifacts())
  ];
  return await syncSkillRuntimeArtifacts(artifacts, {
    mode,
    skillName: "test-evidence-review",
    retiredPaths: [
      "scripts/test-evidence-catalog.mjs",
      "scripts/test-evidence-catalog.mjs.map"
    ]
  });
}
await runRuntimeAdapter(import.meta.url, syncRuntime);

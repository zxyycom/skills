import type { SourceRuntimeFacts } from "../lib/generation/runtime/source-runtime.ts";
import path from "node:path";
import {
  buildGeneratedDeclaration,
  buildGeneratedFileHeader,
  type GeneratedFileMode
} from "../lib/generation/generated-file.ts";
import { nativeCliEntry } from "../lib/generation/native-cli-entry.ts";
import {
  buildSkillRuntimeArtifacts,
  syncSkillRuntimeArtifacts,
  runRuntimeAdapter
} from "../lib/generation/runtime/skill-runtime.ts";
import { githubRepository, rootDir } from "../lib/project.ts";
import { investigationIndexJsonSchema } from "../../tools/investigation-report/src/index/investigation-index-json-schema.ts";

const skillName = "investigation-report";
const sourcePath = "tools/investigation-report/src/cli.ts";
const declarationSource =
  "tools/investigation-report/api/check-investigations.d.mts";
const rebuildCommand = "bun run sync:investigation-report-check";
export async function syncRuntime(
  mode: GeneratedFileMode,
  facts?: SourceRuntimeFacts
): Promise<boolean> {
  const entry = await nativeCliEntry({
    sourcePath,
    outputName: "check-investigations.ts",
    runner: "runInvestigationReportCheckCli",
    declarationName: "check-investigations.d.mts",
    typedExports: [
      "createInvestigationCandidate",
      "discardInvestigationRecord",
      "listInvestigationCandidates",
      "publishInvestigationCandidates",
      "queryInvestigationIndex",
      "renameInvestigationRecord",
      "runInvestigationReportCheckCli",
      "searchInvestigationReports",
      "setInvestigationRelations",
      "showInvestigationCandidate",
      "showInvestigationReport",
      "stageInvestigationReports",
      "synchronizeInvestigationIndex",
      "traceInvestigationReports",
      "validateInvestigationReports"
    ]
  });
  const artifacts = await buildSkillRuntimeArtifacts(
    {
      skillName,
      rebuildCommand,
      nodeEngine: ">=24.18",
      entries: [entry]
    },
    facts
  );
  artifacts.push(
    {
      content: await buildGeneratedDeclaration({
        banner: buildGeneratedFileHeader({
          artifactName: "investigation report checker TypeScript declarations",
          rebuildCommand,
          repository: githubRepository,
          skillSourcePath: `skills/${skillName}`,
          sourcePath: declarationSource
        }),
        sourcePath: path.join(rootDir, declarationSource)
      }),
      path: path.join(
        rootDir,
        "skills/investigation-report/scripts/check-investigations.d.mts"
      ),
      sourcePath: declarationSource
    },
    {
      content: `${JSON.stringify(investigationIndexJsonSchema, null, 2)}\n`,
      path: path.join(
        rootDir,
        "skills/investigation-report/references/investigation-index.schema.json"
      ),
      sourcePath:
        "tools/investigation-report/src/index/investigation-index-json-schema.ts"
    }
  );
  return await syncSkillRuntimeArtifacts(artifacts, {
    mode,
    skillName,
    retiredPaths: [
      "scripts/check-investigations.mjs",
      "scripts/check-investigations.mjs.map"
    ]
  });
}
await runRuntimeAdapter(import.meta.url, syncRuntime);

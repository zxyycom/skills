import type { SourceRuntimeFacts } from "../lib/generation/runtime/source-runtime.ts";
import path from "node:path";
import {
  buildGeneratedTypeScriptDeclarationArtifacts,
  removeStaleGeneratedTypeScriptDeclarations,
  type GeneratedFileMode
} from "../lib/generation/generated-file.ts";
import { nativeCliEntry } from "../lib/generation/native-cli-entry.ts";
import {
  buildSkillRuntimeArtifacts,
  syncSkillRuntimeArtifacts,
  runRuntimeAdapter
} from "../lib/generation/runtime/skill-runtime.ts";
import { githubRepository, rootDir } from "../lib/project.ts";
import { decisionIndexJsonSchema } from "../../tools/decision-records/src/index/decision-index-json-schema.ts";

const skillName = "decision-records";
const sourcePath = "tools/decision-records/src/cli.ts";
const rebuildCommand = "bun run sync:decision-records-cli";
const declarationOutputDirectory = path.join(
  rootDir,
  "skills/decision-records/scripts/decision-records-sdk"
);
export async function syncRuntime(
  mode: GeneratedFileMode,
  facts?: SourceRuntimeFacts
): Promise<boolean> {
  const declarations = await buildGeneratedTypeScriptDeclarationArtifacts({
    declarationArtifactName: "decision records TypeScript declaration",
    declarationEntryOutputPath: path.join(
      rootDir,
      "skills/decision-records/scripts/decision-records.d.mts"
    ),
    declarationOutputDirectory,
    entrySourcePath: sourcePath,
    rebuildCommand,
    repository: githubRepository,
    skillSourcePath: `skills/${skillName}`,
    workspaceRoot: rootDir
  });
  const artifacts = await buildSkillRuntimeArtifacts(
    {
      skillName,
      rebuildCommand,
      nodeEngine: ">=24.18",
      entries: [
        await nativeCliEntry({
          sourcePath,
          outputName: "decision-records.ts",
          runner: "runDecisionRecordsCli",
          declarationName: "decision-records.d.mts",
          typedExports: [
            "renameDecisionRecord",
            "runDecisionRecordsCli",
            "scanDecisionRecords",
            "validateDecisionRecords"
          ]
        })
      ]
    },
    facts
  );
  artifacts.push(...declarations, {
    content: `${JSON.stringify(decisionIndexJsonSchema, null, 2)}\n`,
    path: path.join(
      rootDir,
      "skills/decision-records/references/decision-index.schema.json"
    ),
    sourcePath: "tools/decision-records/src/index/decision-index-json-schema.ts"
  });
  const changed = await syncSkillRuntimeArtifacts(artifacts, {
    mode,
    skillName,
    retiredPaths: [
      "scripts/decision-records.mjs",
      "scripts/decision-records.mjs.map"
    ]
  });
  const stale = await removeStaleGeneratedTypeScriptDeclarations({
    declarationArtifactName: "decision records TypeScript declaration",
    declarationOutputDirectory,
    expectedPaths: new Set(declarations.map((a) => a.path)),
    mode,
    sourcePath,
    workspaceRoot: rootDir
  });
  if (stale.hasUnsupportedEntries)
    throw new Error(
      "Unsupported declaration entries require manual relocation"
    );
  return changed || stale.changed;
}
await runRuntimeAdapter(import.meta.url, syncRuntime);

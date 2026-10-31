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
const sourceRelativePath = "tools/skill-validator/src/cli.ts";
const declarationSourceRelativePath =
  "tools/skill-validator/api/validate-skill.d.mts";
const declarationOutputRelativePath =
  "skills/skill-maintainer/scripts/validate-skill.d.mts";
export async function syncRuntime(
  mode: GeneratedFileMode,
  facts?: SourceRuntimeFacts
): Promise<boolean> {
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
  const artifacts = await buildSkillRuntimeArtifacts(
    {
      skillName: "skill-maintainer",
      rebuildCommand: "bun run sync:skill-validator",
      nodeEngine: ">=24.18",
      entries: [
        await nativeCliEntry({
          sourcePath: sourceRelativePath,
          outputName: "validate-skill.ts",
          runner: "runSkillValidatorCli",
          declarationName: "validate-skill.d.mts",
          typedExports: ["runSkillValidatorCli", "validateSkillDirectory"]
        })
      ]
    },
    facts
  );
  artifacts.push({
    content: expectedDeclaration,
    path: path.join(rootDir, declarationOutputRelativePath),
    sourcePath: declarationSourceRelativePath
  });
  return await syncSkillRuntimeArtifacts(artifacts, {
    mode,
    skillName: "skill-maintainer",
    retiredPaths: [
      "scripts/validate-skill.mjs",
      "scripts/validate-skill.mjs.map"
    ]
  });
}
await runRuntimeAdapter(import.meta.url, syncRuntime);

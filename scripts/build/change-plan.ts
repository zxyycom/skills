import type { SourceRuntimeFacts } from "../lib/source-runtime.ts";
import type { GeneratedFileMode } from "../lib/generated-file.ts";
import { nativeCliEntry } from "../lib/native-cli-entry.ts";
import {
  buildSkillRuntimeArtifacts,
  syncSkillRuntimeArtifacts,
  runRuntimeAdapter
} from "../lib/skill-runtime.ts";
export async function syncRuntime(
  mode: GeneratedFileMode,
  facts?: SourceRuntimeFacts
): Promise<boolean> {
  const artifacts = await buildSkillRuntimeArtifacts(
    {
      skillName: "change-plan",
      rebuildCommand: "bun run sync:change-plan-cli",
      nodeEngine: ">=24.18",
      entries: [
        await nativeCliEntry({
          sourcePath: "tools/change-plan/src/cli.ts",
          outputName: "change-plan.ts",
          runner: "runChangePlanCli"
        })
      ]
    },
    facts
  );
  return await syncSkillRuntimeArtifacts(artifacts, {
    mode,
    skillName: "change-plan",
    retiredPaths: ["scripts/change-plan.mjs", "scripts/change-plan.mjs.map"]
  });
}
await runRuntimeAdapter(import.meta.url, syncRuntime);

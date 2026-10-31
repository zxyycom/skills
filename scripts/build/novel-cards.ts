import type { SourceRuntimeFacts } from "../lib/generation/runtime/source-runtime.ts";
import { nativeCliEntry } from "../lib/generation/native-cli-entry.ts";
import {
  buildSkillRuntimeArtifacts,
  syncSkillRuntimeArtifacts,
  runRuntimeAdapter
} from "../lib/generation/runtime/skill-runtime.ts";
import type { GeneratedFileMode } from "../lib/generation/generated-file.ts";
export async function syncRuntime(
  mode: GeneratedFileMode,
  facts?: SourceRuntimeFacts
): Promise<boolean> {
  const artifacts = await buildSkillRuntimeArtifacts(
    {
      skillName: "novel-cards",
      rebuildCommand: "bun run sync:novel-cards-cli",
      nodeEngine: ">=24.18",
      entries: [
        await nativeCliEntry({
          sourcePath: "tools/novel-cards/src/cli.ts",
          outputName: "novel-cards.ts",
          runner: "runCli",
          invocation:
            "process.exitCode = await runtime.runCli(process.argv.slice(2));"
        })
      ]
    },
    facts
  );
  return await syncSkillRuntimeArtifacts(artifacts, {
    mode,
    skillName: "novel-cards",
    retiredPaths: ["scripts/novel-cards.mjs", "scripts/novel-cards.mjs.map"]
  });
}
await runRuntimeAdapter(import.meta.url, syncRuntime);

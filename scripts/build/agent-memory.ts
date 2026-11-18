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
      skillName: "agent-memory",
      rebuildCommand: "bun run sync:agent-memory-cli",
      nodeEngine: ">=24.18",
      resources: ["schema.sql", "queries.sql"].map((name) => ({
        sourcePath: `tools/agent-memory/src/${name}`,
        outputPath: `scripts/runtime/tools/agent-memory/src/${name}`
      })),
      entries: [
        await nativeCliEntry({
          sourcePath: "tools/agent-memory/src/cli.ts",
          outputName: "agent-memory.ts",
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
    skillName: "agent-memory",
    retiredPaths: []
  });
}
await runRuntimeAdapter(import.meta.url, syncRuntime);

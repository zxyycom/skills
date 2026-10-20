import { nativeCliEntry } from "../lib/native-cli-entry.ts";
import {
  buildSkillRuntimeArtifacts,
  syncSkillRuntimeArtifacts,
  runRuntimeAdapter
} from "../lib/skill-runtime.ts";
import type { GeneratedFileMode } from "../lib/generated-file.ts";
export async function syncRuntime(mode: GeneratedFileMode): Promise<boolean> {
  const artifacts = await buildSkillRuntimeArtifacts({
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
  });
  return await syncSkillRuntimeArtifacts(artifacts, {
    mode,
    skillName: "novel-cards",
    retiredPaths: ["scripts/novel-cards.mjs", "scripts/novel-cards.mjs.map"]
  });
}
await runRuntimeAdapter(import.meta.url, syncRuntime);

import type { SourceRuntimeFacts } from "../lib/generation/runtime/source-runtime.ts";
import type { GeneratedFileMode } from "../lib/generation/generated-file.ts";
import { syncNativeSkillRuntime } from "../lib/generation/runtime/native-skill-runtime.ts";
import { runRuntimeAdapter } from "../lib/generation/runtime/skill-runtime.ts";

export async function syncRuntime(
  mode: GeneratedFileMode,
  facts?: SourceRuntimeFacts
): Promise<boolean> {
  return await syncNativeSkillRuntime("decision-records", mode, facts);
}
await runRuntimeAdapter(import.meta.url, syncRuntime);

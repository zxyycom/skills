import { isMainModule } from "../../tools/shared/src/node/main-module.ts";
import {
  buildSkillUpdaterEntry,
  updaterRetiredPaths
} from "../build/skill-updaters.ts";
import { discoverSkillPackages } from "./project.ts";
import { discoverSelectedSkillPackages } from "./skill-runtime-selection.ts";
import {
  buildSourceRuntimeArtifacts,
  captureSourceRuntimeFacts,
  syncSourceRuntimeArtifacts,
  type SourceRuntimeFacts,
  type SourceRuntimeOptions
} from "./source-runtime.ts";
import {
  parseGeneratedFileMode,
  type GeneratedArtifact,
  type GeneratedFileMode
} from "./generated-file.ts";

export async function buildSkillRuntimeArtifacts(
  options: SourceRuntimeOptions,
  facts?: SourceRuntimeFacts
): Promise<GeneratedArtifact[]> {
  return await buildSourceRuntimeArtifacts(
    {
      ...options,
      entries: [...options.entries, buildSkillUpdaterEntry(options.skillName)]
    },
    facts
  );
}

export async function syncSkillRuntimeArtifacts(
  artifacts: readonly GeneratedArtifact[],
  options: Readonly<{
    mode: GeneratedFileMode;
    skillName: string;
    retiredPaths: readonly string[];
  }>
): Promise<boolean> {
  return await syncSourceRuntimeArtifacts(artifacts, {
    ...options,
    retiredPaths: [...options.retiredPaths, ...updaterRetiredPaths]
  });
}

const domainAdapters: Readonly<Record<string, string>> = {
  "video-understanding": "video-understanding",
  "change-plan": "change-plan",
  "decision-records": "decision-records",
  "investigation-report": "investigation-report",
  "test-evidence-review": "test-evidence",
  "task-graph": "task-graph",
  "skill-maintainer": "skill-validator",
  "lightweight-judgment": "lightweight-judgment",
  "novel-cards": "novel-cards",
  "mcpshell-workspace-tools": "mcpshell-workspace-bridge"
};

type DomainAdapter = Readonly<{
  syncRuntime(
    mode: GeneratedFileMode,
    facts?: SourceRuntimeFacts
  ): Promise<boolean>;
}>;
function isDomainAdapter(value: unknown): value is DomainAdapter {
  return (
    typeof value === "object" &&
    value !== null &&
    "syncRuntime" in value &&
    typeof value.syncRuntime === "function"
  );
}

/** Check selections still rebuild each selected skill's complete runtime. */
export async function syncAllSkillRuntimes(
  mode: GeneratedFileMode,
  skillNames?: readonly string[]
): Promise<boolean> {
  if (skillNames !== undefined && mode !== "check")
    throw new Error("Selected skill runtimes are only supported in check mode");
  const discovery =
    skillNames === undefined
      ? await discoverSkillPackages()
      : { skills: await discoverSelectedSkillPackages(skillNames), errors: [] };
  if (discovery.errors.length > 0) throw new Error(discovery.errors.join("\n"));
  const facts =
    skillNames === undefined ? await captureSourceRuntimeFacts() : undefined;
  let changed = false;
  for (const skill of discovery.skills) {
    const adapterName = domainAdapters[skill.name];
    if (adapterName !== undefined) {
      const adapter: unknown = await import(`../build/${adapterName}.ts`);
      if (!isDomainAdapter(adapter))
        throw new Error(`Invalid domain runtime adapter: ${adapterName}`);
      changed = (await adapter.syncRuntime(mode, facts)) || changed;
      continue;
    }
    const options = {
      skillName: skill.name,
      entries: [],
      nodeEngine: ">=24.18",
      rebuildCommand: "bun run sync:skill-updaters"
    };
    const artifacts = await buildSkillRuntimeArtifacts(options, facts);
    changed =
      (await syncSkillRuntimeArtifacts(artifacts, {
        mode,
        skillName: skill.name,
        retiredPaths: []
      })) || changed;
  }
  return changed;
}

export async function runRuntimeAdapter(
  moduleUrl: string,
  sync: (mode: GeneratedFileMode) => Promise<boolean>
): Promise<void> {
  if (!isMainModule(moduleUrl)) return;
  const mode = parseGeneratedFileMode(process.argv.slice(2));
  if ((await sync(mode)) && mode === "check") process.exitCode = 1;
}

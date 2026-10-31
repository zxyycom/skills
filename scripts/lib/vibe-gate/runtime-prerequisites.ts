import {
  packageScriptDependencies,
  packageScriptGenerationSkillNames,
  packageScriptToolSubscriptions,
  releaseRequiredPackageScripts
} from "./checks/package-script.ts";
import {
  semanticGateChecks,
  type SemanticGateCheck
} from "./checks/semantic.ts";
import type { GateToolId } from "./impact/impact-tools.ts";

/** Undefined selects the complete provider; an empty set has no consumer. */
export function resolveSelectedRuntimeSkills(
  toolIds: readonly GateToolId[]
): readonly string[] | undefined {
  const selectedTools = new Set(toolIds);
  if (selectedTools.has("generated-artifacts")) return undefined;
  const skills = new Set<string>();
  const addConsumer = (
    checkId: string,
    subscriptions: readonly GateToolId[],
    dependencies: readonly string[] = [],
    generationSkillNames?: readonly string[]
  ): void => {
    if (
      !subscriptions.some((toolId) => selectedTools.has(toolId)) ||
      !dependencies.includes("script:check:skill-updaters")
    )
      return;
    if (generationSkillNames === undefined || generationSkillNames.length === 0)
      throw new Error(
        `Generation prerequisite skills are not declared: ${checkId}`
      );
    for (const skillName of generationSkillNames) skills.add(skillName);
  };
  const semanticConsumers: readonly SemanticGateCheck[] = semanticGateChecks;
  for (const check of semanticConsumers)
    addConsumer(
      check.checkId,
      check.toolIds,
      check.dependsOn,
      check.generationSkillNames
    );
  for (const script of releaseRequiredPackageScripts)
    addConsumer(
      `script:${script}`,
      packageScriptToolSubscriptions[script],
      packageScriptDependencies[script],
      packageScriptGenerationSkillNames[script]
    );
  return [...skills].sort();
}

import { all, any } from "@zxyycom/vibe-check";
import type {
  CheckFlagCondition,
  CheckFlagEnablement
} from "@zxyycom/vibe-check";
import {
  isQuickGateCheck,
  outsideQuickScopeFlag,
  type GateScope
} from "./profiles.ts";
import {
  activationFlagForTool,
  type GateToolId,
  type GateToolSubscription
} from "./impact-tools.ts";

export const gateTags = ["release"] as const;
export type GateTag = (typeof gateTags)[number];
export type GateTagSet = readonly GateTag[];
export const gateEnvironmentCheckId = "gate-environment";

export function normalizeGateTags(
  tags: readonly GateTag[]
): readonly GateTag[] {
  return [...new Set(tags)].sort();
}
export function hasGateTag(tags: GateTagSet, tag: GateTag): boolean {
  return tags.includes(tag);
}
export const gateResourceCapacities = {
  "external-process": 3,
  "repository-scan": 2
} as const;
export const releaseGateResourceCapacities = {
  "cpu-work": 4,
  ...gateResourceCapacities
} as const;
export const externalProcessClaim = { "external-process": 1 } as const;
export const repositoryScanClaim = { "repository-scan": 1 } as const;
export const repositoryProcessClaims = {
  ...externalProcessClaim,
  ...repositoryScanClaim
} as const;

export type GateCheckConfiguration = Readonly<{
  environmentPrerequisite?: boolean;
  incremental?: boolean;
  scope?: GateScope;
  selectionScopes?: readonly GateToolId[];
  generationSkillNames?: readonly string[];
  release?: boolean;
}>;

// 构造项目声明，而不是复制 Check；typed provider 的原对象身份由构造器保留。
export function gateCheckDeclaration(
  checkId: string,
  configuration: GateCheckConfiguration,
  resourceClaims: Readonly<Record<string, number>> = {},
  dependsOn: readonly string[] = [],
  condition?: CheckFlagCondition
) {
  const dependencies =
    configuration.environmentPrerequisite && checkId !== gateEnvironmentCheckId
      ? [
          gateEnvironmentCheckId,
          ...dependsOn.filter((id) => id !== gateEnvironmentCheckId)
        ]
      : dependsOn;
  const scopeCondition =
    (configuration.scope === "quick" || configuration.scope === "selected") &&
    isQuickGateCheck(checkId)
      ? undefined
      : configuration.scope === "quick"
        ? condition === undefined
          ? outsideQuickScopeFlag
          : all(outsideQuickScopeFlag, condition)
        : condition;
  const enabledByFlags: CheckFlagEnablement | undefined =
    scopeCondition === undefined
      ? undefined
      : { when: scopeCondition, propagateDependsOn: true };
  return {
    ...(dependencies.length === 0 ? {} : { dependsOn: dependencies }),
    ...(enabledByFlags === undefined ? {} : { enabledByFlags }),
    resourceClaims: configuration.release
      ? {
          ...resourceClaims,
          "cpu-work": checkId === "script:test:version-control" ? 4 : 1
        }
      : resourceClaims
  };
}

export function projectActivationCondition(
  toolIds: GateToolSubscription,
  configuration: GateCheckConfiguration
): CheckFlagCondition | undefined {
  return configuration.incremental || configuration.scope === "selected"
    ? any(
        activationFlagForTool(toolIds[0]),
        ...toolIds.slice(1).map(activationFlagForTool)
      )
    : undefined;
}

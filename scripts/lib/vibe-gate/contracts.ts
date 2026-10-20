import type { CheckFlagEnablement } from "@zxyycom/vibe-check";

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
  release?: boolean;
}>;

// 构造项目声明，而不是复制 Check；typed provider 的原对象身份由构造器保留。
export function gateCheckDeclaration(
  checkId: string,
  configuration: GateCheckConfiguration,
  resourceClaims: Readonly<Record<string, number>> = {},
  dependsOn: readonly string[] = [],
  flag?: string
) {
  const dependencies =
    configuration.environmentPrerequisite && checkId !== gateEnvironmentCheckId
      ? [
          gateEnvironmentCheckId,
          ...dependsOn.filter((id) => id !== gateEnvironmentCheckId)
        ]
      : dependsOn;
  const enabledByFlags: CheckFlagEnablement | undefined =
    flag === undefined ? undefined : { when: flag, propagateDependsOn: true };
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

export function projectActivationFlag(
  checkId: string,
  configuration: GateCheckConfiguration
): string | undefined {
  return configuration.incremental ? `gate-activation:${checkId}` : undefined;
}

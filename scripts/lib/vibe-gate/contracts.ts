export const gateTags = ["release"] as const;

export type GateTag = (typeof gateTags)[number];

export type GateTagSet = readonly GateTag[];

export function normalizeGateTags(
  tags: readonly GateTag[]
): readonly GateTag[] {
  return [...new Set(tags)].sort();
}

export function hasGateTag(tags: GateTagSet, tag: GateTag): boolean {
  return tags.includes(tag);
}

export const gateResourceCapacities = {
  "external-process": 2,
  "repository-scan": 2
} as const;

export const externalProcessClaim = { "external-process": 1 } as const;
export const repositoryScanClaim = { "repository-scan": 1 } as const;
export const repositoryProcessClaims = {
  "external-process": 1,
  "repository-scan": 1
} as const;

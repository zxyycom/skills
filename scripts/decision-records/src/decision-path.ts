const decisionFileNamePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*\.md$/;
const decisionTopicIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const decisionRelativePathPattern =
  /^[a-z0-9]+(?:-[a-z0-9]+)*\/[a-z0-9]+(?:-[a-z0-9]+)*\.md$/;
const legacyDecisionFileNamePattern =
  /^(\d{6})-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/;

export function isDecisionRelativePath(value: string): boolean {
  return decisionRelativePathPattern.test(value);
}

export function isDecisionFileName(value: string): boolean {
  return decisionFileNamePattern.test(value);
}

export function isDecisionTopicId(value: string): boolean {
  return decisionTopicIdPattern.test(value);
}

export function legacyDecisionDatePrefix(value: string): string | null {
  return value.match(legacyDecisionFileNamePattern)?.[1] ?? null;
}

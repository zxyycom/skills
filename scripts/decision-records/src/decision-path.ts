const decisionRelativePathPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*\/\d{6}-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/;

export function isDecisionRelativePath(value: string): boolean {
  return decisionRelativePathPattern.test(value);
}

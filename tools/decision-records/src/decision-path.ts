const decisionFileNamePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*\.md$/;
export const decisionKebabCaseIdPatternSource =
  "^[a-z0-9]+(?:-[a-z0-9]+)*$";
const decisionKebabCaseIdPattern = new RegExp(
  decisionKebabCaseIdPatternSource,
  "u"
);
export const decisionRelativePathPatternSource =
  "^[a-z0-9]+(?:-[a-z0-9]+)*/[a-z0-9]+(?:-[a-z0-9]+)*\\.md$";
const decisionRelativePathPattern = new RegExp(decisionRelativePathPatternSource);
const compactDateTokenPattern = /(?:^|-)(?:\d{6}|\d{8})(?:-|$)/;
const isoDateTokenPattern = /(?:^|-)\d{4}-\d{2}-\d{2}(?:-|$)/;
const yearTokenPattern = /(?:^|-)(?:19|20)\d{2}(?:-|$)/;

export function isDecisionRelativePath(value: string): boolean {
  return decisionRelativePathPattern.test(value);
}

export function isNewDecisionIdentityPath(value: string): boolean {
  if (!isDecisionRelativePath(value)) {
    return false;
  }
  const [, fileName = ""] = value.split("/");
  const semanticSlug = fileName.slice(0, -3);
  return (
    !compactDateTokenPattern.test(semanticSlug)
    && !isoDateTokenPattern.test(semanticSlug)
    && !yearTokenPattern.test(semanticSlug)
  );
}

export function isDecisionFileName(value: string): boolean {
  return decisionFileNamePattern.test(value);
}

export function isDecisionDomainId(value: string): boolean {
  return decisionKebabCaseIdPattern.test(value);
}

export function decisionDomainFromRelativePath(value: string): string | null {
  if (!isDecisionRelativePath(value)) {
    return null;
  }
  return value.slice(0, value.indexOf("/"));
}

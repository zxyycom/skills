const decisionFileNamePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*\.md$/;
const decisionTopicIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
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
  const [topicId = "", fileName = ""] = value.split("/");
  const identitySlugs = [topicId, fileName.slice(0, -3)];
  return identitySlugs.every((slug) => (
    !compactDateTokenPattern.test(slug)
    && !isoDateTokenPattern.test(slug)
    && !yearTokenPattern.test(slug)
  ));
}

export function isDecisionFileName(value: string): boolean {
  return decisionFileNamePattern.test(value);
}

export function isDecisionTopicId(value: string): boolean {
  return decisionTopicIdPattern.test(value);
}

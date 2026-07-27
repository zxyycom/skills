import path from "node:path";

export const testEvidenceTopicCatalogFileName =
  "test-evidence-topics.json";
export const testEvidenceCatalogReadmeFileName = "README.md";

export const testEvidenceTopicIdPatternSource =
  "^[a-z0-9]+(?:-[a-z0-9]+)*$";
const topicIdPattern = new RegExp(
  testEvidenceTopicIdPatternSource,
  "u"
);
const caseFileNamePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*\.md$/u;

export function isTestEvidenceTopicId(value: string): boolean {
  return topicIdPattern.test(value);
}

export function isTestEvidenceCaseFileName(value: string): boolean {
  return caseFileNamePattern.test(value);
}

export function testEvidenceTopicIdFromSourcePath(
  sourcePath: string
): string | null {
  const segments = sourcePath.split("/");
  if (
    segments.length !== 2
    || !isTestEvidenceTopicId(segments[0] ?? "")
    || !isTestEvidenceCaseFileName(segments[1] ?? "")
  ) {
    return null;
  }
  return segments[0] ?? null;
}

export function catalogRelativeIndexPath(
  catalogPath: string,
  indexPath: string
): string | null {
  const relativePath = path.posix.relative(catalogPath, indexPath);
  if (
    relativePath.length === 0
    || relativePath === ".."
    || relativePath.startsWith("../")
    || path.posix.isAbsolute(relativePath)
  ) {
    return null;
  }
  return relativePath;
}

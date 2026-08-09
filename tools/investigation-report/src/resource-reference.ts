export const investigationResourcesDirectoryName = "_resources";

const investigationResourcePathSegmentPatternSource =
  "[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?";

export const investigationResourceIdPatternSource =
  `^${investigationResourcePathSegmentPatternSource}`
  + `(?:/${investigationResourcePathSegmentPatternSource})*$`;

const investigationResourceIdPattern = new RegExp(
  investigationResourceIdPatternSource,
  "u"
);

export type InvestigationResourceLinkTargetResult =
  | { status: "valid"; id: string }
  | { status: "invalid"; error: string };

export function isInvestigationResourceId(value: string): boolean {
  return investigationResourceIdPattern.test(value);
}

export function investigationResourceIdFromLinkTarget(
  target: string
): InvestigationResourceLinkTargetResult {
  const prefix = `../${investigationResourcesDirectoryName}/`;
  if (
    !target.startsWith(prefix)
    || target.includes("?")
    || target.includes("#")
    || target.includes("%")
    || target.includes("\\")
  ) {
    return {
      error: `resource link target ${JSON.stringify(target)} must use `
        + `../${investigationResourcesDirectoryName}/<resource-id> without `
        + "queries, fragments, encoding, or backslashes",
      status: "invalid"
    };
  }
  const id = target.slice(prefix.length);
  if (!isInvestigationResourceId(id)) {
    return {
      error: `resource link target ${JSON.stringify(target)} must contain a safe, `
        + "normalized resource id",
      status: "invalid"
    };
  }
  return { id, status: "valid" };
}

export const investigationResourcesDirectoryName = "_resources";

const investigationResourceIdentityCharacterClassSource =
  "A-Za-z0-9\\u3007\\u4e00-\\u9fff";
const investigationResourceAllowedSymbols =
  "._-+@=()（）[]【】《》,!~'，。！、·：？";
const investigationResourceAllowedCharacterClassSource =
  `${investigationResourceIdentityCharacterClassSource}` +
  escapeRegularExpressionCharacterClass(investigationResourceAllowedSymbols);
const investigationResourcePathSegmentPatternSource = `[${investigationResourceAllowedCharacterClassSource}]+`;

export const investigationResourceIdLexicalPatternSource =
  `^${investigationResourcePathSegmentPatternSource}` +
  `(?:/${investigationResourcePathSegmentPatternSource})*$`;

const investigationResourceIdLexicalPattern = new RegExp(
  investigationResourceIdLexicalPatternSource,
  "u"
);
const investigationResourceIdentityCharacterPattern = new RegExp(
  `[${investigationResourceIdentityCharacterClassSource}]`,
  "u"
);
const windowsReservedResourceSegmentPattern =
  /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu;
const maximumMarkdownParenthesisDepth = 32;

export type InvestigationResourceLinkTargetResult =
  | { status: "valid"; id: string }
  | { status: "invalid"; error: string };

export function isInvestigationResourceId(value: string): boolean {
  return (
    investigationResourceIdLexicalPattern.test(value) &&
    value.split("/").every(isInvestigationResourcePathSegment)
  );
}

function isInvestigationResourcePathSegment(segment: string): boolean {
  return (
    !segment.startsWith(".") &&
    !segment.endsWith(".") &&
    investigationResourceIdentityCharacterPattern.test(segment) &&
    !windowsReservedResourceSegmentPattern.test(segment) &&
    hasSupportedMarkdownParentheses(segment)
  );
}

function hasSupportedMarkdownParentheses(segment: string): boolean {
  let depth = 0;
  for (const character of segment) {
    if (character === "(") {
      depth += 1;
      if (depth > maximumMarkdownParenthesisDepth) {
        return false;
      }
    } else if (character === ")") {
      depth -= 1;
      if (depth < 0) {
        return false;
      }
    }
  }
  return depth === 0;
}

function escapeRegularExpressionCharacterClass(value: string): string {
  return value.replace(/[\\[\]^-]/gu, "\\$&");
}

export function investigationResourceIdFromLinkTarget(
  target: string
): InvestigationResourceLinkTargetResult {
  const prefix = `../${investigationResourcesDirectoryName}/`;
  if (
    !target.startsWith(prefix) ||
    target.includes("?") ||
    target.includes("#") ||
    target.includes("%") ||
    target.includes("\\")
  ) {
    return {
      error:
        `resource link target ${JSON.stringify(target)} must use ` +
        `../${investigationResourcesDirectoryName}/<resource-id> without ` +
        "queries, fragments, encoding, or backslashes",
      status: "invalid"
    };
  }
  const id = target.slice(prefix.length);
  if (!isInvestigationResourceId(id)) {
    return {
      error:
        `resource link target ${JSON.stringify(target)} must contain a safe, ` +
        "normalized resource id",
      status: "invalid"
    };
  }
  return { id, status: "valid" };
}

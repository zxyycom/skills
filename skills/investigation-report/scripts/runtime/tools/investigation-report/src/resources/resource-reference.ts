/*
 * Synced TypeScript runtime; repository maintenance edits tools/investigation-report/src/resources/resource-reference.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/investigation-report/src/resources/resource-reference.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/investigation-report/src/resources/resource-reference.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/investigation-report
 * Rebuild: bun run sync:investigation-report-check
 */
import { isInvestigationId } from "../collection/report-path.ts";

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
  const segments = value.split("/");
  return (
    isLexicallySafeInvestigationResourcePath(value) &&
    segments.length >= 2 &&
    isInvestigationId(segments[0]!)
  );
}

export function investigationResourceOwnerReportId(
  value: string
): string | null {
  if (!isInvestigationResourceId(value)) {
    return null;
  }
  return value.split("/")[0]!;
}

export function investigationResourceIdFromLinkTarget(
  target: string
): InvestigationResourceLinkTargetResult {
  const prefix = `./${investigationResourcesDirectoryName}/`;
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
        `./${investigationResourcesDirectoryName}/<resource-id> without ` +
        "queries, fragments, encoding, or backslashes",
      status: "invalid"
    };
  }
  const id = target.slice(prefix.length);
  if (!isInvestigationResourceId(id)) {
    return {
      error: isLexicallySafeInvestigationResourcePath(id)
        ? `resource link target ${JSON.stringify(target)} must use ` +
          "<investigation-id-without-md>/<resource-subpath> with an " +
          "Investigation ID owner prefix"
        : `resource link target ${JSON.stringify(target)} must contain a safe, ` +
          "normalized resource id",
      status: "invalid"
    };
  }
  return { id, status: "valid" };
}

function isLexicallySafeInvestigationResourcePath(value: string): boolean {
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

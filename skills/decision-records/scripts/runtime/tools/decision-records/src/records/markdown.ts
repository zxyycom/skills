/*
 * Synced TypeScript runtime; repository maintenance edits tools/decision-records/src/records/markdown.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/decision-records/src/records/markdown.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/decision-records/src/records/markdown.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
import type { MarkdownSection } from "../types.ts";

const unorderedListMarkerPattern = "[-*+]";
const fieldSeparatorPattern = "[:：]";

export function parseSections(body: string): MarkdownSection[] {
  const marker = "##";
  const matches = [
    ...body.matchAll(new RegExp("^" + marker + " ([^\\n]+)$", "gm"))
  ];
  return matches.map((match, index) => {
    const heading = marker + " " + match[1].trim();
    const headingIndex = match.index ?? 0;
    const lineEnd = body.indexOf("\n", headingIndex);
    const contentStart = lineEnd >= 0 ? lineEnd + 1 : body.length;
    const contentEnd =
      index + 1 < matches.length
        ? (matches[index + 1].index ?? body.length)
        : body.length;

    return {
      content: body.slice(contentStart, contentEnd).trim(),
      heading,
      index: headingIndex
    };
  });
}

function fieldValues(sectionContent: string, label: string): string[] {
  const escapedLabel = label.replace(/[.*+?^$()|[\]\\]/g, "\\$&");
  const fieldPrefixPattern = `${unorderedListMarkerPattern} ${escapedLabel}${fieldSeparatorPattern}`;
  const pattern = new RegExp(
    `^${fieldPrefixPattern}[\\t ]*(.*?)[\\t ]*$`,
    "gmu"
  );
  return [...sectionContent.matchAll(pattern)].map((match) => match[1].trim());
}

export function requireNonEmptyField(
  relativePath: string,
  sectionContent: string,
  label: string,
  errors: string[]
): void {
  const values = fieldValues(sectionContent, label);
  if (values.every((value) => value.length === 0)) {
    errors.push(
      relativePath + ' must include non-empty field "- ' + label + ': <value>"'
    );
  }
}

import type { MarkdownSection } from "./types.ts";

export function stripLinkSuffix(target: string): string {
  const hashIndex = target.indexOf("#");
  const queryIndex = target.indexOf("?");
  const indexes = [hashIndex, queryIndex].filter((value) => value >= 0);
  const endIndex = indexes.length > 0 ? Math.min(...indexes) : target.length;
  return target.slice(0, endIndex);
}

export function parseSections(body: string): MarkdownSection[] {
  const matches = [...body.matchAll(/^## ([^\n]+)$/gm)];
  return matches.map((match, index) => {
    const heading = "## " + match[1].trim();
    const headingIndex = match.index ?? 0;
    const lineEnd = body.indexOf("\n", headingIndex);
    const contentStart = lineEnd >= 0 ? lineEnd + 1 : body.length;
    const contentEnd = index + 1 < matches.length
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
  const pattern = new RegExp("^- " + escapedLabel + ":\\s*(.*?)\\s*$", "gm");
  return [...sectionContent.matchAll(pattern)].map((match) => match[1].trim());
}

export function requireSingleField(
  relativePath: string,
  sectionContent: string,
  label: string,
  errors: string[]
): string | null {
  const values = fieldValues(sectionContent, label);
  if (values.length === 0) {
    errors.push(relativePath + " must include field \"- " + label + ": <value>\"");
    return null;
  }

  if (values.length > 1) {
    errors.push(relativePath + " must include field \"- " + label + ":\" exactly once");
  }

  if (values[0].length === 0) {
    errors.push(relativePath + " field \"- " + label + ":\" must not be empty");
    return null;
  }

  return values[0];
}

export function requireNonEmptyField(
  relativePath: string,
  sectionContent: string,
  label: string,
  errors: string[]
): void {
  const values = fieldValues(sectionContent, label);
  if (values.length === 0 || values.every((value) => value.length === 0)) {
    errors.push(relativePath + " must include non-empty field \"- " + label + ": <value>\"");
  }
}

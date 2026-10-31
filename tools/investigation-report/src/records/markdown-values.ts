export function parseQuotedScalar(value: string): string | null {
  if (!value.startsWith('"') || !value.endsWith('"')) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    return typeof parsed === "string" ? parsed : null;
  } catch {
    return null;
  }
}

export function hasC0ControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    if (value.charCodeAt(index) <= 0x1f) return true;
  }
  return false;
}

export function quoteScalar(value: string): string {
  return JSON.stringify(value);
}

export function normalizeMarkdownNewlines(value: string): string {
  return value.replace(/\r\n?/gu, "\n");
}

export function compareInvestigationText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function isStrictlySorted(values: readonly string[]): boolean {
  return values.every(
    (value, index) =>
      index === 0 || compareInvestigationText(values[index - 1]!, value) < 0
  );
}

export function uniqueSortedInvestigationText(
  values: readonly string[]
): string[] {
  return [...new Set(values)].sort(compareInvestigationText);
}

export const projectionMaximumLength = 100;
export const projectionMinimumLength = 4;

export function unicodeCodePointLength(value: string): number {
  return [...value].length;
}

export function projectionTextIssue(value: string): string | null {
  const trimmed = value.trim();
  const length = unicodeCodePointLength(trimmed);

  if (/[\r\n]/.test(value)) {
    return "must be single-line text (actual length " + length + " Unicode code points)";
  }
  if (length < projectionMinimumLength || length > projectionMaximumLength) {
    return "must contain "
      + projectionMinimumLength
      + " to "
      + projectionMaximumLength
      + " Unicode code points (actual "
      + length
      + ")";
  }

  return null;
}

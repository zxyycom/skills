/*
 * Synced TypeScript runtime; repository maintenance edits tools/decision-records/src/projection.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/decision-records/src/projection.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/decision-records/src/projection.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
export const projectionMaximumLength = 100;
export const projectionMinimumLength = 4;

export function unicodeCodePointLength(value: string): number {
  // oxlint-disable-next-line typescript/no-misused-spread -- This contract counts Unicode code points, not grapheme clusters.
  return [...value].length;
}

export function projectionTextIssue(value: string): string | null {
  const trimmed = value.trim();
  const length = unicodeCodePointLength(trimmed);

  if (/[\r\n]/.test(value)) {
    return (
      "must be single-line text (actual length " +
      length +
      " Unicode code points)"
    );
  }
  if (length < projectionMinimumLength || length > projectionMaximumLength) {
    return (
      "must contain " +
      projectionMinimumLength +
      " to " +
      projectionMaximumLength +
      " Unicode code points (actual " +
      length +
      ")"
    );
  }

  return null;
}

/*
 * Synced TypeScript runtime; repository maintenance edits tools/investigation-report/src/investigation-selector.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/investigation-report/src/investigation-selector.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/investigation-report/src/investigation-selector.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/investigation-report
 * Rebuild: bun run sync:investigation-report-check
 */
import {
  investigationNameFromId,
  normalizeInvestigationSelectorInput,
  parseDatedInvestigationId
} from "./report-path.ts";

export type InvestigationSelectorEntry = Readonly<{
  id: string;
  name: string;
}>;

export type InvestigationSelectorResult =
  | Readonly<{ id: string; status: "ok" }>
  | Readonly<{ errors: string[]; status: "error" }>;

/** Resolves a normal user selector without ever treating a source path as an ID. */
export function resolveInvestigationSelector(
  entries: readonly InvestigationSelectorEntry[],
  selector: string,
  label = "investigation report"
): InvestigationSelectorResult {
  const normalized = normalizeInvestigationSelectorInput(selector);
  const dated = parseDatedInvestigationId(normalized);
  if (dated !== null) {
    return entries.some((entry) => entry.id === dated.id)
      ? { id: dated.id, status: "ok" }
      : { errors: [`${normalized} ${label} does not exist`], status: "error" };
  }
  const matches = entries
    .filter((entry) => entry.name === normalized)
    .map((entry) => entry.id)
    .sort(compareText);
  if (matches.length === 0) {
    return {
      errors: [`${normalized} ${label} does not exist`],
      status: "error"
    };
  }
  if (matches.length > 1) {
    return {
      errors: [
        `Investigation name is ambiguous: ${normalized}; choose one standard ID: ${matches.join(", ")}`
      ],
      status: "error"
    };
  }
  return { id: matches[0]!, status: "ok" };
}

export function investigationSelectorEntries(
  ids: readonly string[]
): InvestigationSelectorEntry[] {
  return ids.map((id) => ({ id, name: investigationNameFromId(id) }));
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

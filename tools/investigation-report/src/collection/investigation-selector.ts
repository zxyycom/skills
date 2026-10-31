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
  return createInvestigationSelectorResolver(entries)(selector, label);
}

/** Builds an operation-local lookup; duplicates remain visible for ambiguity. */
export function createInvestigationSelectorResolver(
  entries: readonly InvestigationSelectorEntry[]
): (selector: string, label?: string) => InvestigationSelectorResult {
  const ids = new Set<string>();
  const names = new Map<string, string[]>();
  for (const entry of entries) {
    const { id, name } = entry;
    ids.add(id);
    const matches = names.get(name) ?? [];
    matches.push(id);
    names.set(name, matches);
  }
  for (const matches of names.values()) matches.sort(compareText);
  return (selector, label = "investigation report") => {
    const normalized = normalizeInvestigationSelectorInput(selector);
    const dated = parseDatedInvestigationId(normalized);
    if (dated !== null) {
      return ids.has(dated.id)
        ? { id: dated.id, status: "ok" }
        : {
            errors: [`${normalized} ${label} does not exist`],
            status: "error"
          };
    }
    const matches = names.get(normalized) ?? [];
    if (matches.length === 0)
      return {
        errors: [`${normalized} ${label} does not exist`],
        status: "error"
      };
    if (matches.length > 1)
      return {
        errors: [
          `Investigation name is ambiguous: ${normalized}; choose one standard ID: ${matches.join(", ")}`
        ],
        status: "error"
      };
    return { id: matches[0]!, status: "ok" };
  };
}

export function investigationSelectorEntries(
  ids: readonly string[]
): InvestigationSelectorEntry[] {
  return ids.map((id) => ({ id, name: investigationNameFromId(id) }));
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

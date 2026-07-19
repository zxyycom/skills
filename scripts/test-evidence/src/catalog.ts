export type CaseStatus = "implemented" | "planned";

export type CatalogCase = {
  codeDeclarations: number;
  codePath: string | null;
  id: string;
  invalidCode: boolean;
  line: number;
  provesContent: boolean;
  provesDeclarations: number;
  status: CaseStatus | null;
};

const headingPattern = /^#{2,6}\s+(\S+)/u;
const statusPattern = /^Status:\s+(\S+)\s*$/u;
const codePattern = /^Code:\s+`([^`]+)`\s*$/u;
const codePrefixPattern = /^Code:/u;
const provesPattern = /^Proves:\s*$/u;

export function collectCatalogCases(text: string, caseIdPattern: RegExp): CatalogCase[] {
  const entries: CatalogCase[] = [];
  const lines = text.split(/\r?\n/u);
  let current: CatalogCase | null = null;
  let collectingProves = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const heading = line.match(headingPattern);
    if (heading !== null) {
      const candidateId = heading[1] ?? "";
      if (!caseIdPattern.test(candidateId)) {
        current = null;
        collectingProves = false;
        continue;
      }

      current = {
        codeDeclarations: 0,
        codePath: null,
        id: candidateId,
        invalidCode: false,
        line: index + 1,
        provesContent: false,
        provesDeclarations: 0,
        status: null
      };
      collectingProves = false;
      entries.push(current);
      continue;
    }

    if (current === null) {
      continue;
    }

    const status = line.match(statusPattern);
    if (status !== null) {
      current.status = parseStatus(status[1] ?? "");
      collectingProves = false;
      continue;
    }

    if (codePrefixPattern.test(line)) {
      current.codeDeclarations += 1;
      const code = line.match(codePattern);
      if (code === null) {
        current.invalidCode = true;
      } else if (current.codePath === null) {
        current.codePath = normalizePath(code[1] ?? "");
      }
      collectingProves = false;
      continue;
    }

    if (provesPattern.test(line)) {
      current.provesDeclarations += 1;
      collectingProves = true;
      continue;
    }

    const trimmed = line.trim();
    if (
      collectingProves
      && (
        /^[-*]\s+\S/u.test(trimmed)
        || /^\d+\.\s+\S/u.test(trimmed)
        || trimmed === "```mermaid"
      )
    ) {
      current.provesContent = true;
    }
  }

  return entries;
}

export function duplicateValues(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
    }
    seen.add(value);
  }
  return [...duplicates].sort();
}

export function normalizePath(value: string): string {
  return value.replaceAll("\\", "/");
}

function parseStatus(value: string): CaseStatus | null {
  return value === "implemented" || value === "planned" ? value : null;
}

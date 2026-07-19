import {
  caseStatuses,
  type CaseStatus,
  type VerificationMode,
  verificationModes
} from "./types.ts";
import { normalizeWorkspaceRelative } from "./workspace-path.ts";

export type CatalogSectionName = "proves" | "reason" | "review" | "risk" | "scope";

export type CatalogSection = {
  declarations: number;
  items: string[];
};

export type ParsedCatalogCase = {
  caseIdIsValid: boolean;
  codeDeclarations: number;
  codePath: string | null;
  id: string;
  invalidCode: boolean;
  line: number;
  sections: Record<CatalogSectionName, CatalogSection>;
  status: CaseStatus | null;
  statusDeclarations: number;
  verification: VerificationMode | null;
  verificationDeclarations: number;
};

const headingPattern = /^(#{2,6})\s+(\S+)/u;
const statusPattern = /^Status:\s+(\S+)\s*$/u;
const statusPrefixPattern = /^Status:/u;
const verificationPattern = /^Verification:\s+(\S+)\s*$/u;
const verificationPrefixPattern = /^Verification:/u;
const codePattern = /^Code:\s+`([^`]+)`\s*$/u;
const codePrefixPattern = /^Code:/u;
const sectionPattern = /^(Proves|Scope|Risk|Reason|Review):\s*$/u;

const sectionNames: Record<string, CatalogSectionName> = {
  Proves: "proves",
  Reason: "reason",
  Review: "review",
  Risk: "risk",
  Scope: "scope"
};

export function collectCatalogCases(
  text: string,
  caseIdPattern: RegExp
): ParsedCatalogCase[] {
  const entries: ParsedCatalogCase[] = [];
  const lines = text.split(/\r?\n/u);
  let current: ParsedCatalogCase | null = null;
  let collectingSection: CatalogSectionName | null = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const heading = line.match(headingPattern);
    if (heading !== null) {
      const headingLevel = (heading[1] ?? "").length;
      if (headingLevel < 3) {
        current = null;
        collectingSection = null;
        continue;
      }
      const candidateId = heading[2] ?? "";

      current = {
        caseIdIsValid: caseIdPattern.test(candidateId),
        codeDeclarations: 0,
        codePath: null,
        id: candidateId,
        invalidCode: false,
        line: index + 1,
        sections: createSections(),
        status: null,
        statusDeclarations: 0,
        verification: null,
        verificationDeclarations: 0
      };
      collectingSection = null;
      entries.push(current);
      continue;
    }

    if (current === null) {
      continue;
    }

    if (statusPrefixPattern.test(line)) {
      current.statusDeclarations += 1;
      const status = line.match(statusPattern);
      current.status = status === null ? null : parseStatus(status[1] ?? "");
      collectingSection = null;
      continue;
    }

    if (verificationPrefixPattern.test(line)) {
      current.verificationDeclarations += 1;
      const verification = line.match(verificationPattern);
      current.verification = verification === null
        ? null
        : parseVerification(verification[1] ?? "");
      collectingSection = null;
      continue;
    }

    if (codePrefixPattern.test(line)) {
      current.codeDeclarations += 1;
      const code = line.match(codePattern);
      if (code === null) {
        current.invalidCode = true;
      } else {
        const codePath = normalizeWorkspaceRelative(code[1] ?? "");
        if (codePath === null) {
          current.invalidCode = true;
        } else if (current.codePath === null) {
          current.codePath = codePath;
        }
      }
      collectingSection = null;
      continue;
    }

    const section = line.match(sectionPattern);
    if (section !== null) {
      collectingSection = sectionNames[section[1] ?? ""] ?? null;
      if (collectingSection !== null) {
        current.sections[collectingSection].declarations += 1;
      }
      continue;
    }

    const trimmed = line.trim();
    if (collectingSection === null) {
      continue;
    }
    const listItem = trimmed.match(/^(?:[-*]|\d+\.)\s+(\S.*)$/u);
    if (listItem !== null) {
      current.sections[collectingSection].items.push(listItem[1] ?? "");
    }
  }

  return entries;
}

function parseStatus(value: string): CaseStatus | null {
  return caseStatuses.find((status) => status === value) ?? null;
}

function parseVerification(value: string): VerificationMode | null {
  return verificationModes.find((verification) => verification === value) ?? null;
}

function createSections(): Record<CatalogSectionName, CatalogSection> {
  return {
    proves: { declarations: 0, items: [] },
    reason: { declarations: 0, items: [] },
    review: { declarations: 0, items: [] },
    risk: { declarations: 0, items: [] },
    scope: { declarations: 0, items: [] }
  };
}

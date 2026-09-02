import path from "node:path";
import type {
  StateIndexContext,
  StateSnapshot,
  StateSourceRevision
} from "../../../index-runtime/src/index.ts";
import { compareLexicalText } from "./canonicalization.ts";
import {
  identifyLedgerCaseSource,
  parseLedgerCaseSource,
  type IdentifiedLedgerCaseSource,
  type ParsedLedgerCaseSource
} from "./case-source.ts";
import { createTestEvidenceDiagnostic } from "./diagnostics.ts";
import {
  parseTestEntityIndex,
  type ParsedTestEntityIndex
} from "./entity-index.ts";
import {
  validateClosedTestEvidenceRelations,
  type ClosedTestEvidenceRelations
} from "./relations.ts";
import type {
  TestEvidenceDiagnostic,
  TestEvidenceLedgerCaseIndexState,
  TestEvidenceLedgerIndexMetadata,
  TestEvidenceLedgerSummary
} from "./schemas.ts";
import type { LedgerTextSource } from "./text-source.ts";
import { readLedgerWorkspaceSources } from "./workspace.ts";

export type LoadedTestEvidenceLedgerSource = {
  cases: ParsedLedgerCaseSource[];
  entityIndex: ParsedTestEntityIndex;
  relations: ClosedTestEvidenceRelations;
  snapshot: StateSnapshot<
    TestEvidenceLedgerCaseIndexState,
    TestEvidenceLedgerIndexMetadata
  >;
  summary: TestEvidenceLedgerSummary;
};

export type TestEvidenceLedgerSourceResult =
  | {
      diagnostics: [];
      entityIndex: ParsedTestEntityIndex;
      source: LoadedTestEvidenceLedgerSource;
      summary: TestEvidenceLedgerSummary;
    }
  | {
      diagnostics: TestEvidenceDiagnostic[];
      entityIndex: ParsedTestEntityIndex | null;
      source: null;
      summary: TestEvidenceLedgerSummary;
    };

export type TestEvidenceLedgerRevisionSource = {
  cases: IdentifiedLedgerCaseSource[];
  entityIndex: ParsedTestEntityIndex;
  sourceRevision: StateSourceRevision;
};

export type TestEvidenceLedgerRevisionResult =
  | {
      diagnostics: [];
      source: TestEvidenceLedgerRevisionSource;
    }
  | {
      diagnostics: TestEvidenceDiagnostic[];
      source: null;
    };

export class TestEvidenceLedgerSourceError extends Error {
  readonly diagnostics: TestEvidenceDiagnostic[];

  constructor(diagnostics: readonly TestEvidenceDiagnostic[]) {
    super(diagnostics.map((diagnostic) => diagnostic.message).join("; "));
    this.name = "TestEvidenceLedgerSourceError";
    this.diagnostics = [...diagnostics];
  }
}

const emptySummary: TestEvidenceLedgerSummary = {
  tests: 0,
  cases: 0,
  relations: 0,
  tags: 0
};

export async function readTestEvidenceLedgerSource(
  workspaceRoot: string
): Promise<TestEvidenceLedgerSourceResult> {
  const root = path.resolve(workspaceRoot);
  const workspace = await readLedgerWorkspaceSources(root);
  const diagnostics = [...workspace.diagnostics];
  const entityResult =
    workspace.entitySource === null
      ? null
      : parseTestEntityIndex(workspace.entitySource);
  if (entityResult !== null) {
    diagnostics.push(...entityResult.diagnostics);
  }
  const entityIndex = entityResult?.parsed ?? null;

  const cases = parseLedgerCases(workspace.caseSources, diagnostics);
  diagnostics.push(...duplicateCaseDiagnostics(cases));
  cases.sort((left, right) => compareLexicalText(left.id, right.id));

  const partialSummary = ledgerSummary(entityIndex, cases);
  if (diagnostics.length > 0 || entityIndex === null) {
    return {
      diagnostics,
      entityIndex,
      source: null,
      summary: partialSummary
    };
  }

  const relationResult = validateClosedTestEvidenceRelations(
    entityIndex.value,
    cases.map((entry) => entry.case)
  );
  diagnostics.push(...relationResult.diagnostics);
  if (relationResult.relations === null) {
    return {
      diagnostics,
      entityIndex,
      source: null,
      summary: partialSummary
    };
  }

  const sourceRevision = ledgerSourceRevision(entityIndex, cases);
  const states = ledgerCaseStates(cases);
  return loadedLedgerSourceResult({
    cases,
    entityIndex,
    partialSummary,
    relations: relationResult.relations,
    sourceRevision,
    states
  });
}

function loadedLedgerSourceResult(options: {
  cases: ParsedLedgerCaseSource[];
  entityIndex: ParsedTestEntityIndex;
  partialSummary: TestEvidenceLedgerSummary;
  relations: ClosedTestEvidenceRelations;
  sourceRevision: StateSourceRevision;
  states: Record<string, TestEvidenceLedgerCaseIndexState>;
}): TestEvidenceLedgerSourceResult {
  const summary = {
    ...options.partialSummary,
    relations: options.relations.relationCount
  };
  return {
    diagnostics: [],
    entityIndex: options.entityIndex,
    source: {
      cases: options.cases,
      entityIndex: options.entityIndex,
      relations: options.relations,
      snapshot: {
        metadata: { entityIndex: { ...options.entityIndex.identity } },
        sourceRevision: options.sourceRevision,
        states: options.states
      },
      summary
    },
    summary
  };
}

function parseLedgerCases(
  sources: readonly LedgerTextSource[],
  diagnostics: TestEvidenceDiagnostic[]
): ParsedLedgerCaseSource[] {
  const cases: ParsedLedgerCaseSource[] = [];
  for (const source of sources) {
    const parsed = parseLedgerCaseSource(source);
    diagnostics.push(...parsed.diagnostics);
    if (parsed.value !== null) {
      cases.push(parsed.value);
    }
  }
  return cases;
}

function ledgerSummary(
  entityIndex: ParsedTestEntityIndex | null,
  cases: readonly ParsedLedgerCaseSource[]
): TestEvidenceLedgerSummary {
  return {
    cases: cases.length,
    relations: 0,
    tags: new Set(cases.flatMap((entry) => entry.case.tags)).size,
    tests: entityIndex?.value.entities.length ?? 0
  };
}

export async function readTestEvidenceLedgerRevision(
  workspaceRoot: string
): Promise<TestEvidenceLedgerRevisionResult> {
  const workspace = await readLedgerWorkspaceSources(
    path.resolve(workspaceRoot)
  );
  const diagnostics = [...workspace.diagnostics];
  const entityResult =
    workspace.entitySource === null
      ? null
      : parseTestEntityIndex(workspace.entitySource);
  if (entityResult !== null) {
    diagnostics.push(...entityResult.diagnostics);
  }
  const entityIndex = entityResult?.parsed ?? null;

  const cases: IdentifiedLedgerCaseSource[] = [];
  for (const caseSource of workspace.caseSources) {
    const identified = identifyLedgerCaseSource(caseSource);
    diagnostics.push(...identified.diagnostics);
    if (identified.value !== null) {
      cases.push(identified.value);
    }
  }
  diagnostics.push(...duplicateCaseDiagnostics(cases));
  cases.sort((left, right) => compareLexicalText(left.id, right.id));

  if (diagnostics.length > 0 || entityIndex === null) {
    return { diagnostics, source: null };
  }
  return {
    diagnostics: [],
    source: {
      cases,
      entityIndex,
      sourceRevision: ledgerSourceRevision(entityIndex, cases)
    }
  };
}

export async function readCurrentTestEvidenceLedgerRevision(
  context: StateIndexContext
): Promise<StateSourceRevision> {
  const result = await readTestEvidenceLedgerRevision(context.root);
  if (result.source === null) {
    throw new TestEvidenceLedgerSourceError(result.diagnostics);
  }
  return result.source.sourceRevision;
}

export function sameTestEvidenceLedgerRevision(
  left: StateSourceRevision,
  right: StateSourceRevision
): boolean {
  if (left.metadata !== right.metadata) {
    return false;
  }
  const leftIds = Object.keys(left.entries).sort(compareLexicalText);
  const rightIds = Object.keys(right.entries).sort(compareLexicalText);
  return (
    leftIds.length === rightIds.length &&
    leftIds.every(
      (id, index) =>
        id === rightIds[index] && left.entries[id] === right.entries[id]
    )
  );
}

export function sameTargetTestEvidenceLedgerRevision(options: {
  caseId: string;
  current: StateSourceRevision;
  observedFingerprint: string;
  opened: StateSourceRevision;
}): boolean {
  return (
    options.current.metadata === options.opened.metadata &&
    options.observedFingerprint === options.opened.entries[options.caseId] &&
    options.current.entries[options.caseId] === options.observedFingerprint
  );
}

function ledgerSourceRevision(
  entityIndex: ParsedTestEntityIndex,
  cases: readonly IdentifiedLedgerCaseSource[]
): StateSourceRevision {
  return {
    metadata: entityIndex.identity.fingerprint,
    entries: Object.fromEntries(
      cases.map((entry) => [entry.id, entry.fingerprint])
    )
  };
}

function ledgerCaseStates(
  cases: readonly ParsedLedgerCaseSource[]
): Record<string, TestEvidenceLedgerCaseIndexState> {
  const states: Record<string, TestEvidenceLedgerCaseIndexState> =
    Object.create(null);
  for (const entry of cases) {
    const summary = entry.case.proves[0];
    if (summary === undefined) {
      throw new TypeError(`validated Case ${entry.id} has no Proves summary`);
    }
    states[entry.id] = {
      title: entry.case.title,
      summary,
      sourcePath: entry.case.sourcePath,
      testIds: Array.from(entry.case.testIds),
      tags: Array.from(entry.case.tags),
      searchText: caseSearchText(entry)
    };
  }
  return states;
}

function caseSearchText(entry: ParsedLedgerCaseSource): string {
  const terms = [entry.case.title];
  const collections = [
    entry.case.contract,
    entry.case.proves,
    entry.case.testIds,
    entry.case.tags
  ];
  for (const collection of collections) {
    for (const value of collection) {
      terms.push(value);
    }
  }
  return terms.join(" ");
}

function duplicateCaseDiagnostics(
  cases: readonly IdentifiedLedgerCaseSource[]
): TestEvidenceDiagnostic[] {
  const firstPathById = new Map<string, string>();
  const diagnostics: TestEvidenceDiagnostic[] = [];
  for (const entry of cases) {
    const firstPath = firstPathById.get(entry.id);
    if (firstPath !== undefined) {
      diagnostics.push(
        createTestEvidenceDiagnostic({
          caseId: entry.id,
          category: "case",
          code: "case.id-duplicate",
          message: `${entry.id} appears in both ${firstPath} and ${entry.path}`,
          path: entry.path,
          severity: "error"
        })
      );
      continue;
    }
    firstPathById.set(entry.id, entry.path);
  }
  return diagnostics;
}

export function emptyTestEvidenceLedgerSummary(): TestEvidenceLedgerSummary {
  return { ...emptySummary };
}

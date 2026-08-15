import path from "node:path";
import {
  buildStateIndex,
  createStateIndexReader,
  expectationOf,
  loadStateIndex,
  type StateIndexDiagnostic,
  type StateIndexReader
} from "../../../index-runtime/src/index.ts";
import { createTestEvidenceDiagnostic } from "./diagnostics.ts";
import {
  readTestEvidenceLedgerRevision,
  readTestEvidenceLedgerSource,
  sameTestEvidenceLedgerRevision,
  type TestEvidenceLedgerRevisionSource
} from "./ledger-source.ts";
import {
  createTestEvidenceLedgerStateIndexDefinition,
  indexCanBeRebuilt,
  mapStateIndexDiagnostics
} from "./state-index.ts";
import {
  testEvidenceLedgerIndexPath,
  type TestEvidenceDiagnostic,
  type TestEvidenceLedgerCaseIndexState,
  type TestEvidenceLedgerIndexMetadata
} from "./schemas.ts";

type TestEvidenceLedgerReader = StateIndexReader<
  TestEvidenceLedgerCaseIndexState,
  TestEvidenceLedgerIndexMetadata
>;

export type OpenedTestEvidenceLedgerIndex = {
  reader: TestEvidenceLedgerReader;
  revisionSource: TestEvidenceLedgerRevisionSource;
};

export type OpenTestEvidenceLedgerIndexResult =
  | {
      diagnostics: TestEvidenceDiagnostic[];
      opened: OpenedTestEvidenceLedgerIndex;
    }
  | {
      diagnostics: TestEvidenceDiagnostic[];
      opened: null;
    };

export async function openTestEvidenceLedgerIndex(
  workspaceRoot: string
): Promise<OpenTestEvidenceLedgerIndexResult> {
  const root = path.resolve(workspaceRoot);
  const definition = createTestEvidenceLedgerStateIndexDefinition();
  const loaded = await loadStateIndex({
    context: { root },
    definition,
    expectation: expectationOf(definition),
    indexPath: testEvidenceLedgerIndexPath
  });

  let persistentDiagnostics: StateIndexDiagnostic[] = [];
  if (loaded.status === "ok") {
    const revision = await readTestEvidenceLedgerRevision(root);
    if (revision.source === null) {
      return { diagnostics: revision.diagnostics, opened: null };
    }
    if (
      sameTestEvidenceLedgerRevision(
        loaded.value.sourceRevision,
        revision.source.sourceRevision
      )
    ) {
      return {
        diagnostics: [],
        opened: {
          reader: createStateIndexReader({
            definition,
            index: loaded.value,
            indexPath: testEvidenceLedgerIndexPath
          }),
          revisionSource: revision.source
        }
      };
    }
    persistentDiagnostics = [
      {
        code: "state-index.index-stale",
        message:
          "index source revision does not match the current ledger source revision",
        path: testEvidenceLedgerIndexPath,
        stateId: null
      }
    ];
  } else {
    persistentDiagnostics = loaded.diagnostics;
  }

  if (
    persistentDiagnostics.length === 0 ||
    !persistentDiagnostics.every((entry) => indexCanBeRebuilt(entry.code))
  ) {
    return {
      diagnostics: mapStateIndexDiagnostics(persistentDiagnostics),
      opened: null
    };
  }

  const source = await readTestEvidenceLedgerSource(root);
  if (source.source === null) {
    return { diagnostics: source.diagnostics, opened: null };
  }
  const fallbackDefinition = createTestEvidenceLedgerStateIndexDefinition({
    snapshot: source.source.snapshot
  });
  const built = await buildStateIndex(fallbackDefinition, { root });
  if (built.status === "error") {
    return {
      diagnostics: [
        ...mapStateIndexDiagnostics(persistentDiagnostics),
        ...mapStateIndexDiagnostics(built.diagnostics)
      ],
      opened: null
    };
  }
  const currentRevision = await readTestEvidenceLedgerRevision(root);
  if (currentRevision.source === null) {
    return { diagnostics: currentRevision.diagnostics, opened: null };
  }
  if (
    !sameTestEvidenceLedgerRevision(
      built.value.sourceRevision,
      currentRevision.source.sourceRevision
    )
  ) {
    return {
      diagnostics: [
        createTestEvidenceDiagnostic({
          category: "index",
          code: "state-index.source-changed",
          message:
            "ledger source revision changed while building the in-memory projection; retry after the source is stable",
          path: testEvidenceLedgerIndexPath,
          severity: "error"
        })
      ],
      opened: null
    };
  }

  const warnings = fallbackWarnings(persistentDiagnostics);
  return {
    diagnostics: warnings,
    opened: {
      reader: createStateIndexReader({
        definition: fallbackDefinition,
        index: built.value,
        indexPath: testEvidenceLedgerIndexPath
      }),
      revisionSource: currentRevision.source
    }
  };
}

function fallbackWarnings(
  diagnostics: readonly StateIndexDiagnostic[]
): TestEvidenceDiagnostic[] {
  return mapStateIndexDiagnostics(diagnostics, "warning").map((entry) => ({
    ...entry,
    message: `${entry.message}. Used the current ledger sources in memory for this read-only query; run sync-index --write to refresh ${testEvidenceLedgerIndexPath}`
  }));
}

import path from "node:path";
import * as v from "valibot";
import {
  createStateIndexRuntime,
  defineStateIndexDefinition,
  type StateIndexDefinition,
  type StateIndexSyncScope,
  type StateSnapshot
} from "../../index-runtime/src/index.ts";
import {
  testEvidenceCaseIdSchema,
  testEvidenceCaseIndexStateSchema,
  testEvidenceDefinitionVersion,
  testEvidenceIndexMetadataSchema,
  testEvidenceIndexPath,
  testEvidenceNamespace,
  testEvidenceSchemaVersion,
  testEvidenceStateIndexSchema,
  type TestEvidenceCaseIndexState,
  type TestEvidenceDiagnostic,
  type TestEvidenceIndexMetadata
} from "./core-schemas.ts";
import { diagnostic } from "./core-support.ts";
import { readCases, type Source } from "./core-source.ts";

export function definition(
  snapshot?: StateSnapshot<
    TestEvidenceCaseIndexState,
    TestEvidenceIndexMetadata
  >
): StateIndexDefinition<TestEvidenceCaseIndexState, TestEvidenceIndexMetadata> {
  return defineStateIndexDefinition({
    definitionVersion: testEvidenceDefinitionVersion,
    namespace: testEvidenceNamespace,
    fieldOrder: "definition",
    queryFields: [
      {
        mode: "exact",
        name: "tag",
        sources: [{ kind: "state-path", path: ["tags"] }]
      },
      {
        mode: "exact",
        name: "test",
        sources: [{ kind: "state-path", path: ["testIds"] }]
      }
    ],
    parseMetadata: (input) => v.parse(testEvidenceIndexMetadataSchema, input),
    parseState: (input) => v.parse(testEvidenceCaseIndexStateSchema, input),
    read: async (context) =>
      snapshot ?? snapshotFromSource(await readCases(context.root)),
    readRevision: async (context) => {
      const source = await readCases(context.root);
      if (source.revision === null)
        throw new Error(
          source.diagnostics.map((entry) => entry.message).join("; ")
        );
      return source.revision;
    },
    validateIndex: (index) => {
      v.parse(testEvidenceStateIndexSchema, index);
    }
  });
}
export function snapshotFromSource(
  source: Source
): StateSnapshot<TestEvidenceCaseIndexState, TestEvidenceIndexMetadata> {
  if (source.revision === null)
    throw new Error(
      source.diagnostics.map((entry) => entry.message).join("; ")
    );
  return {
    metadata: {},
    sourceRevision: source.revision,
    states: Object.fromEntries(
      source.cases.map(({ case: entry }) => [
        entry.id,
        {
          title: entry.title,
          sourcePath: entry.sourcePath,
          tags: [...entry.tags],
          testIds: [...entry.testIds]
        }
      ])
    )
  };
}
export function mapIndex(
  errors: readonly {
    code: string;
    message: string;
    path: string | null;
    stateId: string | null;
  }[]
): TestEvidenceDiagnostic[] {
  return errors.map((entry) =>
    diagnostic(
      "index",
      entry.code,
      `${entry.message}. Run sync-index --write to rebuild ${testEvidenceIndexPath}`,
      {
        caseId: entry.stateId ?? undefined,
        path: entry.path ?? testEvidenceIndexPath
      }
    )
  );
}

export async function validateTestEvidence(options: { workspaceRoot: string }) {
  const source = await readCases(options.workspaceRoot);
  const diagnostics = [...source.diagnostics];
  if (source.revision !== null)
    diagnostics.push(
      ...(
        await syncTestEvidenceIndex({
          workspaceRoot: options.workspaceRoot,
          mode: "check"
        })
      ).diagnostics
    );
  return {
    schemaVersion: testEvidenceSchemaVersion,
    diagnostics,
    casePath: "docs/test-evidence/cases",
    indexPath: testEvidenceIndexPath,
    sourceRevision: source.revision,
    summary: {
      cases: source.cases.length,
      tags: new Set(source.cases.flatMap((entry) => entry.case.tags)).size,
      references: source.cases.reduce(
        (total, entry) => total + entry.case.testIds.length,
        0
      )
    }
  };
}
export async function syncTestEvidenceIndex(options: {
  workspaceRoot: string;
  mode: "check" | "write";
  selectedCaseIds?: readonly string[];
}) {
  const source = await readCases(options.workspaceRoot);
  if (source.revision === null) return sourceFailure(source.diagnostics, null);
  const selected = options.selectedCaseIds;
  if (
    selected !== undefined &&
    (selected.length === 0 ||
      new Set(selected).size !== selected.length ||
      selected.some((id) => !v.safeParse(testEvidenceCaseIdSchema, id).success))
  )
    return sourceFailure(
      [
        diagnostic(
          "index",
          "index.selection-invalid",
          "selected Case IDs must be non-empty, unique, and valid"
        )
      ],
      source.revision
    );
  const runtime = createStateIndexRuntime({
    definition: definition(snapshotFromSource(source)),
    indexPath: testEvidenceIndexPath,
    root: path.resolve(options.workspaceRoot)
  });
  const scope: StateIndexSyncScope =
    selected === undefined
      ? { kind: "all" }
      : { kind: "selected", selectedIds: [...selected].sort() };
  const result = await runtime.sync(options.mode, scope);
  return {
    schemaVersion: testEvidenceSchemaVersion,
    status: result.status,
    state: result.state === "mode-invalid" ? "source-invalid" : result.state,
    changed: result.changed,
    diagnostics: mapIndex(result.diagnostics),
    indexPath: testEvidenceIndexPath,
    sourceRevision: source.revision,
    selectedIds: result.selectedIds
  };
}
function sourceFailure(
  diagnostics: readonly TestEvidenceDiagnostic[],
  sourceRevision: Awaited<ReturnType<typeof readCases>>["revision"]
) {
  return {
    schemaVersion: testEvidenceSchemaVersion,
    status: "error" as const,
    state: "source-invalid" as const,
    changed: false,
    diagnostics,
    indexPath: testEvidenceIndexPath,
    sourceRevision
  };
}

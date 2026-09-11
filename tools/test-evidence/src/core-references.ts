import path from "node:path";
import * as v from "valibot";
import { createStateIndexRuntime } from "../../index-runtime/src/index.ts";
import {
  expectedSourceSchema,
  snapshotSchema,
  testEvidenceCaseIdSchema,
  testEvidenceIndexPath,
  testEvidenceSchemaVersion,
  type ExpectedSource
} from "./core-schemas.ts";
import { definition } from "./core-index.ts";
import { diagnostic, fingerprint } from "./core-support.ts";
import { readCases } from "./core-source.ts";

export async function validateTestEvidenceReferences(options: {
  workspaceRoot: string;
  snapshot: unknown;
  expectedSource: ExpectedSource;
  caseIds?: readonly string[];
}) {
  const source = await readCases(options.workspaceRoot);
  const base = referenceBase(options.expectedSource);
  if (source.revision === null)
    return referenceFailure(base, "case-invalid", source.diagnostics);
  const selected = selectCases(source.cases, options.caseIds);
  if (selected === null) return invalidCaseSelection(base);
  const snapshot = v.safeParse(snapshotSchema, options.snapshot);
  if (!snapshot.success) return invalidSnapshot(base);
  const common = observedReferenceBase(base, snapshot.output, selected);
  if (!matchesExpectedSource(options.expectedSource, snapshot.output.source))
    return sourceMismatch(common);
  if (snapshot.output.completeness !== "complete")
    return incompleteSnapshot(common);
  return checkedReferences(common, selected, snapshot.output.entities);
}
type ReferenceBase = Readonly<{
  checkedCaseIds: string[];
  checkedReferenceCount: number;
  expectedSource: ExpectedSource | null;
  observedSource: ExpectedSource | null;
  schemaVersion: typeof testEvidenceSchemaVersion;
  snapshotFingerprint: string | null;
}>;
function referenceBase(expectedSource: ExpectedSource): ReferenceBase {
  return {
    schemaVersion: testEvidenceSchemaVersion,
    expectedSource: expectedSource ?? null,
    observedSource: null,
    snapshotFingerprint: null,
    checkedCaseIds: [],
    checkedReferenceCount: 0
  };
}
function referenceFailure(
  base: ReferenceBase,
  state:
    | "case-invalid"
    | "references-invalid"
    | "snapshot-incomplete"
    | "snapshot-invalid"
    | "source-mismatch",
  diagnostics: readonly ReturnType<typeof diagnostic>[]
) {
  return { ...base, status: "error" as const, state, diagnostics };
}
function invalidCaseSelection(base: ReferenceBase) {
  return referenceFailure(base, "case-invalid", [
    diagnostic(
      "case",
      "case.selection-invalid",
      "selected Case IDs must be non-empty, unique, and known"
    )
  ]);
}
function invalidSnapshot(base: ReferenceBase) {
  return referenceFailure(base, "snapshot-invalid", [
    diagnostic(
      "snapshot",
      "snapshot.invalid",
      "snapshot does not match schemaVersion 2"
    )
  ]);
}
function observedReferenceBase(
  base: ReferenceBase,
  snapshot: v.InferOutput<typeof snapshotSchema>,
  selected: Awaited<ReturnType<typeof readCases>>["cases"]
): ReferenceBase {
  return {
    ...base,
    observedSource: snapshot.source,
    snapshotFingerprint: fingerprint(JSON.stringify(snapshot)),
    checkedCaseIds: selected.map((entry) => entry.case.id)
  };
}
function matchesExpectedSource(
  expectedSource: ExpectedSource,
  observedSource: ExpectedSource
): boolean {
  const expected = v.safeParse(expectedSourceSchema, expectedSource);
  return (
    expected.success &&
    Object.entries(expected.output).every(
      ([key, value]) => observedSource[key as keyof ExpectedSource] === value
    )
  );
}
function sourceMismatch(base: ReferenceBase) {
  return referenceFailure(base, "source-mismatch", [
    diagnostic(
      "snapshot",
      "snapshot.source-mismatch",
      "snapshot source does not match expectedSource"
    )
  ]);
}
function incompleteSnapshot(base: ReferenceBase) {
  return referenceFailure(base, "snapshot-incomplete", [
    diagnostic(
      "snapshot",
      "snapshot.incomplete",
      "partial snapshots cannot validate references"
    )
  ]);
}
function checkedReferences(
  base: ReferenceBase,
  selected: Awaited<ReturnType<typeof readCases>>["cases"],
  entities: readonly v.InferOutput<typeof snapshotSchema>["entities"][number][]
) {
  const missing = missingReferences(selected, entities);
  if (missing.length > 0)
    return referenceFailure(base, "references-invalid", missing);
  return {
    ...base,
    status: "ok" as const,
    state: "valid" as const,
    checkedReferenceCount: selected.reduce(
      (count, entry) => count + entry.case.testIds.length,
      0
    ),
    diagnostics: []
  };
}
function missingReferences(
  selected: Awaited<ReturnType<typeof readCases>>["cases"],
  entities: readonly v.InferOutput<typeof snapshotSchema>["entities"][number][]
) {
  const known = new Set(entities.map((entity) => entity.id));
  return selected.flatMap((entry) =>
    entry.case.testIds
      .filter((id) => !known.has(id))
      .map((testId) =>
        diagnostic(
          "reference",
          "reference.entity-missing",
          `${entry.case.id} references missing entity ${testId}`,
          { caseId: entry.case.id, testId, path: entry.case.sourcePath }
        )
      )
  );
}
function selectCases(
  cases: Awaited<ReturnType<typeof readCases>>["cases"],
  ids: readonly string[] | undefined
) {
  if (ids === undefined) return cases;
  const selected = cases.filter((entry) => ids.includes(entry.case.id));
  return ids.length === 0 ||
    new Set(ids).size !== ids.length ||
    selected.length !== ids.length
    ? null
    : selected;
}
export async function stageTestEvidenceIndex(options: {
  workspaceRoot: string;
  caseIds: readonly string[];
}) {
  if (
    options.caseIds.length === 0 ||
    new Set(options.caseIds).size !== options.caseIds.length ||
    options.caseIds.some(
      (id) => !v.safeParse(testEvidenceCaseIdSchema, id).success
    )
  )
    return {
      status: "error" as const,
      state: "selection-invalid" as const,
      diagnostics: [
        diagnostic(
          "index",
          "index.selection-invalid",
          "stage-index requires non-empty unique Case IDs"
        )
      ]
    };
  const runtime = createStateIndexRuntime({
    definition: definition(),
    indexPath: testEvidenceIndexPath,
    root: path.resolve(options.workspaceRoot)
  });
  return await runtime.stageSelectedEntries(options.caseIds);
}

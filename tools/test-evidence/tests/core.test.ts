import {
  queryTestEvidence,
  listTestEvidenceTags,
  searchTestEvidence,
  showTestEvidenceCase,
  stageTestEvidenceIndex,
  syncTestEvidenceIndex,
  validateTestEvidence,
  validateTestEvidenceReferences
} from "../src/core.ts";
import type {
  ListTestEvidenceTagsResult,
  QueryTestEvidenceResult,
  SearchTestEvidenceResult,
  ShowTestEvidenceCaseResult,
  StageTestEvidenceIndexResult,
  SyncTestEvidenceIndexResult,
  TestEvidenceReferenceResult,
  ValidateTestEvidenceResult
} from "../api/test-evidence-catalog.d.mts";
declare const publicSearchTestEvidence: typeof import("../api/test-evidence-catalog.d.mts").searchTestEvidence;

const publicSearchTypeCheck = (): void => {
  const result: Promise<SearchTestEvidenceResult> = publicSearchTestEvidence({
    workspaceRoot: ".",
    text: "needle"
  });
  void result.then((value) => {
    void value.cases[0]?.previews[0]?.ranges[0]?.start;
    // @ts-expect-error The public search result does not permit untyped fields.
    void value.notAResultField;
  });
};
void publicSearchTypeCheck;

const publicApiTypeCheck = (): void => {
  const root = ".";
  const source = { projectId: "project", scopeId: "scope", revision: "r1" };
  const validation: Promise<ValidateTestEvidenceResult> = validateTestEvidence({
    workspaceRoot: root
  });
  const references: Promise<TestEvidenceReferenceResult> =
    validateTestEvidenceReferences({
      workspaceRoot: root,
      snapshot: null,
      expectedSource: source
    });
  const query: Promise<QueryTestEvidenceResult> = queryTestEvidence({
    workspaceRoot: root
  });
  const tags: Promise<ListTestEvidenceTagsResult> = listTestEvidenceTags({
    workspaceRoot: root
  });
  const shown: Promise<ShowTestEvidenceCaseResult> = showTestEvidenceCase({
    workspaceRoot: root,
    caseId: "CASE-TYPE-CHECK-001"
  });
  const searched: Promise<SearchTestEvidenceResult> = searchTestEvidence({
    workspaceRoot: root,
    text: "needle"
  });
  const synced: Promise<SyncTestEvidenceIndexResult> = syncTestEvidenceIndex({
    workspaceRoot: root,
    mode: "check"
  });
  const staged: Promise<StageTestEvidenceIndexResult> = stageTestEvidenceIndex({
    workspaceRoot: root,
    caseIds: ["CASE-TYPE-CHECK-001"]
  });
  void [validation, references, query, tags, shown, searched, synced, staged];
};
void publicApiTypeCheck;

await import("./core-query.test.ts");
await import("./core-index.test.ts");
await import("./core-cli-search.test.ts");
await import("./core-sync.test.ts");
await import("./core-stage.test.ts");

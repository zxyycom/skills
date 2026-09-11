import assert from "node:assert/strict";
import os from "node:os";
import test from "node:test";
import * as v from "valibot";
import {
  listTestEvidenceTags,
  queryTestEvidence,
  searchTestEvidence,
  showTestEvidenceCase,
  syncTestEvidenceIndex,
  validateTestEvidence,
  validateTestEvidenceReferences
} from "../src/core.ts";
import {
  testEvidenceQueryResultSchema,
  testEvidenceReportSchema,
  testEvidenceSearchResultSchema,
  testEvidenceShowResultSchema,
  testEvidenceSyncResultSchema,
  testEvidenceTagsResultSchema
} from "../src/core-schemas.ts";
import { fixture, fs, path } from "./core-test-support.ts";

test("Case-only index queries and tags do not need a snapshot", async () => {
  const root = await fixture();
  const sync = await syncTestEvidenceIndex({
    workspaceRoot: root,
    mode: "write"
  });
  assert.equal(sync.status, "ok");
  assert.ok(v.safeParse(testEvidenceSyncResultSchema, sync).success);
  const list = await queryTestEvidence({
    workspaceRoot: root,
    tags: ["access-control"]
  });
  assert.deepEqual(
    list.cases.map((entry) => entry.id),
    ["AUTH-ROLE-ACCESS-001"]
  );
  assert.ok(v.safeParse(testEvidenceQueryResultSchema, list).success);
  const tags = await listTestEvidenceTags({ workspaceRoot: root });
  assert.deepEqual(tags.tags, [
    { tag: "access-control", caseCount: 1 },
    { tag: "security", caseCount: 1 }
  ]);
  assert.ok(v.safeParse(testEvidenceTagsResultSchema, tags).success);
  assert.ok(
    v.safeParse(
      testEvidenceReportSchema,
      await validateTestEvidence({ workspaceRoot: root })
    ).success
  );
  assert.ok(
    v.safeParse(
      testEvidenceShowResultSchema,
      await showTestEvidenceCase({
        workspaceRoot: root,
        caseId: "AUTH-ROLE-ACCESS-001"
      })
    ).success
  );
  assert.ok(
    v.safeParse(
      testEvidenceSearchResultSchema,
      await searchTestEvidence({ workspaceRoot: root, text: "permission" })
    ).success
  );
});
test("show detects source replacement and search reads authoritative Case text", async () => {
  const root = await fixture();
  await syncTestEvidenceIndex({ workspaceRoot: root, mode: "write" });
  assert.equal(
    (
      await showTestEvidenceCase({
        workspaceRoot: root,
        caseId: "AUTH-ROLE-ACCESS-001"
      })
    ).case?.title,
    "access is rejected"
  );
  const search = await searchTestEvidence({
    workspaceRoot: root,
    text: "permission"
  });
  assert.equal(search.total, 1);
  await fs.appendFile(
    path.join(root, "docs/test-evidence/cases/access.md"),
    "\n"
  );
  assert.equal(
    (
      await showTestEvidenceCase({
        workspaceRoot: root,
        caseId: "AUTH-ROLE-ACCESS-001"
      })
    ).case,
    null
  );
});
test("reference validation has explicit snapshot states and allows unreferenced entities", async () => {
  const root = await fixture();
  const source = {
    projectId: "skills",
    scopeId: "registered-tests",
    revision: "r1"
  };
  const snapshot = {
    schemaVersion: 2,
    source,
    completeness: "complete",
    entities: [
      { id: "test:access", name: "access", locators: ["a"] },
      { id: "test:other", name: "other", locators: ["z"] },
      { id: "test:shared", name: "shared", locators: ["s"] }
    ]
  };
  const result = await validateTestEvidenceReferences({
    workspaceRoot: root,
    snapshot,
    expectedSource: source
  });
  assert.equal(result.state, "valid");
  assert.equal(result.checkedReferenceCount, 3);
  assert.equal(
    (
      await validateTestEvidenceReferences({
        workspaceRoot: root,
        snapshot: { ...snapshot, completeness: "partial" },
        expectedSource: source
      })
    ).state,
    "snapshot-incomplete"
  );
  assert.equal(
    (
      await validateTestEvidenceReferences({
        workspaceRoot: root,
        snapshot: { ...snapshot, entities: snapshot.entities.slice(0, 1) },
        expectedSource: source
      })
    ).state,
    "references-invalid"
  );
  const emptyRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "test-evidence-empty-")
  );
  await fs.mkdir(path.join(emptyRoot, "docs/test-evidence/cases"), {
    recursive: true
  });
  assert.equal(
    (
      await validateTestEvidenceReferences({
        workspaceRoot: emptyRoot,
        snapshot: { ...snapshot, entities: [] },
        expectedSource: source
      })
    ).state,
    "valid"
  );
});
test("Case validation rejects a duplicate ID", async () => {
  const root = await fixture();
  await fs.copyFile(
    path.join(root, "docs/test-evidence/cases/access.md"),
    path.join(root, "docs/test-evidence/cases/duplicate.md")
  );
  await fs.writeFile(
    path.join(root, "docs/test-evidence/cases/not_a_case.md"),
    "unsupported member\n"
  );
  await fs.writeFile(
    path.join(root, "docs/test-evidence/cases/broken.md"),
    new Uint8Array([0xff])
  );
  await fs.writeFile(
    path.join(root, "docs/test-evidence/unexpected.json"),
    "{}\n"
  );
  const report = await validateTestEvidence({ workspaceRoot: root });
  assert.ok(
    report.diagnostics.some((entry) => entry.code === "case.id-duplicate")
  );
  assert.ok(
    report.diagnostics.some((entry) => entry.code === "case.member-unsupported")
  );
  assert.ok(
    report.diagnostics.some((entry) => entry.code === "case.read-failed")
  );
  assert.ok(
    report.diagnostics.some(
      (entry) => entry.code === "case.root-member-unsupported"
    )
  );
});
test("Case grammar requires a first-line fixed ID and one complete Case", async () => {
  const root = await fixture();
  const cases = path.join(root, "docs/test-evidence/cases");
  await fs.writeFile(
    path.join(cases, "leading.md"),
    "\n### Case GRAMMAR-FIRST-LINE-001: misplaced heading\n\nTests:\n- `test:grammar`\n\nContract:\n- fixed grammar\n\nProves:\n- rejection\n"
  );
  await fs.writeFile(
    path.join(cases, "invalid-id.md"),
    "### Case invalid: invalid ID\n\nTests:\n- `test:grammar`\n\nContract:\n- fixed grammar\n\nProves:\n- rejection\n"
  );
  await fs.writeFile(
    path.join(cases, "multiple.md"),
    "### Case GRAMMAR-MULTIPLE-CASE-001: first Case\n\nTests:\n- `test:grammar`\n\nContract:\n- fixed grammar\n\nProves:\n- rejection\n\n### Case GRAMMAR-MULTIPLE-CASE-002: second Case\n"
  );
  await fs.writeFile(
    path.join(cases, "legacy-entry.md"),
    "### Case GRAMMAR-LEGACY-ENTRY-001: legacy fields\n\nEntry:\n- `tests/legacy.test.ts > legacy registration`\n\nContract:\n- fixed grammar\n\nProves:\n- rejection\n"
  );
  await fs.writeFile(
    path.join(cases, "missing-proves.md"),
    "### Case GRAMMAR-MISSING-PROVES-001: missing required section\n\nTests:\n- `test:grammar`\n\nContract:\n- fixed grammar\n"
  );
  await fs.writeFile(
    path.join(cases, "unordered.md"),
    "### Case GRAMMAR-UNORDERED-CASE-001: unordered sections\n\nContract:\n- fixed grammar\n\nTests:\n- `test:grammar`\n\nProves:\n- rejection\n"
  );
  const report = await validateTestEvidence({ workspaceRoot: root });
  assert.ok(
    report.diagnostics.filter((entry) => entry.code === "case.heading-invalid")
      .length >= 2
  );
  assert.ok(
    report.diagnostics.some(
      (entry) => entry.code === "case.content-unsupported"
    )
  );
  for (const path of [
    "cases/legacy-entry.md",
    "cases/missing-proves.md",
    "cases/unordered.md"
  ])
    assert.ok(
      report.diagnostics.some(
        (entry) => entry.code === "case.section-invalid" && entry.path === path
      ),
      JSON.stringify(report)
    );
});
test("moving a Case preserves its ID while changing only its entry revision", async () => {
  const root = await fixture();
  const indexPath = path.join(
    root,
    "docs/test-evidence/test-evidence-index.json"
  );
  await syncTestEvidenceIndex({ workspaceRoot: root, mode: "write" });
  const before = JSON.parse(await fs.readFile(indexPath, "utf8"));
  await fs.rename(
    path.join(root, "docs/test-evidence/cases/access.md"),
    path.join(root, "docs/test-evidence/cases/moved.md")
  );
  await syncTestEvidenceIndex({ workspaceRoot: root, mode: "write" });
  const after = JSON.parse(await fs.readFile(indexPath, "utf8"));
  assert.equal(
    after.entries["AUTH-ROLE-ACCESS-001"].sourcePath,
    "cases/moved.md"
  );
  assert.equal(after.sourceRevision.metadata, before.sourceRevision.metadata);
  assert.notEqual(
    after.sourceRevision.entries["AUTH-ROLE-ACCESS-001"],
    before.sourceRevision.entries["AUTH-ROLE-ACCESS-001"]
  );
  assert.equal(
    after.sourceRevision.entries["AUTH-ROLE-ACCESS-002"],
    before.sourceRevision.entries["AUTH-ROLE-ACCESS-002"]
  );
  assert.equal(
    (
      await showTestEvidenceCase({
        workspaceRoot: root,
        caseId: "AUTH-ROLE-ACCESS-001"
      })
    ).case?.sourcePath,
    "cases/moved.md"
  );
});
test("Case revisions normalize CRLF and isolate membership changes", async () => {
  const root = await fixture();
  const indexPath = path.join(
    root,
    "docs/test-evidence/test-evidence-index.json"
  );
  await syncTestEvidenceIndex({ workspaceRoot: root, mode: "write" });
  const before = JSON.parse(await fs.readFile(indexPath, "utf8"));
  const accessPath = path.join(root, "docs/test-evidence/cases/access.md");
  await fs.writeFile(
    accessPath,
    (await fs.readFile(accessPath, "utf8")).replace(/\n/gu, "\r\n")
  );
  await syncTestEvidenceIndex({ workspaceRoot: root, mode: "write" });
  const crlf = JSON.parse(await fs.readFile(indexPath, "utf8"));
  assert.deepEqual(crlf.sourceRevision, before.sourceRevision);

  await fs.writeFile(
    path.join(root, "docs/test-evidence/cases/third.md"),
    "### Case AUTH-ROLE-ACCESS-003: added intent\n\nTests:\n- `test:added`\n\nContract:\n- addition is explicit\n\nProves:\n- membership changes\n"
  );
  await syncTestEvidenceIndex({ workspaceRoot: root, mode: "write" });
  const added = JSON.parse(await fs.readFile(indexPath, "utf8"));
  assert.ok(added.sourceRevision.entries["AUTH-ROLE-ACCESS-003"]);
  assert.equal(
    added.sourceRevision.entries["AUTH-ROLE-ACCESS-001"],
    before.sourceRevision.entries["AUTH-ROLE-ACCESS-001"]
  );
  assert.equal(
    added.sourceRevision.entries["AUTH-ROLE-ACCESS-002"],
    before.sourceRevision.entries["AUTH-ROLE-ACCESS-002"]
  );
  await fs.rm(path.join(root, "docs/test-evidence/cases/third.md"));
  await syncTestEvidenceIndex({ workspaceRoot: root, mode: "write" });
  const removed = JSON.parse(await fs.readFile(indexPath, "utf8"));
  assert.equal(
    removed.sourceRevision.entries["AUTH-ROLE-ACCESS-003"],
    undefined
  );
});

test("index keys are fixed Case IDs and states cannot repeat their identity", async () => {
  const root = await fixture();
  const indexPath = path.join(
    root,
    "docs/test-evidence/test-evidence-index.json"
  );
  await syncTestEvidenceIndex({ workspaceRoot: root, mode: "write" });
  const invalidKey = JSON.parse(await fs.readFile(indexPath, "utf8"));
  invalidKey.entries["not-a-case-id"] =
    invalidKey.entries["AUTH-ROLE-ACCESS-001"];
  invalidKey.sourceRevision.entries["not-a-case-id"] =
    invalidKey.sourceRevision.entries["AUTH-ROLE-ACCESS-001"];
  await fs.writeFile(indexPath, `${JSON.stringify(invalidKey)}\n`);
  const invalidKeyResult = await queryTestEvidence({ workspaceRoot: root });
  assert.equal(invalidKeyResult.total, 0);
  assert.ok(invalidKeyResult.diagnostics.some((entry) => entry.blocking));

  await syncTestEvidenceIndex({ workspaceRoot: root, mode: "write" });
  const redundantId = JSON.parse(await fs.readFile(indexPath, "utf8"));
  redundantId.entries["AUTH-ROLE-ACCESS-001"].id = "AUTH-ROLE-ACCESS-001";
  await fs.writeFile(indexPath, `${JSON.stringify(redundantId)}\n`);
  const redundantIdResult = await queryTestEvidence({ workspaceRoot: root });
  assert.equal(redundantIdResult.total, 0);
  assert.ok(redundantIdResult.diagnostics.some((entry) => entry.blocking));
});

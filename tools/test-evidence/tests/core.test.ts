import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import test from "node:test";
import * as v from "valibot";
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
import { runTestEvidenceCatalogCli } from "../src/cli.ts";
import {
  testEvidenceQueryResultSchema,
  testEvidenceReferenceResultSchema,
  testEvidenceReportSchema,
  testEvidenceSearchResultSchema,
  testEvidenceShowResultSchema,
  testEvidenceStageResultSchema,
  testEvidenceSyncResultSchema,
  testEvidenceTagsResultSchema
} from "../src/core-schemas.ts";
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
const exec = promisify(execFile);

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

async function fixture(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "test-evidence-core-"));
  const cases = path.join(root, "docs/test-evidence/cases");
  await fs.mkdir(cases, { recursive: true });
  await fs.writeFile(
    path.join(cases, "access.md"),
    "### Case AUTH-ROLE-ACCESS-001: access is rejected\n\nTests:\n- `test:access`\n- `test:shared`\n\nTags:\n- `access-control`\n- `security`\n\nContract:\n- access requires permission\n\nProves:\n- rejection is observable\n"
  );
  await fs.writeFile(
    path.join(cases, "second.md"),
    "### Case AUTH-ROLE-ACCESS-002: shared intent\n\nTests:\n- `test:shared`\n\nContract:\n- shared behavior is stable\n\nProves:\n- result is observable\n"
  );
  return root;
}

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
test("indexed Case filters use tag AND, exact test, lexical order, and paging at scale", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "test-evidence-scale-"));
  const cases = path.join(root, "docs/test-evidence/cases");
  await fs.mkdir(cases, { recursive: true });
  await Promise.all(
    Array.from({ length: 1000 }, async (_, index) => {
      const id = String(index).padStart(3, "0");
      await fs.writeFile(
        path.join(cases, `case-${id}.md`),
        `### Case SCALE-CASE-ENTRY-${id}: scale ${id}\n\nTests:\n- \`test:${id}\`\n\nTags:\n- \`alpha\`\n${index % 2 === 0 ? "- `even`\n" : ""}\nContract:\n- scalable query\n\nProves:\n- ordered result\n`
      );
    })
  );
  assert.equal(
    (await syncTestEvidenceIndex({ workspaceRoot: root, mode: "write" }))
      .status,
    "ok"
  );
  const result = await queryTestEvidence({
    workspaceRoot: root,
    tags: ["alpha", "even"],
    testId: "test:010",
    limit: 1,
    offset: 0
  });
  assert.equal(result.total, 1);
  assert.equal(result.cases[0]?.id, "SCALE-CASE-ENTRY-010");
  const page = await queryTestEvidence({
    workspaceRoot: root,
    tags: ["alpha"],
    limit: 3,
    offset: 10
  });
  assert.deepEqual(
    page.cases.map((entry) => entry.id),
    ["SCALE-CASE-ENTRY-010", "SCALE-CASE-ENTRY-011", "SCALE-CASE-ENTRY-012"]
  );
});
test("list and tags only load the index while show reads only its selected Case", async () => {
  const root = await fixture();
  await syncTestEvidenceIndex({ workspaceRoot: root, mode: "write" });
  await fs.rm(path.join(root, "docs/test-evidence/cases/second.md"));
  assert.equal(
    (
      await showTestEvidenceCase({
        workspaceRoot: root,
        caseId: "AUTH-ROLE-ACCESS-001"
      })
    ).case?.id,
    "AUTH-ROLE-ACCESS-001"
  );
  await fs.rename(
    path.join(root, "docs/test-evidence/cases"),
    path.join(root, "docs/test-evidence/cases-hidden")
  );
  assert.equal((await queryTestEvidence({ workspaceRoot: root })).total, 2);
  assert.deepEqual(
    (await listTestEvidenceTags({ workspaceRoot: root })).tags.map(
      (entry) => entry.tag
    ),
    ["access-control", "security"]
  );
});
test(
  "10,000 indexed Cases retain exact filtering and paging",
  { timeout: 20_000 },
  async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "test-evidence-10k-"));
    const cases = path.join(root, "docs/test-evidence/cases");
    await fs.mkdir(cases, { recursive: true });
    for (let index = 0; index < 10_000; index += 1) {
      const id = String(index).padStart(5, "0");
      await fs.writeFile(
        path.join(cases, `case-${id}.md`),
        `### Case SCALE-LARGE-X${id}-000: large ${id}\n\nTests:\n- \`test:large-${id}\`\n\nTags:\n- \`large\`\n\nContract:\n- large index\n\nProves:\n- exact retrieval\n`
      );
    }
    assert.equal(
      (await syncTestEvidenceIndex({ workspaceRoot: root, mode: "write" }))
        .status,
      "ok"
    );
    const result = await queryTestEvidence({
      workspaceRoot: root,
      testId: "test:large-09999",
      limit: 1
    });
    assert.equal(result.total, 1);
    assert.equal(result.cases[0]?.id, "SCALE-LARGE-X09999-000");
  }
);

test("search includes matches after the index query page boundary", async () => {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), "test-evidence-search-")
  );
  const cases = path.join(root, "docs/test-evidence/cases");
  await fs.mkdir(cases, { recursive: true });
  for (let index = 0; index <= 1000; index += 1) {
    const id = String(index).padStart(3, "0");
    const body = index === 1000 ? "needle" : "filler";
    await fs.writeFile(
      path.join(cases, `candidate-${id}.md`),
      `### Case SEARCH-${String(index).padStart(4, "0")}-CANDIDATE-001: candidate ${id}\n\nTests:\n- \`test:search-${id}\`\n\nContract:\n- ${body}\n\nProves:\n- search scans every matching Case\n`
    );
  }
  assert.equal(
    (await syncTestEvidenceIndex({ workspaceRoot: root, mode: "write" }))
      .status,
    "ok"
  );
  const result = await searchTestEvidence({
    workspaceRoot: root,
    text: "needle"
  });
  assert.deepEqual(
    result.cases.map((entry) => entry.id),
    ["SEARCH-1000-CANDIDATE-001"]
  );
});

test("snapshot failure priorities reject malformed input, source mismatch, and unknown selection", async () => {
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
      { id: "test:shared", name: "shared", locators: ["s"] }
    ]
  };
  assert.equal(
    (
      await validateTestEvidenceReferences({
        workspaceRoot: root,
        snapshot: { ...snapshot, schemaVersion: 1 },
        expectedSource: source
      })
    ).state,
    "snapshot-invalid"
  );
  assert.equal(
    (
      await validateTestEvidenceReferences({
        workspaceRoot: root,
        snapshot,
        expectedSource: { ...source, revision: "wrong" }
      })
    ).state,
    "source-mismatch"
  );
  assert.equal(
    (
      await validateTestEvidenceReferences({
        workspaceRoot: root,
        snapshot,
        expectedSource: source,
        caseIds: ["AUTH-ROLE-ACCESS-999"]
      })
    ).state,
    "case-invalid"
  );
});
test("CLI writes domain failures as JSON stdout with a nonzero exit", async () => {
  const root = await fixture();
  const invoke = async (snapshot: string) => {
    const stdout: string[] = [];
    const stderr: string[] = [];
    const code = await runTestEvidenceCatalogCli(
      [
        "check-refs",
        "--root",
        root,
        "--snapshot",
        snapshot,
        "--expect-project",
        "skills",
        "--expect-scope",
        "registered-tests",
        "--expect-revision",
        "r1",
        "--json"
      ],
      {
        io: {
          stdout: (value) => stdout.push(value),
          stderr: (value) => stderr.push(value)
        }
      }
    );
    assert.equal(code, 1);
    assert.equal(stderr.join(""), "");
    const result = JSON.parse(stdout.join(""));
    assert.equal(result.state, "snapshot-invalid");
    assert.ok(v.safeParse(testEvidenceReferenceResultSchema, result).success);
  };
  await invoke("missing.json");
  await fs.writeFile(path.join(root, "invalid.json"), new Uint8Array([0xff]));
  await invoke("invalid.json");
  const oversized = path.join(root, "oversized.json");
  await fs.writeFile(oversized, "");
  await fs.truncate(oversized, 64 * 1024 * 1024 + 1);
  await invoke("oversized.json");
});
test("search blocks a Case body above the shared text-search resource limit", async () => {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), "test-evidence-resource-")
  );
  const cases = path.join(root, "docs/test-evidence/cases");
  await fs.mkdir(cases, { recursive: true });
  await fs.writeFile(
    path.join(cases, "large.md"),
    `### Case RESOURCE-LARGE-CASE-001: large body\n\nTests:\n- \`test:large\`\n\nContract:\n- needle ${"x".repeat(2 * 1024 * 1024)}\n\nProves:\n- bounded read\n`
  );
  assert.equal(
    (await syncTestEvidenceIndex({ workspaceRoot: root, mode: "write" }))
      .status,
    "ok"
  );
  const result = await searchTestEvidence({
    workspaceRoot: root,
    text: "needle"
  });
  assert.ok(
    result.diagnostics.some((entry) => entry.code === "search.resource-limit")
  );
});
test("selected staging uses the existing Git index boundary", async () => {
  const root = await fixture();
  await exec("git", ["init"], { cwd: root });
  await exec("git", ["config", "user.email", "test@example.invalid"], {
    cwd: root
  });
  await exec("git", ["config", "user.name", "Test"], { cwd: root });
  await syncTestEvidenceIndex({ workspaceRoot: root, mode: "write" });
  await exec("git", ["add", "."], { cwd: root });
  await exec("git", ["commit", "-m", "baseline"], { cwd: root });
  await fs.writeFile(path.join(root, "unrelated.txt"), "already staged\n");
  await exec("git", ["add", "unrelated.txt"], { cwd: root });
  const pendingUnrelated = await exec("git", ["show", ":unrelated.txt"], {
    cwd: root
  });
  await fs.appendFile(
    path.join(root, "docs/test-evidence/cases/access.md"),
    "\n"
  );
  await syncTestEvidenceIndex({ workspaceRoot: root, mode: "write" });
  const staged = await stageTestEvidenceIndex({
    workspaceRoot: root,
    caseIds: ["AUTH-ROLE-ACCESS-001"]
  });
  assert.equal(staged.status, "ok");
  assert.ok(v.safeParse(testEvidenceStageResultSchema, staged).success);
  const { stdout } = await exec("git", ["diff", "--cached", "--name-only"], {
    cwd: root
  });
  assert.deepEqual(stdout.trim().split("\n"), [
    "docs/test-evidence/test-evidence-index.json",
    "unrelated.txt"
  ]);
  assert.equal(
    (await exec("git", ["show", ":unrelated.txt"], { cwd: root })).stdout,
    pendingUnrelated.stdout
  );
});
test("Case hard-link identity conflicts are rejected", async () => {
  const root = await fixture();
  await fs.link(
    path.join(root, "docs/test-evidence/cases/access.md"),
    path.join(root, "docs/test-evidence/cases/linked.md")
  );
  const report = await validateTestEvidence({ workspaceRoot: root });
  assert.ok(
    report.diagnostics.some((entry) => entry.code === "case.identity-conflict")
  );
});
test("selected staging rejects a cross-definition index migration", async () => {
  const root = await fixture();
  await exec("git", ["init"], { cwd: root });
  await exec("git", ["config", "user.email", "test@example.invalid"], {
    cwd: root
  });
  await exec("git", ["config", "user.name", "Test"], { cwd: root });
  await syncTestEvidenceIndex({ workspaceRoot: root, mode: "write" });
  await exec("git", ["add", "."], { cwd: root });
  await exec("git", ["commit", "-m", "baseline"], { cwd: root });
  const indexPath = path.join(
    root,
    "docs/test-evidence/test-evidence-index.json"
  );
  const index = JSON.parse(await fs.readFile(indexPath, "utf8"));
  index.definitionVersion = 5;
  await fs.writeFile(indexPath, `${JSON.stringify(index, null, 2)}\n`);
  const staged = await stageTestEvidenceIndex({
    workspaceRoot: root,
    caseIds: ["AUTH-ROLE-ACCESS-001"]
  });
  assert.equal(staged.status, "error");
});
test("search rejects a Case source that changes during the authoritative read", async () => {
  const root = await fixture();
  await syncTestEvidenceIndex({ workspaceRoot: root, mode: "write" });
  const target = path.join(root, "docs/test-evidence/cases/access.md");
  const originalOpen = fs.open;
  let changed = false;
  const mutableFs = fs as { open: typeof fs.open };
  mutableFs.open = (async (...args: Parameters<typeof originalOpen>) => {
    const handle = await originalOpen(...args);
    if (path.resolve(String(args[0])) === target && !changed) {
      changed = true;
      await fs.appendFile(target, "\n");
    }
    return handle;
  }) as typeof fs.open;
  try {
    const result = await searchTestEvidence({
      workspaceRoot: root,
      text: "permission"
    });
    assert.equal(changed, true, "search did not open the authoritative source");
    assert.deepEqual(
      result.diagnostics.map((entry) => entry.code),
      ["state-index.source-changed"],
      JSON.stringify(result)
    );
  } finally {
    mutableFs.open = originalOpen;
  }
});

test("index synchronization distinguishes missing, written, and current snapshots", async () => {
  const root = await fixture();
  const missing = await syncTestEvidenceIndex({
    workspaceRoot: root,
    mode: "check"
  });
  assert.equal(missing.status, "error");
  assert.equal(missing.state, "index-missing");
  const written = await syncTestEvidenceIndex({
    workspaceRoot: root,
    mode: "write"
  });
  assert.equal(written.status, "ok");
  assert.equal(written.state, "written");
  const current = await syncTestEvidenceIndex({
    workspaceRoot: root,
    mode: "write"
  });
  assert.equal(current.status, "ok");
  assert.equal(current.state, "unchanged");
  assert.equal(current.changed, false);
});

test("unreadable indexes block list and show without a source fallback", async () => {
  const root = await fixture();
  await syncTestEvidenceIndex({ workspaceRoot: root, mode: "write" });
  await fs.writeFile(
    path.join(root, "docs/test-evidence/test-evidence-index.json"),
    new Uint8Array([0xff])
  );
  const listed = await queryTestEvidence({ workspaceRoot: root });
  const shown = await showTestEvidenceCase({
    workspaceRoot: root,
    caseId: "AUTH-ROLE-ACCESS-001"
  });
  assert.equal(listed.total, 0);
  assert.equal(shown.case, null);
  for (const result of [listed, shown])
    assert.ok(
      result.diagnostics.some(
        (entry) => entry.code === "state-index.index-encoding-invalid"
      ),
      JSON.stringify(result)
    );
});

test("selected sync validates every Case while updating only selected entries", async () => {
  const root = await fixture();
  const indexPath = path.join(
    root,
    "docs/test-evidence/test-evidence-index.json"
  );
  await syncTestEvidenceIndex({ workspaceRoot: root, mode: "write" });
  const before = JSON.parse(await fs.readFile(indexPath, "utf8"));
  await fs.appendFile(
    path.join(root, "docs/test-evidence/cases/access.md"),
    "\n"
  );
  const selected = await syncTestEvidenceIndex({
    workspaceRoot: root,
    mode: "write",
    selectedCaseIds: ["AUTH-ROLE-ACCESS-001"]
  });
  assert.equal(selected.status, "ok");
  const after = JSON.parse(await fs.readFile(indexPath, "utf8"));
  assert.notEqual(
    after.sourceRevision.entries["AUTH-ROLE-ACCESS-001"],
    before.sourceRevision.entries["AUTH-ROLE-ACCESS-001"]
  );
  assert.equal(
    after.sourceRevision.entries["AUTH-ROLE-ACCESS-002"],
    before.sourceRevision.entries["AUTH-ROLE-ACCESS-002"]
  );
  await fs.writeFile(
    path.join(root, "docs/test-evidence/cases/invalid.md"),
    "not a Case\n"
  );
  const invalid = await syncTestEvidenceIndex({
    workspaceRoot: root,
    mode: "write",
    selectedCaseIds: ["AUTH-ROLE-ACCESS-001"]
  });
  assert.equal(invalid.status, "error");
  assert.equal(invalid.state, "source-invalid");
});

test("selected sync rejects malformed Case IDs before writing an index", async () => {
  const root = await fixture();
  const indexPath = path.join(
    root,
    "docs/test-evidence/test-evidence-index.json"
  );
  await syncTestEvidenceIndex({ workspaceRoot: root, mode: "write" });
  const before = await fs.readFile(indexPath, "utf8");
  const result = await syncTestEvidenceIndex({
    workspaceRoot: root,
    mode: "write",
    selectedCaseIds: ["invalid selector"]
  });
  assert.equal(result.status, "error");
  assert.equal(result.state, "source-invalid");
  assert.ok(
    result.diagnostics.some((entry) => entry.code === "index.selection-invalid")
  );
  assert.equal(await fs.readFile(indexPath, "utf8"), before);
});

async function commitFixture(withIndex = true): Promise<string> {
  const root = await fixture();
  await exec("git", ["init"], { cwd: root });
  await exec("git", ["config", "user.email", "test@example.invalid"], {
    cwd: root
  });
  await exec("git", ["config", "user.name", "Test"], { cwd: root });
  if (withIndex)
    await syncTestEvidenceIndex({ workspaceRoot: root, mode: "write" });
  await exec("git", ["add", "."], { cwd: root });
  await exec("git", ["commit", "-m", "baseline"], { cwd: root });
  return root;
}

test("stage validates selection before Git and preserves an existing pending index", async () => {
  const root = await fixture();
  const invalid = await stageTestEvidenceIndex({
    workspaceRoot: root,
    caseIds: ["not-a-case-id"]
  });
  assert.equal(invalid.state, "selection-invalid");
  await assert.rejects(fs.lstat(path.join(root, ".git")));
  const unavailable = await stageTestEvidenceIndex({
    workspaceRoot: root,
    caseIds: ["AUTH-ROLE-ACCESS-001"]
  });
  assert.equal(unavailable.state, "revision-read-failed");
  await assert.rejects(
    fs.lstat(path.join(root, "docs/test-evidence/test-evidence-index.json"))
  );

  const stagedRoot = await commitFixture();
  await fs.appendFile(
    path.join(stagedRoot, "docs/test-evidence/cases/access.md"),
    "\n"
  );
  await syncTestEvidenceIndex({ workspaceRoot: stagedRoot, mode: "write" });
  const indexPath = "docs/test-evidence/test-evidence-index.json";
  await exec("git", ["add", indexPath], { cwd: stagedRoot });
  const pending = await exec("git", ["show", `:${indexPath}`], {
    cwd: stagedRoot
  });
  const conflict = await stageTestEvidenceIndex({
    workspaceRoot: stagedRoot,
    caseIds: ["AUTH-ROLE-ACCESS-001"]
  });
  assert.equal(conflict.state, "pending-conflict");
  assert.equal(
    (await exec("git", ["show", `:${indexPath}`], { cwd: stagedRoot })).stdout,
    pending.stdout
  );
});

test("stage overlays only selected Case revisions onto the Git baseline", async () => {
  const root = await commitFixture();
  const indexPath = "docs/test-evidence/test-evidence-index.json";
  const baseline = JSON.parse(
    (await exec("git", ["show", `HEAD:${indexPath}`], { cwd: root })).stdout
  );
  await fs.appendFile(
    path.join(root, "docs/test-evidence/cases/access.md"),
    "\n"
  );
  await fs.appendFile(
    path.join(root, "docs/test-evidence/cases/second.md"),
    "\n"
  );
  await syncTestEvidenceIndex({ workspaceRoot: root, mode: "write" });
  const staged = await stageTestEvidenceIndex({
    workspaceRoot: root,
    caseIds: ["AUTH-ROLE-ACCESS-001"]
  });
  assert.equal(staged.status, "ok");
  const overlay = JSON.parse(
    (await exec("git", ["show", `:${indexPath}`], { cwd: root })).stdout
  );
  assert.notEqual(
    overlay.sourceRevision.entries["AUTH-ROLE-ACCESS-001"],
    baseline.sourceRevision.entries["AUTH-ROLE-ACCESS-001"]
  );
  assert.equal(
    overlay.sourceRevision.entries["AUTH-ROLE-ACCESS-002"],
    baseline.sourceRevision.entries["AUTH-ROLE-ACCESS-002"]
  );
});

test("stage supports bootstrap, unchanged selections, missing IDs, and an empty target", async () => {
  const bootstrap = await commitFixture(false);
  await syncTestEvidenceIndex({ workspaceRoot: bootstrap, mode: "write" });
  const bootstrapped = await stageTestEvidenceIndex({
    workspaceRoot: bootstrap,
    caseIds: ["AUTH-ROLE-ACCESS-001"]
  });
  assert.equal(bootstrapped.status, "ok", JSON.stringify(bootstrapped));
  assert.deepEqual(
    Object.keys(
      JSON.parse(
        (
          await exec(
            "git",
            ["show", ":docs/test-evidence/test-evidence-index.json"],
            { cwd: bootstrap }
          )
        ).stdout
      ).entries
    ),
    ["AUTH-ROLE-ACCESS-001"]
  );

  const root = await commitFixture();
  const indexPath = "docs/test-evidence/test-evidence-index.json";
  const cachedBefore = await exec("git", ["show", `:${indexPath}`], {
    cwd: root
  });
  const workingBefore = await fs.readFile(path.join(root, indexPath), "utf8");
  const unchanged = await stageTestEvidenceIndex({
    workspaceRoot: root,
    caseIds: ["AUTH-ROLE-ACCESS-001"]
  });
  assert.equal(unchanged.status, "ok");
  assert.equal(unchanged.state, "unchanged");
  assert.equal(
    (await exec("git", ["diff", "--cached", "--name-only"], { cwd: root }))
      .stdout,
    ""
  );
  const missing = await stageTestEvidenceIndex({
    workspaceRoot: root,
    caseIds: ["AUTH-ROLE-ACCESS-999"]
  });
  assert.equal(missing.state, "selection-invalid");
  assert.ok(
    missing.diagnostics.some(
      (entry) => entry.code === "state-index.selected-id-missing"
    )
  );
  assert.equal(
    await fs.readFile(path.join(root, indexPath), "utf8"),
    workingBefore
  );
  assert.equal(
    (await exec("git", ["show", `:${indexPath}`], { cwd: root })).stdout,
    cachedBefore.stdout
  );

  await fs.rm(path.join(root, "docs/test-evidence/cases/access.md"));
  await fs.rm(path.join(root, "docs/test-evidence/cases/second.md"));
  await syncTestEvidenceIndex({ workspaceRoot: root, mode: "write" });
  const emptied = await stageTestEvidenceIndex({
    workspaceRoot: root,
    caseIds: ["AUTH-ROLE-ACCESS-001", "AUTH-ROLE-ACCESS-002"]
  });
  assert.equal(emptied.status, "ok");
  const emptyIndex = JSON.parse(
    (
      await exec(
        "git",
        ["show", ":docs/test-evidence/test-evidence-index.json"],
        { cwd: root }
      )
    ).stdout
  );
  assert.deepEqual(emptyIndex.entries, {});
});

import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Ajv2020 } from "ajv/dist/2020.js";
import * as v from "valibot";
import { createStateIndexRuntime } from "../../index-runtime/src/index.ts";
import {
  listTestEvidenceTopics,
  queryTestEvidence,
  runTestEvidenceCatalogCli,
  showTestEvidenceCase,
  syncTestEvidenceIndex,
  testEvidenceStateIndexSchema,
  testEvidenceTopicCatalogSchema,
  type TestEvidenceStateIndex,
  type TestEvidenceTopicCatalog,
  validateTestEvidence
} from "../src/cli.ts";
import { createTestEvidenceStateIndexDefinition } from "../src/state-index.ts";
import { testEvidenceSourceRevision } from "../src/source-revision.ts";

const execFileAsync = promisify(execFile);
const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  ".."
);
const distributedScript = path.join(
  repositoryRoot,
  "skills",
  "test-evidence-review",
  "scripts",
  "test-evidence-catalog.mjs"
);
const topicCatalog = `${JSON.stringify(
  {
    schemaVersion: 1,
    topics: [
      {
        id: "access-control",
        description: "Access-control contract tests."
      },
      {
        id: "future-work",
        description: "Reserved future test responsibilities."
      },
      {
        id: "sessions",
        description: "Session lifecycle contract tests."
      }
    ]
  },
  null,
  2
)}\n`;
const accessCatalog = [
  "### Case AUTH-ROLE-ACCESS-001: Access tests cover role outcomes",
  "",
  "Entry:",
  "- `tests/access.test.ts > enforces role outcomes`",
  '- `bun test tests/access.test.ts --test-name-pattern "enforces role outcomes"`',
  "",
  "Contract:",
  "- Resource mutation follows the caller role boundary.",
  "- Rejected mutations leave the resource unchanged.",
  "",
  "Proves:",
  "- Owners can edit.",
  "- Guests are denied.",
  "",
  "```markdown",
  "### Case IGNORED-EXAMPLE-CASE-001: Fenced examples are not cases",
  "```",
  ""
].join("\n");
const sessionCatalog = [
  "### Case AUTH-SESSION-EXPIRY-001: Session tests cover expiry outcomes",
  "",
  "Entry:",
  "- `tests/session-expiry.test.ts > rejects expired sessions`",
  '- `bun test tests/session-expiry.test.ts --test-name-pattern "rejects expired sessions"`',
  "",
  "Contract:",
  "- Expired sessions cannot access protected resources.",
  "",
  "Proves:",
  "- Expired sessions are rejected.",
  ""
].join("\n");

test("catalog ignores legacy config files and rejects config arguments", async () => {
  await withWorkspace(async (tempRoot) => {
    await writeWorkspaceFile(
      tempRoot,
      ".test-evidence.json",
      `${JSON.stringify(
        {
          schemaVersion: 3,
          catalogPath: "elsewhere",
          indexPath: "elsewhere/index.json",
          caseIdPattern: "^CUSTOM$"
        },
        null,
        2
      )}\n`
    );
    await writeTopicCatalog(tempRoot, "elsewhere", [
      {
        id: "ignored",
        description: "Ignored legacy configuration target."
      }
    ]);

    const queried = await queryTestEvidence({ workspaceRoot: tempRoot });
    assert.equal(queried.total, 2);
    assert.equal(queried.catalogPath, "docs/test-evidence");
    assert.equal(
      queried.indexPath,
      "docs/test-evidence/test-evidence-index.json"
    );

    const fromInjectedCwd = await runCatalogCliJson<{ total: number }>(
      ["list", "--root", ".", "--json"],
      tempRoot
    );
    assert.equal(fromInjectedCwd.total, 2);

    const rejected = await runCatalogCliFailure([
      "list",
      "--root",
      tempRoot,
      "--config",
      ".test-evidence.json"
    ]);
    assert.equal(rejected.code, 2);
    assert.match(rejected.stderr, /unknown option '--config'/u);
  });
});

test("catalog enforces the fixed case ID pattern", async () => {
  await withWorkspace(async (tempRoot) => {
    await writeWorkspaceFile(
      tempRoot,
      "docs/test-evidence/access-control/access-role.md",
      accessCatalog.replace("AUTH-ROLE-ACCESS-001", "INVALID-001")
    );
    const report = await validateTestEvidence({
      workspaceRoot: tempRoot
    });
    assert.ok(
      report.diagnostics.some(
        (entry) =>
          entry.code === "catalog.invalid" &&
          entry.message.includes("must include a valid case ID")
      )
    );
  });
});

test("missing indexes fall back to the catalog for validation and queries", async () => {
  await withWorkspace(async (tempRoot) => {
    const initialCheck = await validateTestEvidence({
      workspaceRoot: tempRoot
    });
    assert.equal(initialCheck.summary.testCases, 2);
    assert.ok(
      initialCheck.diagnostics.some(
        (entry) => entry.code === "state-index.index-missing"
      )
    );

    const initialQuery = await queryTestEvidence({ workspaceRoot: tempRoot });
    assert.equal(initialQuery.total, 2);
    assert.ok(
      initialQuery.diagnostics.some(
        (entry) =>
          entry.code === "state-index.index-missing" &&
          entry.severity === "warning" &&
          !entry.blocking
      )
    );
  });
});

test("index synchronization writes a valid searchable snapshot", async () => {
  await withWorkspace(async (tempRoot) => {
    const synchronized = await syncTestEvidenceIndex({
      mode: "write",
      workspaceRoot: tempRoot
    });
    assert.equal(synchronized.status, "ok");
    assert.equal(synchronized.state, "written");

    const checked = await validateTestEvidence({ workspaceRoot: tempRoot });
    assert.deepEqual(checked.diagnostics, []);
  });
});

test("damaged indexes fall back to the catalog and can be rebuilt", async () => {
  await withWorkspace(async (tempRoot) => {
    await syncTestEvidenceIndex({ mode: "write", workspaceRoot: tempRoot });
    await writeWorkspaceFile(
      tempRoot,
      "docs/test-evidence/test-evidence-index.json",
      "{ invalid json\n"
    );

    const damagedIndexQuery = await queryTestEvidence({
      workspaceRoot: tempRoot
    });
    assert.equal(damagedIndexQuery.total, 2);
    assert.ok(
      damagedIndexQuery.diagnostics.some(
        (entry) =>
          entry.code === "state-index.json-invalid" &&
          entry.severity === "warning" &&
          !entry.blocking
      )
    );
    assert.equal(
      (
        await syncTestEvidenceIndex({
          mode: "write",
          workspaceRoot: tempRoot
        })
      ).status,
      "ok"
    );
  });
});

test("catalog queries list, search, and show exact cases", async () => {
  await withWorkspace(async (tempRoot) => {
    await syncTestEvidenceIndex({ mode: "write", workspaceRoot: tempRoot });
    const allCases = await queryTestEvidence({ workspaceRoot: tempRoot });
    assert.equal(allCases.total, 2);
    assert.deepEqual(
      allCases.cases.map((entry) => entry.id),
      ["AUTH-ROLE-ACCESS-001", "AUTH-SESSION-EXPIRY-001"]
    );
    assert.deepEqual(
      allCases.cases.map((entry) => entry.sourcePath),
      ["access-control/access-role.md", "sessions/session-expiry.md"]
    );

    const searched = await queryTestEvidence({
      query: "session expired",
      workspaceRoot: tempRoot
    });
    assert.equal(searched.total, 1);
    assert.equal(searched.cases[0]?.id, "AUTH-SESSION-EXPIRY-001");

    const searchedId = await queryTestEvidence({
      query: "AUTH-ROLE-ACCESS-001",
      workspaceRoot: tempRoot
    });
    assert.equal(searchedId.total, 1);
    assert.equal(searchedId.cases[0]?.id, "AUTH-ROLE-ACCESS-001");

    const searchedContract = await queryTestEvidence({
      query: "rejected mutations unchanged",
      workspaceRoot: tempRoot
    });
    assert.equal(searchedContract.total, 1);
    assert.equal(searchedContract.cases[0]?.id, "AUTH-ROLE-ACCESS-001");

    const searchedProof = await queryTestEvidence({
      query: "guests denied",
      workspaceRoot: tempRoot
    });
    assert.equal(searchedProof.total, 1);
    assert.equal(searchedProof.cases[0]?.id, "AUTH-ROLE-ACCESS-001");
    assert.equal("searchText" in (searchedProof.cases[0] ?? {}), false);

    const shown = await showTestEvidenceCase({
      caseId: "AUTH-ROLE-ACCESS-001",
      workspaceRoot: tempRoot
    });
    assert.equal(shown.case?.id, "AUTH-ROLE-ACCESS-001");
    assert.equal(shown.case?.sourcePath, "access-control/access-role.md");
    assert.match(shown.markdown ?? "", /Guests are denied\./u);
    assert.doesNotMatch(shown.markdown ?? "", /Session tests cover expiry/u);
  });
});

test("catalog validation rejects legacy verification fields", async () => {
  await withWorkspace(async (tempRoot) => {
    await assertInvalidCatalog(
      tempRoot,
      "verification-test",
      [
        "### Case LEGACY-TEST-FIELD-001: Verification fields are rejected",
        "Verification: test",
        "Entry:",
        "- `tests/legacy.test.ts > rejects legacy verification fields`",
        "Contract:",
        "- Test identity is implicit.",
        "Proves:",
        "- Nothing."
      ].join("\n"),
      /must not declare Verification/u
    );
    await assertInvalidCatalog(
      tempRoot,
      "verification-check",
      [
        "### Case LEGACY-CHECK-FIELD-001: Check cases are rejected",
        "Verification: check",
        "Entry:",
        "- `scripts/check-generated.ts`",
        "Contract:",
        "- Engineering checks are outside this catalog.",
        "Proves:",
        "- Nothing."
      ].join("\n"),
      /must not declare Verification/u
    );
  });
});

test("catalog validation requires one non-empty unique entry list", async () => {
  await withWorkspace(async (tempRoot) => {
    await assertInvalidCatalog(
      tempRoot,
      "missing-entry",
      [
        "### Case MISSING-ENTRY-CASE-001: Entry is required",
        "Contract:",
        "- A test must be locatable.",
        "Proves:",
        "- Nothing."
      ].join("\n"),
      /non-empty Entry list/u
    );
    await assertInvalidCatalog(
      tempRoot,
      "duplicate-entry",
      [
        "### Case DUPLICATE-ENTRY-CASE-001: Entries are unique",
        "Entry:",
        "- `tests/duplicate.test.ts > rejects duplicate locators`",
        "- `tests/duplicate.test.ts > rejects duplicate locators`",
        "Contract:",
        "- A locator is registered once.",
        "Proves:",
        "- Nothing."
      ].join("\n"),
      /duplicates Entry/u
    );
  });
});

test("full and fast source reads reject duplicate case IDs across topics", async () => {
  await withWorkspace(async (tempRoot) => {
    await resetTestEvidenceCatalog(tempRoot);
    const duplicateCatalogPath = "docs/test-evidence";
    await writeTopicCatalog(tempRoot, duplicateCatalogPath, [
      { id: "first", description: "First responsibility topic." },
      { id: "second", description: "Second responsibility topic." }
    ]);
    const duplicateCase = [
      "### Case DUPLICATE-CROSS-FILE-001: IDs are unique across topics",
      "Entry:",
      "- `tests/duplicate.test.ts > rejects duplicate case IDs`",
      "Contract:",
      "- A case has one catalog identity.",
      "Proves:",
      "- Duplicate topic entries are rejected."
    ].join("\n");
    await writeWorkspaceFile(
      tempRoot,
      `${duplicateCatalogPath}/first/duplicate-case.md`,
      duplicateCase
    );
    await writeWorkspaceFile(
      tempRoot,
      `${duplicateCatalogPath}/second/duplicate-case.md`,
      duplicateCase
    );

    const report = await validateTestEvidence({ workspaceRoot: tempRoot });

    assert.ok(
      report.diagnostics.some(
        (entry) =>
          entry.code === "catalog.case-id-duplicate" &&
          entry.message.includes("first/duplicate-case.md") &&
          entry.message.includes("second/duplicate-case.md")
      )
    );
    await assert.rejects(
      createTestEvidenceStateIndexDefinition().readRevision({
        root: tempRoot
      }),
      /duplicate test evidence case id/u
    );
  });
});

test("defined topics may be empty but existing topic directories may not", async () => {
  await withWorkspace(async (tempRoot) => {
    await resetTestEvidenceCatalog(tempRoot);
    const emptyCatalogPath = "docs/test-evidence";
    await writeTopicCatalog(tempRoot, emptyCatalogPath, [
      { id: "future-work", description: "Reserved future responsibility." }
    ]);
    const synchronized = await syncTestEvidenceIndex({
      mode: "write",
      workspaceRoot: tempRoot
    });
    assert.equal(synchronized.status, "ok");
    const emptySetReport = await validateTestEvidence({
      workspaceRoot: tempRoot
    });
    assert.deepEqual(emptySetReport.diagnostics, []);
    assert.equal(emptySetReport.summary.testCases, 0);

    await fs.mkdir(path.join(tempRoot, emptyCatalogPath, "future-work"));
    const emptyDirectoryReport = await validateTestEvidence({
      workspaceRoot: tempRoot
    });
    assert.ok(
      emptyDirectoryReport.diagnostics.some(
        (entry) =>
          entry.code === "catalog.topic-directory-empty" &&
          entry.path === `${emptyCatalogPath}/future-work`
      )
    );
  });
});

test("stale indexes fall back to current catalog content", async () => {
  await withWorkspace(async (tempRoot) => {
    await syncTestEvidenceIndex({ mode: "write", workspaceRoot: tempRoot });
    await writeWorkspaceFile(
      tempRoot,
      "docs/test-evidence/access-control/access-role.md",
      `${accessCatalog}\n<!-- changed -->\n`
    );

    const staleQuery = await queryTestEvidence({ workspaceRoot: tempRoot });
    assert.equal(staleQuery.total, 2);
    assert.ok(
      staleQuery.diagnostics.some(
        (entry) =>
          entry.code === "state-index.index-stale" &&
          entry.severity === "warning" &&
          !entry.blocking
      )
    );

    const staleShow = await showTestEvidenceCase({
      caseId: "AUTH-ROLE-ACCESS-001",
      workspaceRoot: tempRoot
    });
    assert.match(staleShow.markdown ?? "", /Guests are denied\./u);
    assert.ok(
      staleShow.diagnostics.some(
        (entry) =>
          entry.code === "state-index.index-stale" &&
          entry.severity === "warning" &&
          !entry.blocking
      )
    );
  });
});

test("topics read the authoritative sorted table without an index", async () => {
  await withWorkspace(async (tempRoot) => {
    const result = await listTestEvidenceTopics({ workspaceRoot: tempRoot });
    assert.deepEqual(result.diagnostics, []);
    assert.deepEqual(
      result.topics.map((topic) => topic.id),
      ["access-control", "future-work", "sessions"]
    );
    await assert.rejects(
      fs.stat(
        path.join(tempRoot, "docs", "test-evidence", "test-evidence-index.json")
      ),
      (error: unknown) =>
        error instanceof Error && "code" in error && error.code === "ENOENT"
    );
  });
});

test("topic tables reject missing, malformed, unknown, duplicate, unsorted, and invalid definitions", async () => {
  await withWorkspace(async (tempRoot) => {
    const variants: Array<{
      content: string | null;
      expectedCode: string;
      name: string;
    }> = [
      {
        content: null,
        expectedCode: "catalog.topics-missing",
        name: "missing"
      },
      {
        content: "{ invalid json\n",
        expectedCode: "catalog.topics-json-invalid",
        name: "invalid-json"
      },
      {
        content: `${JSON.stringify({
          schemaVersion: 1,
          topics: [
            {
              id: "valid-topic",
              description: "Valid topic description.",
              unknown: true
            }
          ]
        })}\n`,
        expectedCode: "catalog.topics-schema-invalid",
        name: "unknown-field"
      },
      {
        content: `${JSON.stringify({
          schemaVersion: 1,
          topics: [
            { id: "same-topic", description: "First description." },
            { id: "same-topic", description: "Second description." }
          ]
        })}\n`,
        expectedCode: "catalog.topics-schema-invalid",
        name: "duplicate"
      },
      {
        content: `${JSON.stringify({
          schemaVersion: 1,
          topics: [
            { id: "z-topic", description: "Last topic first." },
            { id: "a-topic", description: "First topic last." }
          ]
        })}\n`,
        expectedCode: "catalog.topics-schema-invalid",
        name: "unsorted"
      },
      {
        content: `${JSON.stringify({
          schemaVersion: 1,
          topics: [
            {
              id: "Invalid_Topic",
              description: " bad\n"
            }
          ]
        })}\n`,
        expectedCode: "catalog.topics-schema-invalid",
        name: "invalid-values"
      },
      {
        content: `${JSON.stringify({
          schemaVersion: 1,
          topics: [
            {
              id: "short-description",
              description: "abc"
            }
          ]
        })}\n`,
        expectedCode: "catalog.topics-schema-invalid",
        name: "short-description"
      },
      {
        content: `${JSON.stringify({
          schemaVersion: 1,
          topics: [
            {
              id: "long-description",
              description: "😀".repeat(201)
            }
          ]
        })}\n`,
        expectedCode: "catalog.topics-schema-invalid",
        name: "long-description"
      }
    ];

    for (const variant of variants) {
      await resetTestEvidenceCatalog(tempRoot);
      const catalogPath = "docs/test-evidence";
      await fs.mkdir(path.join(tempRoot, ...catalogPath.split("/")), {
        recursive: true
      });
      if (variant.content !== null) {
        await writeWorkspaceFile(
          tempRoot,
          `${catalogPath}/test-evidence-topics.json`,
          variant.content
        );
      }
      const result = await listTestEvidenceTopics({
        workspaceRoot: tempRoot
      });
      assert.deepEqual(result.topics, [], variant.name);
      assert.ok(
        result.diagnostics.some((entry) => entry.code === variant.expectedCode),
        variant.name
      );
    }

    await resetTestEvidenceCatalog(tempRoot);
    const unicodeCatalogPath = "docs/test-evidence";
    await writeTopicCatalog(tempRoot, unicodeCatalogPath, [
      {
        id: "unicode-description",
        description: "😀".repeat(200)
      }
    ]);
    const unicodeResult = await listTestEvidenceTopics({
      workspaceRoot: tempRoot
    });
    assert.equal(unicodeResult.diagnostics.length, 0);
    assert.equal(
      Array.from(unicodeResult.topics[0]?.description ?? "").length,
      200
    );
  });
});

test("catalog roots reject unknown topic directories and unsupported root files", async () => {
  await withWorkspace(async (tempRoot) => {
    await fs.mkdir(
      path.join(tempRoot, "docs", "test-evidence", "unknown-topic"),
      { recursive: true }
    );
    await writeWorkspaceFile(
      tempRoot,
      "docs/test-evidence/notes.txt",
      "unsupported\n"
    );
    const report = await validateTestEvidence({ workspaceRoot: tempRoot });
    assert.ok(
      report.diagnostics.some((entry) => entry.code === "catalog.topic-unknown")
    );
    assert.ok(
      report.diagnostics.some(
        (entry) => entry.code === "catalog.root-file-unsupported"
      )
    );
  });
});

test("full and fast source reads require the case heading on line one", async () => {
  await withWorkspace(async (tempRoot) => {
    for (const [name, text] of [
      ["leading-blank", `\n${accessCatalog}`],
      ["leading-comment", `<!-- leading comment -->\n${accessCatalog}`],
      ["leading-frontmatter", `---\ntitle: legacy\n---\n${accessCatalog}`],
      ["bare-carriage-returns", accessCatalog.replace(/\n/gu, "\r")]
    ] as const) {
      await assertInvalidCatalog(
        tempRoot,
        name,
        text,
        /must start on line 1 with ### Case/u
      );
      await assert.rejects(
        createTestEvidenceStateIndexDefinition().readRevision({
          root: tempRoot
        }),
        /must start with a valid test evidence case heading/u
      );
    }
  });
});

test("one case file rejects zero or multiple case headings", async () => {
  await withWorkspace(async (tempRoot) => {
    await assertInvalidCatalog(
      tempRoot,
      "zero-cases",
      "# No case\n",
      /must contain exactly one test evidence case; found 0/u
    );
    await assertInvalidCatalog(
      tempRoot,
      "multiple-cases",
      `${accessCatalog}\n${sessionCatalog}\n`,
      /must contain exactly one test evidence case; found 2/u
    );
  });
});

test("topic directories reject nested, non-Markdown, and symbolic-link members", async () => {
  await withWorkspace(async (tempRoot) => {
    await resetTestEvidenceCatalog(tempRoot);
    const catalogPath = "docs/test-evidence";
    await writeTopicCatalog(tempRoot, catalogPath, [
      { id: "topic", description: "Strict member responsibility." }
    ]);
    await writeWorkspaceFile(
      tempRoot,
      `${catalogPath}/topic/valid-case.md`,
      accessCatalog
    );
    await writeWorkspaceFile(
      tempRoot,
      `${catalogPath}/topic/note.txt`,
      "unsupported\n"
    );
    await writeWorkspaceFile(
      tempRoot,
      `${catalogPath}/topic/nested/case.md`,
      sessionCatalog
    );
    const symbolicLinkPath = path.join(
      tempRoot,
      ...`${catalogPath}/topic/link.md`.split("/")
    );
    await fs.symlink(
      path.join(tempRoot, ...`${catalogPath}/topic/valid-case.md`.split("/")),
      symbolicLinkPath,
      "file"
    );
    const report = await validateTestEvidence({ workspaceRoot: tempRoot });
    assert.ok(
      report.diagnostics.filter(
        (entry) => entry.code === "catalog.topic-entry-unsupported"
      ).length >= 3
    );
  });
});

test("fixed index cannot hard-link to authoritative sources", async () => {
  const candidates = [
    "docs/test-evidence/test-evidence-topics.json",
    "docs/test-evidence/access-control/access-role.md"
  ];
  for (const candidate of candidates) {
    await withWorkspace(async (tempRoot) => {
      await fs.link(
        path.join(tempRoot, ...candidate.split("/")),
        path.join(tempRoot, "docs", "test-evidence", "test-evidence-index.json")
      );
      const result = await syncTestEvidenceIndex({
        mode: "write",
        workspaceRoot: tempRoot
      });
      assert.equal(result.status, "error", candidate);
      assert.ok(
        result.diagnostics.some(
          (entry) => entry.code === "catalog.index-file-conflict"
        ),
        candidate
      );
    });
  }
});

test("indexes project sorted topic metadata and path-derived topic keys", async () => {
  await withWorkspace(async (tempRoot) => {
    await syncTestEvidenceIndex({ mode: "write", workspaceRoot: tempRoot });
    const index = await readTestEvidenceStateIndex(tempRoot);
    assert.equal(index.definitionVersion, 3);
    assert.equal(index.schemaVersion, 3);
    assert.deepEqual(
      index.metadata.topics.map((topic) => topic.id),
      ["access-control", "future-work", "sessions"]
    );
    const ids = Object.keys(index.entries);
    assert.deepEqual(ids, ["AUTH-ROLE-ACCESS-001", "AUTH-SESSION-EXPIRY-001"]);
    assert.deepEqual(Object.keys(index.sourceRevision.entries), ids);
    assert.match(index.sourceRevision.metadata, /^sha256:[0-9a-f]{64}$/u);
    assert.deepEqual(
      ids.map((id) => index.entries[id]?.keys.topic),
      [["access-control"], ["sessions"]]
    );
    assert.deepEqual(
      ids.map((id) => index.entries[id]?.state.sourcePath),
      ["access-control/access-role.md", "sessions/session-expiry.md"]
    );
    assert.equal("id" in (index.entries[ids[0] ?? ""] ?? {}), false);
  });
});

test("state index schemas reject invalid case IDs used as record keys", async () => {
  await withWorkspace(async (tempRoot) => {
    await syncTestEvidenceIndex({ mode: "write", workspaceRoot: tempRoot });
    const index = await readTestEvidenceStateIndex(tempRoot);
    const generatedSchema = v.parse(
      v.record(v.string(), v.unknown()),
      await readJsonFile(
        path.join(
          repositoryRoot,
          "skills",
          "test-evidence-review",
          "references",
          "schemas",
          "test-evidence-state-index.schema.json"
        )
      )
    );
    const validateGeneratedIndex = new Ajv2020({
      allErrors: true,
      strict: false
    }).compile(generatedSchema);
    assert.equal(
      validateGeneratedIndex(index),
      true,
      JSON.stringify(validateGeneratedIndex.errors)
    );

    const invalidEntryId = structuredClone(index);
    const validEntry = invalidEntryId.entries["AUTH-ROLE-ACCESS-001"];
    assert.ok(validEntry);
    invalidEntryId.entries["not-a-case-id"] = validEntry;
    Reflect.deleteProperty(invalidEntryId.entries, "AUTH-ROLE-ACCESS-001");
    const invalidRevisionId = structuredClone(index);
    const validRevision =
      invalidRevisionId.sourceRevision.entries["AUTH-ROLE-ACCESS-001"];
    assert.ok(validRevision);
    invalidRevisionId.sourceRevision.entries["not-a-case-id"] = validRevision;
    Reflect.deleteProperty(
      invalidRevisionId.sourceRevision.entries,
      "AUTH-ROLE-ACCESS-001"
    );
    for (const invalidIndex of [invalidEntryId, invalidRevisionId]) {
      assert.equal(
        v.safeParse(testEvidenceStateIndexSchema, invalidIndex).success,
        false
      );
      assert.equal(validateGeneratedIndex(invalidIndex), false);
    }
  });
});

test("schema v2 indexes are rejected and rebuilt as keyed schema v3", async () => {
  await withWorkspace(async (tempRoot) => {
    await syncTestEvidenceIndex({ mode: "write", workspaceRoot: tempRoot });
    const indexPath = path.join(
      tempRoot,
      "docs",
      "test-evidence",
      "test-evidence-index.json"
    );
    const current = await readTestEvidenceStateIndex(tempRoot);
    const schemaV2 = {
      ...current,
      entries: Object.entries(current.entries).map(([id, entry]) => ({
        id,
        ...entry
      })),
      schemaVersion: 2,
      sourceRevision: current.sourceRevision.metadata
    };
    assert.equal(
      v.safeParse(testEvidenceStateIndexSchema, schemaV2).success,
      false
    );
    await fs.writeFile(indexPath, `${JSON.stringify(schemaV2, null, 2)}\n`);

    const queried = await queryTestEvidence({ workspaceRoot: tempRoot });
    assert.equal(queried.total, 2);
    assert.ok(
      queried.diagnostics.some(
        (entry) =>
          entry.severity === "warning" &&
          entry.code === "state-index.schema-version-unsupported"
      )
    );

    const rebuilt = await syncTestEvidenceIndex({
      mode: "write",
      workspaceRoot: tempRoot
    });
    assert.equal(rebuilt.status, "ok");
    const schemaV3 = await readJsonFile(indexPath);
    assert.equal(
      v.safeParse(testEvidenceStateIndexSchema, schemaV3).success,
      true
    );
  });
});

test("topic descriptions change only the metadata source revision", async () => {
  await withWorkspace(async (tempRoot) => {
    await syncTestEvidenceIndex({ mode: "write", workspaceRoot: tempRoot });
    const initialRevision = await readIndexRevision(tempRoot);
    const changedTopics = parseTopicCatalogFixture();
    const accessTopic = changedTopics.topics[0];
    assert.ok(accessTopic);
    accessTopic.description = "Changed access-control contract tests.";
    await writeWorkspaceFile(
      tempRoot,
      "docs/test-evidence/test-evidence-topics.json",
      `${JSON.stringify(changedTopics, null, 2)}\n`
    );
    await syncTestEvidenceIndex({ mode: "write", workspaceRoot: tempRoot });
    const topicRevision = await readIndexRevision(tempRoot);
    assert.notEqual(topicRevision.metadata, initialRevision.metadata);
    assert.deepEqual(topicRevision.entries, initialRevision.entries);
  });
});

test("case moves change only their entry revision and preserve identity", async () => {
  await withWorkspace(async (tempRoot) => {
    await syncTestEvidenceIndex({ mode: "write", workspaceRoot: tempRoot });
    const initialRevision = await readIndexRevision(tempRoot);
    await fs.rename(
      path.join(
        tempRoot,
        "docs",
        "test-evidence",
        "access-control",
        "access-role.md"
      ),
      path.join(tempRoot, "docs", "test-evidence", "sessions", "access-role.md")
    );
    await fs.rmdir(
      path.join(tempRoot, "docs", "test-evidence", "access-control")
    );
    const movedSync = await syncTestEvidenceIndex({
      mode: "write",
      workspaceRoot: tempRoot
    });
    assert.equal(movedSync.status, "ok");
    const movedRevision = await readIndexRevision(tempRoot);
    assert.equal(movedRevision.metadata, initialRevision.metadata);
    assert.notEqual(
      movedRevision.entries["AUTH-ROLE-ACCESS-001"],
      initialRevision.entries["AUTH-ROLE-ACCESS-001"]
    );
    assert.equal(
      movedRevision.entries["AUTH-SESSION-EXPIRY-001"],
      initialRevision.entries["AUTH-SESSION-EXPIRY-001"]
    );
    const shown = await showTestEvidenceCase({
      caseId: "AUTH-ROLE-ACCESS-001",
      workspaceRoot: tempRoot
    });
    assert.equal(shown.case?.id, "AUTH-ROLE-ACCESS-001");
    assert.equal(shown.case?.sourcePath, "sessions/access-role.md");
    assert.equal(shown.topic?.id, "sessions");
  });
});

test("revision framing normalizes line endings and topic JSON formatting", async () => {
  await withWorkspace(async (tempRoot) => {
    const parsedTopics = parseTopicCatalogFixture();
    const revisionCase = [
      "### Case AUTH-ROLE-ACCESS-001: Revision framing is stable",
      "",
      "Entry:",
      "- `tests/revision.test.ts > normalizes line endings`",
      "",
      "Contract:",
      "- Revision framing normalizes non-semantic source formatting.",
      "",
      "Proves:",
      "- Equivalent line endings produce the same fingerprint.",
      ""
    ].join("\n");
    const lfRevision = testEvidenceSourceRevision({
      sources: [
        {
          id: "AUTH-ROLE-ACCESS-001",
          path: "access-control/case.md",
          text: revisionCase
        }
      ],
      topicCatalog: parsedTopics
    });
    const crlfRevision = testEvidenceSourceRevision({
      sources: [
        {
          id: "AUTH-ROLE-ACCESS-001",
          path: "access-control/case.md",
          text: revisionCase.replace(/\n/gu, "\r\n")
        }
      ],
      topicCatalog: parsedTopics
    });
    const bareCrRevision = testEvidenceSourceRevision({
      sources: [
        {
          id: "AUTH-ROLE-ACCESS-001",
          path: "access-control/case.md",
          text: revisionCase.replace(/\n/gu, "\r")
        }
      ],
      topicCatalog: parsedTopics
    });
    assert.deepEqual(lfRevision, crlfRevision);
    assert.notEqual(
      bareCrRevision.entries["AUTH-ROLE-ACCESS-001"],
      lfRevision.entries["AUTH-ROLE-ACCESS-001"]
    );

    await syncTestEvidenceIndex({ mode: "write", workspaceRoot: tempRoot });
    const initialRevision = await readIndexRevision(tempRoot);
    await writeWorkspaceFile(
      tempRoot,
      "docs/test-evidence/test-evidence-topics.json",
      JSON.stringify(parsedTopics)
    );
    const checked = await syncTestEvidenceIndex({
      mode: "check",
      workspaceRoot: tempRoot
    });
    assert.equal(checked.status, "ok");
    assert.deepEqual(await readIndexRevision(tempRoot), initialRevision);
  });
});

test("full and fast source reads return the same per-case revision", async () => {
  await withWorkspace(async (tempRoot) => {
    const definition = createTestEvidenceStateIndexDefinition();
    const snapshot = await definition.read({ root: tempRoot });
    const fastRevision = await definition.readRevision({ root: tempRoot });

    assert.deepEqual(snapshot.sourceRevision, fastRevision);
    assert.deepEqual(Object.keys(snapshot.states), [
      "AUTH-ROLE-ACCESS-001",
      "AUTH-SESSION-EXPIRY-001"
    ]);
    await writeWorkspaceFile(
      tempRoot,
      "docs/test-evidence/access-control/access-role.md",
      accessCatalog.replace(/\n/gu, "\r\n")
    );
    const crlfSnapshot = await definition.read({ root: tempRoot });
    const crlfFastRevision = await definition.readRevision({ root: tempRoot });
    assert.deepEqual(crlfSnapshot.sourceRevision, fastRevision);
    assert.deepEqual(crlfFastRevision, fastRevision);
  });
});

test("domain parsing treats the record key as the authoritative case id", async () => {
  await withWorkspace(async (tempRoot) => {
    const definition = createTestEvidenceStateIndexDefinition();
    const snapshot = await definition.read({ root: tempRoot });
    const id = "AUTH-ROLE-ACCESS-001";
    const state = snapshot.states[id];
    assert.ok(state);

    assert.equal(
      definition.parseState(state, {
        id,
        metadata: snapshot.metadata
      }).id,
      id
    );
    assert.throws(
      () =>
        definition.parseState(
          {
            ...state,
            id: "AUTH-SESSION-EXPIRY-001"
          },
          {
            id,
            metadata: snapshot.metadata
          }
        ),
      /state id must match its index key/u
    );
  });
});

test("query results use record keys as authoritative case identities", async () => {
  await withWorkspace(async (tempRoot) => {
    await syncTestEvidenceIndex({ mode: "write", workspaceRoot: tempRoot });
    const index = await readTestEvidenceStateIndex(tempRoot);
    const accessEntry = index.entries["AUTH-ROLE-ACCESS-001"];
    assert.ok(accessEntry);
    accessEntry.state.id = "AUTH-SESSION-EXPIRY-001";
    await writeTestEvidenceStateIndex(tempRoot, index);

    const queried = await queryTestEvidence({ workspaceRoot: tempRoot });
    assert.deepEqual(queried.diagnostics, []);
    const accessCase = queried.cases.find(
      (entry) => entry.sourcePath === "access-control/access-role.md"
    );
    assert.equal(accessCase?.id, "AUTH-ROLE-ACCESS-001");
  });
});

test("case membership changes only add or remove matching revision entries", async () => {
  await withWorkspace(async (tempRoot) => {
    const definition = createTestEvidenceStateIndexDefinition();
    const initial = await definition.readRevision({ root: tempRoot });
    await writeWorkspaceFile(
      tempRoot,
      "docs/test-evidence/access-control/role-delete.md",
      [
        "### Case AUTH-ROLE-DELETE-001: Delete access is covered",
        "",
        "Entry:",
        "- `tests/delete.test.ts > rejects guest deletion`",
        "",
        "Contract:",
        "- Delete access follows the caller role boundary.",
        "",
        "Proves:",
        "- Guests cannot delete resources."
      ].join("\n")
    );

    const addedSnapshot = await definition.read({ root: tempRoot });
    const added = await definition.readRevision({ root: tempRoot });
    assert.deepEqual(addedSnapshot.sourceRevision, added);
    assert.equal(added.metadata, initial.metadata);
    assert.deepEqual(Object.keys(added.entries), [
      "AUTH-ROLE-ACCESS-001",
      "AUTH-ROLE-DELETE-001",
      "AUTH-SESSION-EXPIRY-001"
    ]);
    assert.equal(
      added.entries["AUTH-ROLE-ACCESS-001"],
      initial.entries["AUTH-ROLE-ACCESS-001"]
    );
    assert.equal(
      added.entries["AUTH-SESSION-EXPIRY-001"],
      initial.entries["AUTH-SESSION-EXPIRY-001"]
    );

    await fs.rm(
      path.join(
        tempRoot,
        "docs",
        "test-evidence",
        "sessions",
        "session-expiry.md"
      )
    );
    await fs.rmdir(path.join(tempRoot, "docs", "test-evidence", "sessions"));
    const removed = await definition.readRevision({ root: tempRoot });
    assert.equal(removed.metadata, added.metadata);
    assert.deepEqual(Object.keys(removed.entries), [
      "AUTH-ROLE-ACCESS-001",
      "AUTH-ROLE-DELETE-001"
    ]);
    assert.equal(
      removed.entries["AUTH-ROLE-ACCESS-001"],
      added.entries["AUTH-ROLE-ACCESS-001"]
    );
    assert.equal(
      removed.entries["AUTH-ROLE-DELETE-001"],
      added.entries["AUTH-ROLE-DELETE-001"]
    );
  });
});

test("fast revision reads do not parse case bodies", async () => {
  await withWorkspace(async (tempRoot) => {
    const definition = createTestEvidenceStateIndexDefinition();
    await writeWorkspaceFile(
      tempRoot,
      "docs/test-evidence/access-control/access-role.md",
      [
        "### Case AUTH-ROLE-ACCESS-001: Invalid body remains identifiable",
        "",
        "This body has no Entry, Contract, or Proves sections."
      ].join("\n")
    );

    const revision = await definition.readRevision({ root: tempRoot });
    assert.match(
      revision.entries["AUTH-ROLE-ACCESS-001"] ?? "",
      /^sha256:[0-9a-f]{64}$/u
    );
    await assert.rejects(
      definition.read({ root: tempRoot }),
      /non-empty Entry list|exactly one Contract/u
    );
  });
});

test("one index open performs one fast source read and reader calls reuse it", async () => {
  await withWorkspace(async (tempRoot) => {
    await syncTestEvidenceIndex({ mode: "write", workspaceRoot: tempRoot });
    const base = createTestEvidenceStateIndexDefinition();
    const calls = {
      derive: 0,
      parseState: 0,
      read: 0,
      readRevision: 0,
      validateIndex: 0
    };
    const sourceBackup = path.join(tempRoot, "test-evidence-source-backup");
    const definition = {
      ...base,
      keyStrategies: base.keyStrategies.map((strategy) => ({
        ...strategy,
        derive: (...args: Parameters<typeof strategy.derive>) => {
          calls.derive += 1;
          return strategy.derive(...args);
        }
      })),
      parseState: (...args: Parameters<typeof base.parseState>) => {
        calls.parseState += 1;
        return base.parseState(...args);
      },
      read: async (...args: Parameters<typeof base.read>) => {
        calls.read += 1;
        return await base.read(...args);
      },
      readRevision: async (...args: Parameters<typeof base.readRevision>) => {
        calls.readRevision += 1;
        const revision = await base.readRevision(...args);
        await fs.mkdir(sourceBackup);
        const catalogRoot = path.join(tempRoot, "docs", "test-evidence");
        for (const name of [
          "test-evidence-topics.json",
          "access-control",
          "sessions"
        ]) {
          await fs.rename(
            path.join(catalogRoot, name),
            path.join(sourceBackup, name)
          );
        }
        return revision;
      },
      validateIndex: () => {
        calls.validateIndex += 1;
      }
    };
    const runtime = createStateIndexRuntime({
      definition,
      indexPath: "docs/test-evidence/test-evidence-index.json",
      root: tempRoot
    });

    const opened = await runtime.open();
    if (opened.status !== "ok") {
      assert.fail(`index open failed: ${JSON.stringify(opened.diagnostics)}`);
    }
    assert.deepEqual(calls, {
      derive: 0,
      parseState: 0,
      read: 0,
      readRevision: 1,
      validateIndex: 0
    });

    assert.equal(opened.value.get("AUTH-ROLE-ACCESS-001").status, "ok");
    assert.equal(opened.value.query().status, "ok");
    assert.equal(opened.value.all().status, "ok");
    assert.deepEqual(calls, {
      derive: 0,
      parseState: 0,
      read: 0,
      readRevision: 1,
      validateIndex: 0
    });
  });
});

test("strict checks cross-validate persisted source paths and topic keys", async () => {
  await withWorkspace(async (tempRoot) => {
    await syncTestEvidenceIndex({ mode: "write", workspaceRoot: tempRoot });
    const index = await readTestEvidenceStateIndex(tempRoot);
    const accessEntry = index.entries["AUTH-ROLE-ACCESS-001"];
    assert.ok(accessEntry);
    accessEntry.keys.topic = ["sessions"];
    await writeTestEvidenceStateIndex(tempRoot, index);
    const keyMismatch = await validateTestEvidence({ workspaceRoot: tempRoot });
    assert.ok(
      keyMismatch.diagnostics.some(
        (entry) => entry.blocking && entry.code.startsWith("state-index.")
      )
    );

    await syncTestEvidenceIndex({ mode: "write", workspaceRoot: tempRoot });
    const rebuilt = await readTestEvidenceStateIndex(tempRoot);
    const rebuiltAccessEntry = rebuilt.entries["AUTH-ROLE-ACCESS-001"];
    assert.ok(rebuiltAccessEntry);
    rebuiltAccessEntry.state.sourcePath = "unknown-topic/access-role.md";
    await writeTestEvidenceStateIndex(tempRoot, rebuilt);
    const pathMismatch = await validateTestEvidence({
      workspaceRoot: tempRoot
    });
    assert.ok(
      pathMismatch.diagnostics.some(
        (entry) => entry.blocking && entry.code.startsWith("state-index.")
      )
    );
  });
});

test("topic filters return matching and defined-empty results with topic definitions", async () => {
  await withWorkspace(async (tempRoot) => {
    await syncTestEvidenceIndex({ mode: "write", workspaceRoot: tempRoot });
    const sessions = await queryTestEvidence({
      topic: "sessions",
      workspaceRoot: tempRoot
    });
    assert.deepEqual(
      sessions.cases.map((entry) => entry.id),
      ["AUTH-SESSION-EXPIRY-001"]
    );
    assert.equal(
      sessions.topics.find((topic) => topic.id === "sessions")?.description,
      "Session lifecycle contract tests."
    );

    const future = await queryTestEvidence({
      topic: "future-work",
      workspaceRoot: tempRoot
    });
    assert.equal(future.total, 0);
    assert.deepEqual(future.cases, []);
    assert.ok(future.topics.some((topic) => topic.id === "future-work"));

    const shown = await showTestEvidenceCase({
      caseId: "AUTH-SESSION-EXPIRY-001",
      workspaceRoot: tempRoot
    });
    assert.equal(shown.topic?.id, "sessions");
    assert.equal(shown.topic?.description, "Session lifecycle contract tests.");
  });
});

test("unknown and repeated topic CLI arguments fail deterministically", async () => {
  await withWorkspace(async (tempRoot) => {
    await syncTestEvidenceIndex({ mode: "write", workspaceRoot: tempRoot });
    const publicFailure = await queryTestEvidence({
      topic: "missing-topic",
      workspaceRoot: tempRoot
    });
    assert.deepEqual(publicFailure.cases, []);
    assert.ok(
      publicFailure.diagnostics.some(
        (entry) => entry.code === "query.topic-unknown"
      )
    );

    const unknown = await runCatalogCliFailure([
      "list",
      "--root",
      tempRoot,
      "--topic",
      "missing-topic",
      "--json"
    ]);
    assert.equal(unknown.code, 2);
    const unknownResult = JSON.parse(unknown.stdout) as {
      diagnostics: Array<{ code: string }>;
      schemaVersion: number;
    };
    assert.equal(unknownResult.schemaVersion, 4);
    assert.ok(
      unknownResult.diagnostics.some(
        (entry) => entry.code === "query.topic-unknown"
      )
    );

    const repeated = await runCatalogCliFailure([
      "list",
      "--root",
      tempRoot,
      "--topic",
      "access-control",
      "--topic",
      "sessions"
    ]);
    assert.equal(repeated.code, 2);
    assert.match(repeated.stderr, /may only be specified once/u);
  });
});

test("queries reject newly invalid root layouts instead of trusting a previous index", async () => {
  await withWorkspace(async (tempRoot) => {
    await syncTestEvidenceIndex({ mode: "write", workspaceRoot: tempRoot });
    await writeWorkspaceFile(
      tempRoot,
      "docs/test-evidence/unsupported.bin",
      "not a source\n"
    );
    const result = await queryTestEvidence({ workspaceRoot: tempRoot });
    assert.equal(result.total, 0);
    assert.deepEqual(result.cases, []);
    assert.ok(
      result.diagnostics.some(
        (entry) =>
          entry.blocking && entry.code === "state-index.revision-read-failed"
      )
    );
    const synchronized = await syncTestEvidenceIndex({
      mode: "write",
      workspaceRoot: tempRoot
    });
    assert.equal(synchronized.status, "error");
    assert.ok(
      synchronized.diagnostics.some(
        (entry) => entry.code === "catalog.root-file-unsupported"
      )
    );
  });
});

test("unreadable indexes remain blocking for list and show operations", async () => {
  await withWorkspace(async (tempRoot) => {
    const unreadableIndexPath = path.join(
      tempRoot,
      "docs",
      "test-evidence",
      "test-evidence-index.json"
    );
    await fs.mkdir(unreadableIndexPath, { recursive: true });

    const unreadableQuery = await queryTestEvidence({
      workspaceRoot: tempRoot
    });
    assert.equal(unreadableQuery.total, 0);
    assert.deepEqual(unreadableQuery.cases, []);
    assertUnrecoverableIndexReadFailure(unreadableQuery.diagnostics);

    const unreadableShow = await showTestEvidenceCase({
      caseId: "AUTH-ROLE-ACCESS-001",
      workspaceRoot: tempRoot
    });
    assert.equal(unreadableShow.case, null);
    assert.equal(unreadableShow.markdown, null);
    assertUnrecoverableIndexReadFailure(unreadableShow.diagnostics);
  });
});

test("distributed module and CLI preserve catalog query contracts", async () => {
  await withWorkspace(async (tempRoot) => {
    await syncTestEvidenceIndex({ mode: "write", workspaceRoot: tempRoot });
    await assertDistributedModuleParity(tempRoot);
  });
});

for (const legacyVersion of [1, 2] as const) {
  test(`documented v${legacyVersion} consumer upgrade produces the fixed topic catalog`, async () => {
    await rehearseLegacyConsumerUpgrade(legacyVersion);
  });
}

async function withWorkspace(
  operation: (workspaceRoot: string) => Promise<void>
): Promise<void> {
  const workspaceRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "test-evidence-")
  );
  try {
    await writeWorkspaceFile(
      workspaceRoot,
      "docs/test-evidence/test-evidence-topics.json",
      topicCatalog
    );
    await writeWorkspaceFile(
      workspaceRoot,
      "docs/test-evidence/access-control/access-role.md",
      accessCatalog
    );
    await writeWorkspaceFile(
      workspaceRoot,
      "docs/test-evidence/sessions/session-expiry.md",
      sessionCatalog
    );
    await operation(workspaceRoot);
  } finally {
    await fs.rm(workspaceRoot, { force: true, recursive: true });
  }
}

async function resetTestEvidenceCatalog(workspaceRoot: string): Promise<void> {
  await fs.rm(path.join(workspaceRoot, "docs", "test-evidence"), {
    force: true,
    recursive: true
  });
}

function assertUnrecoverableIndexReadFailure(
  diagnostics: readonly {
    blocking: boolean;
    code: string;
    message: string;
    severity: "error" | "warning";
  }[]
): void {
  const failure = diagnostics.find(
    (entry) => entry.code === "state-index.index-read-failed"
  );
  assert.ok(failure);
  assert.equal(failure.blocking, true);
  assert.equal(failure.severity, "error");
  assert.doesNotMatch(failure.message, /sync-index --write/u);
}

async function assertInvalidCatalog(
  workspaceRoot: string,
  name: string,
  text: string,
  expected: RegExp
): Promise<void> {
  await resetTestEvidenceCatalog(workspaceRoot);
  const catalogPath = "docs/test-evidence";
  await writeTopicCatalog(workspaceRoot, catalogPath, [
    { id: "topic", description: "Invalid catalog test topic." }
  ]);
  await writeWorkspaceFile(
    workspaceRoot,
    `${catalogPath}/topic/${name}.md`,
    text
  );
  const report = await validateTestEvidence({ workspaceRoot });
  assert.ok(report.diagnostics.some((entry) => expected.test(entry.message)));
}

async function assertDistributedModuleParity(
  workspaceRoot: string
): Promise<void> {
  const distributed = await import(pathToFileURL(distributedScript).href);
  assert.equal(typeof distributed.listTestEvidenceTopics, "function");
  assert.equal(typeof distributed.queryTestEvidence, "function");
  assert.equal(typeof distributed.runTestEvidenceCatalogCli, "function");
  assert.equal("testEvidenceConfigSchema" in distributed, false);
  assert.ok(distributed.testEvidenceTopicCatalogSchema);
  assert.ok(distributed.testEvidenceTopicsResultSchema);

  const child = await execFileAsync(
    "node",
    [distributedScript, "list", "--root", workspaceRoot, "--json"],
    {
      encoding: "utf8",
      windowsHide: true
    }
  );
  const result = JSON.parse(String(child.stdout)) as {
    cases: unknown[];
    total: number;
  };
  assert.equal(result.total, 2);
  assert.equal(result.cases.length, 2);

  const indexPath = path.join(
    workspaceRoot,
    "docs",
    "test-evidence",
    "test-evidence-index.json"
  );
  await fs.rm(indexPath);
  await fs.mkdir(indexPath);
  try {
    await execFileAsync(
      "node",
      [distributedScript, "list", "--root", workspaceRoot, "--json"],
      {
        encoding: "utf8",
        windowsHide: true
      }
    );
    assert.fail("list should fail when the index cannot be read");
  } catch (error) {
    const failure = error as Error & {
      code?: number | string;
      stdout?: string;
    };
    assert.equal(failure.code, 1);
    const output = JSON.parse(failure.stdout ?? "") as {
      diagnostics: Array<{
        blocking: boolean;
        code: string;
        message: string;
        severity: "error" | "warning";
      }>;
    };
    assertUnrecoverableIndexReadFailure(output.diagnostics);
  }
}

async function rehearseLegacyConsumerUpgrade(
  legacyVersion: 1 | 2
): Promise<void> {
  const workspaceRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), `test-evidence-v${legacyVersion}-upgrade-`)
  );
  const legacyCatalogPath =
    legacyVersion === 1 ? "docs/test-evidence.md" : "docs/test-evidence/cases";
  const stagedCatalogPath = "docs/test-evidence-next";
  const retainedLegacyCatalogPath =
    legacyVersion === 1
      ? legacyCatalogPath
      : "docs/legacy-test-evidence-v2/cases";

  try {
    if (legacyVersion === 1) {
      await writeWorkspaceFile(
        workspaceRoot,
        legacyCatalogPath,
        `${accessCatalog}\n${sessionCatalog}\n`
      );
    } else {
      await writeWorkspaceFile(
        workspaceRoot,
        `${legacyCatalogPath}/access-control.md`,
        `${accessCatalog}\n`
      );
      await writeWorkspaceFile(
        workspaceRoot,
        `${legacyCatalogPath}/sessions.md`,
        `${sessionCatalog}\n`
      );
    }
    await writeWorkspaceFile(
      workspaceRoot,
      ".test-evidence.json",
      `${JSON.stringify(
        {
          schemaVersion: legacyVersion,
          catalogPath: legacyCatalogPath,
          indexPath: "docs/legacy-test-evidence-index.json"
        },
        null,
        2
      )}\n`
    );

    const legacyFailure = await runCatalogCliFailure([
      "check",
      "--root",
      workspaceRoot,
      "--json"
    ]);
    assert.equal(legacyFailure.code, 1);
    assert.doesNotThrow(() => JSON.parse(legacyFailure.stdout));

    await writeTopicCatalog(workspaceRoot, stagedCatalogPath, [
      {
        id: "access-control",
        description: "Access-control contract tests."
      },
      {
        id: "sessions",
        description: "Session lifecycle contract tests."
      }
    ]);
    await writeWorkspaceFile(
      workspaceRoot,
      `${stagedCatalogPath}/access-control/access-role.md`,
      `${accessCatalog}\n`
    );
    await writeWorkspaceFile(
      workspaceRoot,
      `${stagedCatalogPath}/sessions/session-expiry.md`,
      `${sessionCatalog}\n`
    );
    if (legacyVersion === 2) {
      await fs.rename(
        path.join(workspaceRoot, "docs", "test-evidence"),
        path.join(workspaceRoot, "docs", "legacy-test-evidence-v2")
      );
    }
    await fs.rename(
      path.join(workspaceRoot, "docs", "test-evidence-next"),
      path.join(workspaceRoot, "docs", "test-evidence")
    );
    await fs.rm(path.join(workspaceRoot, ".test-evidence.json"));

    const topics = await runCatalogCliJson<{
      topics: Array<{ id: string }>;
    }>(["topics", "--root", workspaceRoot, "--json"]);
    assert.deepEqual(
      topics.topics.map((topic) => topic.id),
      ["access-control", "sessions"]
    );

    await runCatalogCliJson([
      "sync-index",
      "--write",
      "--root",
      workspaceRoot,
      "--json"
    ]);
    const checked = await runCatalogCliJson<{
      diagnostics: Array<{ blocking: boolean }>;
      summary: { testCases: number };
    }>(["check", "--root", workspaceRoot, "--json"]);
    assert.equal(checked.summary.testCases, 2);
    assert.equal(
      checked.diagnostics.some((diagnostic) => diagnostic.blocking),
      false
    );

    const listed = await runCatalogCliJson<{
      cases: Array<{ id: string; sourcePath: string }>;
      total: number;
    }>([
      "list",
      "--topic",
      "access-control",
      "--root",
      workspaceRoot,
      "--json"
    ]);
    assert.equal(listed.total, 1);
    assert.deepEqual(
      listed.cases.map(({ id, sourcePath }) => ({
        id,
        sourcePath
      })),
      [
        {
          id: "AUTH-ROLE-ACCESS-001",
          sourcePath: "access-control/access-role.md"
        }
      ]
    );

    const shown = await runCatalogCliJson<{
      case: { id: string; sourcePath: string } | null;
      markdown: string | null;
      topic: { id: string } | null;
    }>(["show", "AUTH-SESSION-EXPIRY-001", "--root", workspaceRoot, "--json"]);
    assert.equal(shown.case?.sourcePath, "sessions/session-expiry.md");
    assert.equal(shown.topic?.id, "sessions");
    assert.match(shown.markdown ?? "", /Expired sessions are rejected\./u);

    await writeWorkspaceFile(
      workspaceRoot,
      "tests/unregistered.test.ts",
      "test('not automatically collected', () => {});\n"
    );
    if (legacyVersion === 1) {
      await fs.appendFile(
        path.join(workspaceRoot, ...retainedLegacyCatalogPath.split("/")),
        "\n### Case LEGACY-ONLY-CASE-001: Old source is ignored\n",
        "utf8"
      );
    } else {
      await writeWorkspaceFile(
        workspaceRoot,
        `${retainedLegacyCatalogPath}/legacy-only.md`,
        "### Case LEGACY-ONLY-CASE-001: Old source is ignored\n"
      );
    }
    const afterLegacyChange = await runCatalogCliJson<{
      total: number;
    }>(["list", "--root", workspaceRoot, "--json"]);
    assert.equal(afterLegacyChange.total, 2);
  } finally {
    await fs.rm(workspaceRoot, { force: true, recursive: true });
  }
}

function parseTopicCatalogFixture(): TestEvidenceTopicCatalog {
  const input: unknown = JSON.parse(topicCatalog);
  return v.parse(testEvidenceTopicCatalogSchema, input);
}

async function readJsonFile(filePath: string): Promise<unknown> {
  const input: unknown = JSON.parse(await fs.readFile(filePath, "utf8"));
  return input;
}

async function readTestEvidenceStateIndex(
  workspaceRoot: string
): Promise<TestEvidenceStateIndex> {
  return v.parse(
    testEvidenceStateIndexSchema,
    await readJsonFile(testEvidenceStateIndexPath(workspaceRoot))
  );
}

async function writeTestEvidenceStateIndex(
  workspaceRoot: string,
  index: TestEvidenceStateIndex
): Promise<void> {
  await fs.writeFile(
    testEvidenceStateIndexPath(workspaceRoot),
    `${JSON.stringify(index, null, 2)}\n`,
    "utf8"
  );
}

function testEvidenceStateIndexPath(workspaceRoot: string): string {
  return path.join(
    workspaceRoot,
    "docs",
    "test-evidence",
    "test-evidence-index.json"
  );
}

async function readIndexRevision(
  workspaceRoot: string
): Promise<TestEvidenceStateIndex["sourceRevision"]> {
  const index = await readTestEvidenceStateIndex(workspaceRoot);
  return index.sourceRevision;
}

async function runCatalogCli(
  args: readonly string[],
  cwd?: string
): Promise<{
  code: number;
  stderr: string;
  stdout: string;
}> {
  const stderr: string[] = [];
  const stdout: string[] = [];
  const code = await runTestEvidenceCatalogCli(args, {
    cwd,
    io: {
      stderr: (text) => stderr.push(text),
      stdout: (text) => stdout.push(text)
    }
  });
  return { code, stderr: stderr.join(""), stdout: stdout.join("") };
}

async function runCatalogCliFailure(args: readonly string[]): Promise<{
  code: number;
  stderr: string;
  stdout: string;
}> {
  const result = await runCatalogCli(args);
  if (result.code === 0) {
    throw new Error(`CLI should fail: ${args.join(" ")}`);
  }
  return result;
}

async function runCatalogCliJson<T = unknown>(
  args: readonly string[],
  cwd?: string
): Promise<T> {
  const result = await runCatalogCli(args, cwd);
  assert.equal(result.code, 0, result.stderr);
  return JSON.parse(result.stdout) as T;
}

async function writeWorkspaceFile(
  workspaceRoot: string,
  relativePath: string,
  content: string
): Promise<void> {
  const targetPath = path.join(workspaceRoot, ...relativePath.split("/"));
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, content, "utf8");
}

async function writeTopicCatalog(
  workspaceRoot: string,
  catalogPath: string,
  topics: readonly {
    description: string;
    id: string;
  }[]
): Promise<void> {
  await writeWorkspaceFile(
    workspaceRoot,
    `${catalogPath}/test-evidence-topics.json`,
    `${JSON.stringify({ schemaVersion: 1, topics }, null, 2)}\n`
  );
}

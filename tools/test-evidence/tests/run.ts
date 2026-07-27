import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  listTestEvidenceTopics,
  queryTestEvidence,
  showTestEvidenceCase,
  syncTestEvidenceIndex,
  validateTestEvidence
} from "../src/cli.ts";
import { testEvidenceSourceRevision } from "../src/state-index.ts";
import "./repository-catalog.test.ts";

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
const topicCatalog = `${JSON.stringify({
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
}, null, 2)}\n`;
const accessCatalog = [
  "# Access Test Evidence",
  "",
  "```markdown",
  "### Case IGNORED-EXAMPLE-CASE-001: Fenced examples are not cases",
  "Entry:",
  "- `ignored.test.ts`",
  "Contract:",
  "- This example is ignored.",
  "Proves:",
  "- Nothing.",
  "```",
  "",
  "### Case AUTH-ROLE-ACCESS-001: Access tests cover role outcomes",
  "",
  "Entry:",
  "- `tests/access.test.ts`",
  "- `bun test tests/access.test.ts`",
  "",
  "Contract:",
  "- Resource mutation follows the caller role boundary.",
  "- Rejected mutations leave the resource unchanged.",
  "",
  "Proves:",
  "- Owners can edit.",
  "- Guests are denied.",
  ""
].join("\n");
const sessionCatalog = [
  "# Session Test Evidence",
  "",
  "### Case AUTH-SESSION-EXPIRY-001: Session tests cover expiry outcomes",
  "",
  "Entry:",
  "- `tests/session-expiry.test.ts`",
  "- `bun test tests/session-expiry.test.ts`",
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
      `${JSON.stringify({
        schemaVersion: 3,
        catalogPath: "elsewhere",
        indexPath: "elsewhere/index.json",
        caseIdPattern: "^CUSTOM$"
      }, null, 2)}\n`
    );
    await writeTopicCatalog(tempRoot, "elsewhere", [{
      id: "ignored",
      description: "Ignored legacy configuration target."
    }]);

    const queried = await queryTestEvidence({ workspaceRoot: tempRoot });
    assert.equal(queried.total, 2);
    assert.equal(queried.catalogPath, "docs/test-evidence");
    assert.equal(
      queried.indexPath,
      "docs/test-evidence/test-evidence-index.json"
    );

    const rejected = await runDistributedCliFailure([
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
      accessCatalog.replace(
        "AUTH-ROLE-ACCESS-001",
        "INVALID-001"
      )
    );
    const report = await validateTestEvidence({
      workspaceRoot: tempRoot
    });
    assert.ok(report.diagnostics.some((entry) => (
      entry.code === "catalog.invalid"
      && entry.message.includes("must include a valid case ID")
    )));
  });
});

test("missing indexes fall back to the catalog for validation and queries", async () => {
  await withWorkspace(async (tempRoot) => {
    const initialCheck = await validateTestEvidence({ workspaceRoot: tempRoot });
    assert.equal(initialCheck.summary.testCases, 2);
    assert.ok(initialCheck.diagnostics.some(
      (entry) => entry.code === "state-index.index-missing"
    ));

    const initialQuery = await queryTestEvidence({ workspaceRoot: tempRoot });
    assert.equal(initialQuery.total, 2);
    assert.ok(initialQuery.diagnostics.some(
      (entry) => entry.code === "state-index.index-missing"
        && entry.severity === "warning"
        && !entry.blocking
    ));
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

    const damagedIndexQuery = await queryTestEvidence({ workspaceRoot: tempRoot });
    assert.equal(damagedIndexQuery.total, 2);
    assert.ok(damagedIndexQuery.diagnostics.some(
      (entry) => entry.code === "state-index.json-invalid"
        && entry.severity === "warning"
        && !entry.blocking
    ));
    assert.equal(
      (await syncTestEvidenceIndex({
        mode: "write",
        workspaceRoot: tempRoot
      })).status,
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
      [
        "access-control/access-role.md",
        "sessions/session-expiry.md"
      ]
    );

    const searched = await queryTestEvidence({
      query: "session expired",
      workspaceRoot: tempRoot
    });
    assert.equal(searched.total, 1);
    assert.equal(searched.cases[0]?.id, "AUTH-SESSION-EXPIRY-001");

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
    assert.equal(
      shown.case?.sourcePath,
      "access-control/access-role.md"
    );
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
        "- `tests/legacy.test.ts`",
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
        "- `tests/duplicate.test.ts`",
        "- `tests/duplicate.test.ts`",
        "Contract:",
        "- A locator is registered once.",
        "Proves:",
        "- Nothing."
      ].join("\n"),
      /duplicates Entry/u
    );

  });
});

test("catalog validation rejects duplicate case IDs across topics", async () => {
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
      "- `tests/duplicate.test.ts`",
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

    assert.ok(report.diagnostics.some((entry) => (
      entry.code === "catalog.case-id-duplicate"
      && entry.message.includes("first/duplicate-case.md")
      && entry.message.includes("second/duplicate-case.md")
    )));
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
    const emptySetReport = await validateTestEvidence({ workspaceRoot: tempRoot });
    assert.deepEqual(emptySetReport.diagnostics, []);
    assert.equal(emptySetReport.summary.testCases, 0);

    await fs.mkdir(path.join(tempRoot, emptyCatalogPath, "future-work"));
    const emptyDirectoryReport = await validateTestEvidence({
      workspaceRoot: tempRoot
    });
    assert.ok(emptyDirectoryReport.diagnostics.some((entry) => (
      entry.code === "catalog.topic-directory-empty"
      && entry.path === `${emptyCatalogPath}/future-work`
    )));
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
    assert.ok(staleQuery.diagnostics.some(
      (entry) => entry.code === "state-index.index-stale"
        && entry.severity === "warning"
        && !entry.blocking
    ));

    const staleShow = await showTestEvidenceCase({
      caseId: "AUTH-ROLE-ACCESS-001",
      workspaceRoot: tempRoot
    });
    assert.match(staleShow.markdown ?? "", /Guests are denied\./u);
    assert.ok(staleShow.diagnostics.some(
      (entry) => entry.code === "state-index.index-stale"
        && entry.severity === "warning"
        && !entry.blocking
    ));
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
      fs.stat(path.join(
        tempRoot,
        "docs",
        "test-evidence",
        "test-evidence-index.json"
      )),
      (error: unknown) => (
        error instanceof Error
        && "code" in error
        && error.code === "ENOENT"
      )
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
          topics: [{
            id: "valid-topic",
            description: "Valid topic description.",
            unknown: true
          }]
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
          topics: [{
            id: "Invalid_Topic",
            description: " bad\n"
          }]
        })}\n`,
        expectedCode: "catalog.topics-schema-invalid",
        name: "invalid-values"
      },
      {
        content: `${JSON.stringify({
          schemaVersion: 1,
          topics: [{
            id: "short-description",
            description: "abc"
          }]
        })}\n`,
        expectedCode: "catalog.topics-schema-invalid",
        name: "short-description"
      },
      {
        content: `${JSON.stringify({
          schemaVersion: 1,
          topics: [{
            id: "long-description",
            description: "😀".repeat(201)
          }]
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
        result.diagnostics.some(
          (entry) => entry.code === variant.expectedCode
        ),
        variant.name
      );
    }

    await resetTestEvidenceCatalog(tempRoot);
    const unicodeCatalogPath = "docs/test-evidence";
    await writeTopicCatalog(tempRoot, unicodeCatalogPath, [{
      id: "unicode-description",
      description: "😀".repeat(200)
    }]);
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
    assert.ok(report.diagnostics.some(
      (entry) => entry.code === "catalog.topic-unknown"
    ));
    assert.ok(report.diagnostics.some(
      (entry) => entry.code === "catalog.root-file-unsupported"
    ));
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
    assert.ok(report.diagnostics.filter(
      (entry) => entry.code === "catalog.topic-entry-unsupported"
    ).length >= 3);
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
        path.join(
          tempRoot,
          "docs",
          "test-evidence",
          "test-evidence-index.json"
        )
      );
      const result = await syncTestEvidenceIndex({
        mode: "write",
        workspaceRoot: tempRoot
      });
      assert.equal(result.status, "error", candidate);
      assert.ok(result.diagnostics.some((entry) => (
        entry.code === "catalog.index-file-conflict"
      )), candidate);
    });
  }
});

test("indexes project sorted topic metadata and path-derived topic keys", async () => {
  await withWorkspace(async (tempRoot) => {
    await syncTestEvidenceIndex({ mode: "write", workspaceRoot: tempRoot });
    const index = JSON.parse(await fs.readFile(
      path.join(
        tempRoot,
        "docs",
        "test-evidence",
        "test-evidence-index.json"
      ),
      "utf8"
    )) as {
      definitionVersion: number;
      entries: Array<{
        id: string;
        keys: { topic: string[] };
        state: { sourcePath: string };
      }>;
      metadata: {
        topics: Array<{ description: string; id: string }>;
      };
    };
    assert.equal(index.definitionVersion, 3);
    assert.deepEqual(
      index.metadata.topics.map((topic) => topic.id),
      ["access-control", "future-work", "sessions"]
    );
    assert.deepEqual(
      index.entries.map((entry) => entry.keys.topic),
      [["access-control"], ["sessions"]]
    );
    assert.deepEqual(
      index.entries.map((entry) => entry.state.sourcePath),
      [
        "access-control/access-role.md",
        "sessions/session-expiry.md"
      ]
    );
  });
});

test("topic descriptions and case moves change source revisions without changing case identity", async () => {
  await withWorkspace(async (tempRoot) => {
    await syncTestEvidenceIndex({ mode: "write", workspaceRoot: tempRoot });
    const initialRevision = await readIndexRevision(tempRoot);
    const changedTopics = JSON.parse(topicCatalog) as {
      schemaVersion: 1;
      topics: Array<{ description: string; id: string }>;
    };
    changedTopics.topics[0]!.description =
      "Changed access-control contract tests.";
    await writeWorkspaceFile(
      tempRoot,
      "docs/test-evidence/test-evidence-topics.json",
      `${JSON.stringify(changedTopics, null, 2)}\n`
    );
    await syncTestEvidenceIndex({ mode: "write", workspaceRoot: tempRoot });
    const topicRevision = await readIndexRevision(tempRoot);
    assert.notEqual(topicRevision, initialRevision);

    await fs.rename(
      path.join(
        tempRoot,
        "docs",
        "test-evidence",
        "access-control",
        "access-role.md"
      ),
      path.join(
        tempRoot,
        "docs",
        "test-evidence",
        "sessions",
        "access-role.md"
      )
    );
    await fs.rmdir(path.join(
      tempRoot,
      "docs",
      "test-evidence",
      "access-control"
    ));
    const movedSync = await syncTestEvidenceIndex({
      mode: "write",
      workspaceRoot: tempRoot
    });
    assert.equal(movedSync.status, "ok");
    const movedRevision = await readIndexRevision(tempRoot);
    assert.notEqual(movedRevision, topicRevision);
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
    const parsedTopics = JSON.parse(topicCatalog) as {
      schemaVersion: 1;
      topics: Array<{ description: string; id: string }>;
    };
    const lfRevision = testEvidenceSourceRevision({
      sources: [{ path: "access-control/case.md", text: "line\nnext\n" }],
      topicCatalog: parsedTopics
    });
    const crlfRevision = testEvidenceSourceRevision({
      sources: [{ path: "access-control/case.md", text: "line\r\nnext\r\n" }],
      topicCatalog: parsedTopics
    });
    assert.equal(lfRevision, crlfRevision);

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
    assert.equal(await readIndexRevision(tempRoot), initialRevision);
  });
});

test("persisted metadata, source paths, and topic keys are validated as one projection", async () => {
  await withWorkspace(async (tempRoot) => {
    await syncTestEvidenceIndex({ mode: "write", workspaceRoot: tempRoot });
    const indexPath = path.join(
      tempRoot,
      "docs",
      "test-evidence",
      "test-evidence-index.json"
    );
    const index = JSON.parse(await fs.readFile(indexPath, "utf8")) as {
      entries: Array<{
        keys: { topic: string[] };
        state: { sourcePath: string };
      }>;
      metadata: {
        topics: Array<{ description: string; id: string }>;
      };
    };
    index.entries[0]!.keys.topic = ["sessions"];
    await fs.writeFile(indexPath, `${JSON.stringify(index, null, 2)}\n`);
    const keyMismatch = await queryTestEvidence({ workspaceRoot: tempRoot });
    assert.equal(keyMismatch.total, 2);
    assert.ok(keyMismatch.diagnostics.some((entry) => (
      entry.severity === "warning"
      && entry.code.startsWith("state-index.")
    )));

    await syncTestEvidenceIndex({ mode: "write", workspaceRoot: tempRoot });
    const rebuilt = JSON.parse(await fs.readFile(indexPath, "utf8")) as {
      entries: Array<{ state: { sourcePath: string } }>;
      metadata: {
        topics: Array<{ description: string; id: string }>;
      };
    };
    rebuilt.entries[0]!.state.sourcePath = "unknown-topic/access-role.md";
    await fs.writeFile(indexPath, `${JSON.stringify(rebuilt, null, 2)}\n`);
    const pathMismatch = await queryTestEvidence({ workspaceRoot: tempRoot });
    assert.equal(pathMismatch.total, 2);
    assert.ok(pathMismatch.diagnostics.some((entry) => (
      entry.severity === "warning"
      && entry.code.startsWith("state-index.")
    )));
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
    assert.equal(
      shown.topic?.description,
      "Session lifecycle contract tests."
    );
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
    assert.ok(publicFailure.diagnostics.some(
      (entry) => entry.code === "query.topic-unknown"
    ));

    const unknown = await runDistributedCliFailure([
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
    assert.ok(unknownResult.diagnostics.some(
      (entry) => entry.code === "query.topic-unknown"
    ));

    const repeated = await runDistributedCliFailure([
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
    assert.ok(result.diagnostics.some((entry) => (
      entry.blocking
      && entry.code === "state-index.revision-read-failed"
    )));
    const synchronized = await syncTestEvidenceIndex({
      mode: "write",
      workspaceRoot: tempRoot
    });
    assert.equal(synchronized.status, "error");
    assert.ok(synchronized.diagnostics.some(
      (entry) => entry.code === "catalog.root-file-unsupported"
    ));
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

    const unreadableQuery = await queryTestEvidence({ workspaceRoot: tempRoot });
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
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), "test-evidence-"));
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

async function resetTestEvidenceCatalog(
  workspaceRoot: string
): Promise<void> {
  await fs.rm(
    path.join(workspaceRoot, "docs", "test-evidence"),
    { force: true, recursive: true }
  );
}

function assertUnrecoverableIndexReadFailure(
  diagnostics: readonly {
    blocking: boolean;
    code: string;
    message: string;
    severity: "error" | "warning";
  }[]
): void {
  const failure = diagnostics.find((entry) => (
    entry.code === "state-index.index-read-failed"
  ));
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

  const topicsChild = await execFileAsync(
    "node",
    [distributedScript, "topics", "--root", workspaceRoot, "--json"],
    {
      encoding: "utf8",
      windowsHide: true
    }
  );
  const topicsResult = JSON.parse(String(topicsChild.stdout)) as {
    schemaVersion: number;
    topics: Array<{ id: string }>;
  };
  assert.equal(topicsResult.schemaVersion, 4);
  assert.deepEqual(
    topicsResult.topics.map((topic) => topic.id),
    ["access-control", "future-work", "sessions"]
  );

  const indexPath = path.join(
    workspaceRoot,
    "docs",
    "test-evidence",
    "test-evidence-index.json"
  );
  await fs.rm(indexPath);
  await fs.mkdir(indexPath);
  for (const command of [
    ["list"],
    ["show", "AUTH-ROLE-ACCESS-001"]
  ]) {
    try {
      await execFileAsync(
        "node",
        [
          distributedScript,
          ...command,
          "--root",
          workspaceRoot,
          "--json"
        ],
        {
          encoding: "utf8",
          windowsHide: true
        }
      );
      assert.fail(`${command[0]} should fail when the index cannot be read`);
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
}

async function rehearseLegacyConsumerUpgrade(
  legacyVersion: 1 | 2
): Promise<void> {
  const workspaceRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), `test-evidence-v${legacyVersion}-upgrade-`)
  );
  const legacyCatalogPath = legacyVersion === 1
    ? "docs/test-evidence.md"
    : "docs/test-evidence/cases";
  const stagedCatalogPath = "docs/test-evidence-next";
  const retainedLegacyCatalogPath = legacyVersion === 1
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
      `${JSON.stringify({
        schemaVersion: legacyVersion,
        catalogPath: legacyCatalogPath,
        indexPath: "docs/legacy-test-evidence-index.json"
      }, null, 2)}\n`
    );

    const legacyFailure = await runDistributedCliFailure([
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

    const topics = await runDistributedCliJson<{
      topics: Array<{ id: string }>;
    }>(["topics", "--root", workspaceRoot, "--json"]);
    assert.deepEqual(
      topics.topics.map((topic) => topic.id),
      ["access-control", "sessions"]
    );

    await runDistributedCliJson([
      "sync-index",
      "--write",
      "--root",
      workspaceRoot,
      "--json"
    ]);
    const checked = await runDistributedCliJson<{
      diagnostics: Array<{ blocking: boolean }>;
      summary: { testCases: number };
    }>(["check", "--root", workspaceRoot, "--json"]);
    assert.equal(checked.summary.testCases, 2);
    assert.equal(
      checked.diagnostics.some((diagnostic) => diagnostic.blocking),
      false
    );

    const listed = await runDistributedCliJson<{
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
    assert.deepEqual(listed.cases.map(({ id, sourcePath }) => ({
      id,
      sourcePath
    })), [
      {
        id: "AUTH-ROLE-ACCESS-001",
        sourcePath: "access-control/access-role.md"
      }
    ]);

    const shown = await runDistributedCliJson<{
      case: { id: string; sourcePath: string } | null;
      markdown: string | null;
      topic: { id: string } | null;
    }>([
      "show",
      "AUTH-SESSION-EXPIRY-001",
      "--root",
      workspaceRoot,
      "--json"
    ]);
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
    const afterLegacyChange = await runDistributedCliJson<{
      total: number;
    }>(["list", "--root", workspaceRoot, "--json"]);
    assert.equal(afterLegacyChange.total, 2);
  } finally {
    await fs.rm(workspaceRoot, { force: true, recursive: true });
  }
}

async function readIndexRevision(workspaceRoot: string): Promise<string> {
  const index = JSON.parse(await fs.readFile(
    path.join(
      workspaceRoot,
      "docs",
      "test-evidence",
      "test-evidence-index.json"
    ),
    "utf8"
  )) as { sourceRevision: string };
  return index.sourceRevision;
}

async function runDistributedCliFailure(
  args: readonly string[]
): Promise<{
  code: number | string | undefined;
  stderr: string;
  stdout: string;
}> {
  try {
    await execFileAsync(
      "node",
      [distributedScript, ...args],
      { encoding: "utf8", windowsHide: true }
    );
  } catch (error) {
    const failure = error as Error & {
      code?: number | string;
      stderr?: string;
      stdout?: string;
    };
    return {
      code: failure.code,
      stderr: failure.stderr ?? "",
      stdout: failure.stdout ?? ""
    };
  }
  throw new Error(`CLI should fail: ${args.join(" ")}`);
}

async function runDistributedCliJson<T = unknown>(
  args: readonly string[]
): Promise<T> {
  const child = await execFileAsync(
    "node",
    [distributedScript, ...args],
    { encoding: "utf8", windowsHide: true }
  );
  return JSON.parse(String(child.stdout)) as T;
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

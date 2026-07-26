import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  queryTestEvidence,
  showTestEvidenceCase
} from "../src/cli.ts";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  ".."
);

test("queries the repository catalog by contract and proof terms", async () => {
  const result = await queryTestEvidence({
    query: "uninspectable catalog blocking",
    workspaceRoot: repositoryRoot
  });

  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.total, 1);
  assert.equal(result.cases[0]?.id, "TEST-EVIDENCE-CONFIG-PATH-001");
  assert.equal(
    result.cases[0]?.sourcePath,
    "docs/test-evidence/cases/test-evidence.md"
  );
});

test("shows the authoritative Markdown for a repository case", async () => {
  const result = await showTestEvidenceCase({
    caseId: "TEST-EVIDENCE-CONFIG-PATH-001",
    workspaceRoot: repositoryRoot
  });

  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.case?.id, "TEST-EVIDENCE-CONFIG-PATH-001");
  assert.equal(
    result.case?.sourcePath,
    "docs/test-evidence/cases/test-evidence.md"
  );
  assert.match(
    result.markdown ?? "",
    /config\.path-inspection-failed/u
  );
  assert.doesNotMatch(
    result.markdown ?? "",
    /TEST-EVIDENCE-QUERY-REPOSITORY-001/u
  );
});

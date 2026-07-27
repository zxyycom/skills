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
    "test-evidence/rejects-a-catalog-path-that-cannot-be-inspected.md"
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
    "test-evidence/rejects-a-catalog-path-that-cannot-be-inspected.md"
  );
  assert.deepEqual(result.topic, {
    id: "test-evidence",
    description: "测试证据目录的配置、路径与 case 结构、统一索引同步与回退、"
      + "查询展示，以及 CLI 和分发 API 契约。"
  });
  assert.match(
    result.markdown ?? "",
    /config\.path-inspection-failed/u
  );
  assert.doesNotMatch(
    result.markdown ?? "",
    /TEST-EVIDENCE-QUERY-REPOSITORY-001/u
  );
});

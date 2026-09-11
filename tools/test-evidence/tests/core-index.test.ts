import assert from "node:assert/strict";
import os from "node:os";
import test from "node:test";
import { queryTestEvidence, syncTestEvidenceIndex } from "../src/core.ts";
import { fs, path } from "./core-test-support.ts";

test("indexed Case filters compose exact matches, lexical order, and paging", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "test-evidence-query-"));
  const cases = path.join(root, "docs/test-evidence/cases");
  await fs.mkdir(cases, { recursive: true });
  await Promise.all(
    Array.from({ length: 13 }, async (_, index) => {
      const id = String(index).padStart(3, "0");
      await fs.writeFile(
        path.join(cases, `case-${id}.md`),
        `### Case QUERY-CASE-ENTRY-${id}: query ${id}\n\nTests:\n- \`test:${id}\`\n\nTags:\n- \`alpha\`\n${index % 2 === 0 ? "- `even`\n" : ""}\nContract:\n- composable query\n\nProves:\n- ordered result\n`
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
  assert.equal(result.cases[0]?.id, "QUERY-CASE-ENTRY-010");
  const page = await queryTestEvidence({
    workspaceRoot: root,
    tags: ["alpha"],
    limit: 3,
    offset: 10
  });
  assert.deepEqual(
    page.cases.map((entry) => entry.id),
    ["QUERY-CASE-ENTRY-010", "QUERY-CASE-ENTRY-011", "QUERY-CASE-ENTRY-012"]
  );
});

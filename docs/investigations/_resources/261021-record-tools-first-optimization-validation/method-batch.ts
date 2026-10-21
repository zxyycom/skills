import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { reportMarkdown } from "./baseline/tools/investigation-report/tests/fixture-support.ts";
import { publishInvestigationCandidatesWithWriter } from "/workspace/skills/tools/investigation-report/src/publish.ts";
import { writeIndexAtomically } from "/workspace/skills/tools/investigation-report/src/publish-index-writer.ts";
const base = path.resolve(import.meta.dirname);
const records = Array.from({ length: 10 }, (_, i) => ({
  id: `261021-batch-${i}`,
  formedAt: "2026-10-21T00:00:00Z"
}));
for (const mode of ["individual", "batch"]) {
  const root = path.join(base, "datasets", `publish-${mode}`);
  await fs.cp(
    path.join(base, "datasets/1000/docs/investigations"),
    path.join(root, "docs/investigations"),
    { recursive: true, errorOnExist: true, force: false }
  );
  for (const record of records)
    await fs.writeFile(
      path.join(root, "docs/investigations", `_candidate.${record.id}`),
      reportMarkdown(record)
    );
  let publications = 0;
  const write: typeof writeIndexAtomically = async (...args) => {
    publications += 1;
    return await writeIndexAtomically(...args);
  };
  const start = performance.now();
  const groups =
    mode === "individual"
      ? records.map((record) => [record.id])
      : [records.map((record) => record.id)];
  for (const ids of groups) {
    const result = await publishInvestigationCandidatesWithWriter(
      { workspaceRoot: root, ids },
      write
    );
    assert.deepEqual(result.errors, []);
    assert.equal(result.changed, true);
  }
  const elapsedMs = performance.now() - start;
  const data = await fs.readFile(
    path.join(root, "docs/investigations/investigation-index.json")
  );
  console.log(
    JSON.stringify({
      startedAt: new Date().toISOString(),
      mode,
      initialRecords: 1000,
      candidates: 10,
      calls: groups.length,
      publications,
      elapsedMs,
      finalIndexSha256: createHash("sha256").update(data).digest("hex")
    })
  );
}

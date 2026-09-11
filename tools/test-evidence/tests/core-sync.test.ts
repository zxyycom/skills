import assert from "node:assert/strict";
import test from "node:test";
import { syncTestEvidenceIndex } from "../src/core.ts";
import { fixture, fs, path } from "./core-test-support.ts";

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

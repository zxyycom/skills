import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { readCandidateSchemas } from "../../../publish-native-skills.ts";

test("publication reads all frozen role schemas and rejects a missing resource schema", async () => {
  const stage = await fs.mkdtemp(
    path.join(os.tmpdir(), "native-publication-schemas-")
  );
  try {
    const dir = path.join(stage, "delivery/tools/record-contracts/schemas");
    await fs.mkdir(dir, { recursive: true });
    for (const name of [
      "decision-index",
      "investigation-index",
      "resource-record",
      "resource-index"
    ])
      await fs.writeFile(
        path.join(dir, `${name}.schema.json`),
        `frozen:${name}`
      );
    const schemas = await readCandidateSchemas(stage);
    assert.deepEqual(schemas["decision-records"].map(String), [
      "frozen:decision-index"
    ]);
    assert.deepEqual(schemas["investigation-report"].map(String), [
      "frozen:investigation-index"
    ]);
    assert.deepEqual(schemas["resource-records"].map(String), [
      "frozen:resource-record",
      "frozen:resource-index"
    ]);
    await fs.unlink(path.join(dir, "resource-index.schema.json"));
    await assert.rejects(readCandidateSchemas(stage), { code: "ENOENT" });
  } finally {
    await fs.rm(stage, { recursive: true, force: true });
  }
});

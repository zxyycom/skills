import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import {
  synchronizeInvestigationIndex,
  validateInvestigationReports
} from "../src/validation.ts";
import {
  investigationRoot,
  parseJsonObject,
  jsonObjectMember,
  withTempRoot,
  writeCollection
} from "./v6-support.ts";

async function mutateAfterSourceRead<T>(source: string, run: () => Promise<T>) {
  const original = fs.readFile;
  let reads = 0;
  fs.readFile = (async (...args: Parameters<typeof fs.readFile>) => {
    const value = await original(...args);
    if (args[0] === source && ++reads === 1)
      await fs.appendFile(source, "\nchanged after acquisition\n");
    return value;
  }) as typeof fs.readFile;
  try {
    return { result: await run(), reads };
  } finally {
    fs.readFile = original;
  }
}

test("full investigation check validates each first-acquired source once without an end freshness promise", async () => {
  await withTempRoot("check-first-acquisition", async (root) => {
    await writeCollection(root, [{ id: "one" }, { id: "two" }]);
    const source = path.join(investigationRoot(root), "one.md");
    const observed = await mutateAfterSourceRead(source, () =>
      validateInvestigationReports({ workspaceRoot: root })
    );
    assert.deepEqual(observed.result.errors, []);
    assert.equal(observed.result.indexChecked, true);
    assert.equal(observed.reads, 1);
    assert.ok(
      (await validateInvestigationReports({ workspaceRoot: root })).errors
        .length > 0
    );
  });
});

test("full investigation check compares the complete projection even when source revision matches", async () => {
  await withTempRoot("check-full-projection", async (root) => {
    await writeCollection(root, [{ id: "one" }]);
    const target = path.join(
      investigationRoot(root),
      "investigation-index.json"
    );
    const index = parseJsonObject(await fs.readFile(target, "utf8"));
    jsonObjectMember(jsonObjectMember(index, "entries"), "one").title =
      "forged published metadata";
    await fs.writeFile(target, JSON.stringify(index, null, 2) + "\n");
    const checked = await validateInvestigationReports({ workspaceRoot: root });
    assert.ok(
      checked.diagnostics.some(
        (item) => item.code === "state-index.index-stale"
      )
    );
  });
});

test("investigation sync retains end source drift protection while readonly check does not", async () => {
  await withTempRoot("sync-source-drift", async (root) => {
    await writeCollection(root, [{ id: "one" }]);
    const target = path.join(
      investigationRoot(root),
      "investigation-index.json"
    );
    const before = await fs.readFile(target, "utf8");
    const observed = await mutateAfterSourceRead(
      path.join(investigationRoot(root), "one.md"),
      () => synchronizeInvestigationIndex({ workspaceRoot: root })
    );
    assert.ok(
      observed.result.errors.some((error) => /source-drift/u.test(error))
    );
    assert.ok(observed.reads > 1);
    assert.equal(await fs.readFile(target, "utf8"), before);
  });
});

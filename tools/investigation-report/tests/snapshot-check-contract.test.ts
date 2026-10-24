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
  withTempRoot
} from "./fixture-support.ts";
import { writeCollection } from "./collection-support.ts";

async function mutateAfterSourceRead<T>(source: string, run: () => Promise<T>) {
  const original = fs.open;
  let reads = 0;
  fs.open = (async (...args: Parameters<typeof fs.open>) => {
    const handle = await original(...args);
    if (args[0] === source) {
      const close = handle.close.bind(handle);
      handle.close = async () => {
        await close();
        if (++reads === 1)
          await fs.appendFile(source, "\nchanged after acquisition\n");
      };
    }
    return handle;
  }) as typeof fs.open;
  try {
    return { result: await run(), reads };
  } finally {
    fs.open = original;
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

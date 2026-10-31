import { assertSelectedSourceSafety } from "../../../record-operations/tests/selected-source-safety.ts";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  synchronizeInvestigationIndex,
  validateInvestigationReports
} from "../../src/records/validation/validation.ts";
import {
  writeCollection,
  writeResource
} from "../support/collection-support.ts";
import {
  investigationRoot,
  reportMarkdown,
  withTempRoot
} from "../support/fixture-support.ts";

const a = "260828-alpha";
const b = "260828-beta";
const selected = (workspaceRoot: string, selectors: readonly string[]) =>
  synchronizeInvestigationIndex({ workspaceRoot, selectors });
const indexPath = (root: string) =>
  path.join(investigationRoot(root), "investigation-index.json");

test("Investigation selected sync retains unrelated published facts without reading malformed bodies", async () => {
  await withTempRoot("selected-local-unrelated", async (root) => {
    await writeCollection(root, [{ id: a }, { id: b }]);
    const before = JSON.parse(await fs.readFile(indexPath(root), "utf8"));
    await fs.writeFile(
      path.join(investigationRoot(root), a + ".md"),
      reportMarkdown({ id: a, title: "Changed alpha" })
    );
    await fs.writeFile(
      path.join(investigationRoot(root), b + ".md"),
      "invalid unrelated body\n"
    );
    const result = await selected(root, [a]);
    assert.deepEqual(result.errors, []);
    assert.deepEqual(result.coverage, {
      source: "published-index+selected-current-sources",
      currentness: "selected-and-dependencies",
      checkedIds: [a]
    });
    const after = JSON.parse(await fs.readFile(indexPath(root), "utf8"));
    assert.equal(after.entries[a].title, "Changed alpha");
    assert.deepEqual(after.entries[b], before.entries[b]);
    assert.equal(
      after.sourceRevision.entries[b],
      before.sourceRevision.entries[b]
    );
    assert.ok(
      (await validateInvestigationReports({ workspaceRoot: root })).errors
        .length > 0
    );
  });
});

test("Investigation selected sync requires both identities for observed same-path ID corrections", async () => {
  await withTempRoot("selected-local-identity", async (root) => {
    await writeCollection(root, [{ id: a }, { id: b }]);
    const next = "260828-renamed";
    const source = path.join(investigationRoot(root), a + ".md");
    await fs.writeFile(source, reportMarkdown({ id: next }));
    const before = await fs.readFile(indexPath(root));
    assert.ok((await selected(root, [a])).errors.length > 0);
    assert.deepEqual(await fs.readFile(indexPath(root)), before);
    const result = await selected(root, [a, next]);
    assert.deepEqual(result.errors, []);
    const after = JSON.parse(await fs.readFile(indexPath(root), "utf8"));
    assert.equal(Object.hasOwn(after.entries, a), false);
    assert.equal(after.entries[next].sourcePath, a + ".md");
    assert.deepEqual(result.coverage?.checkedIds, [a, next]);
  });
});

test("Investigation selected sync uses missing locations as deletions and rejects unknown selected identities", async () => {
  await withTempRoot("selected-local-unknown", async (root) => {
    await writeCollection(root, [{ id: a }, { id: b }]);
    const moved = path.join(investigationRoot(root), "unknown-location.md");
    await fs.rename(path.join(investigationRoot(root), a + ".md"), moved);
    const before = await fs.readFile(indexPath(root));
    assert.match(
      (await selected(root, ["260828-unseen"])).errors.join("; "),
      /full sync-index/
    );
    assert.deepEqual(await fs.readFile(indexPath(root)), before);
    const result = await selected(root, [a]);
    assert.deepEqual(result.errors, []);
    assert.deepEqual(result.coverage?.checkedIds, [a]);
    assert.equal(
      Object.hasOwn(
        JSON.parse(await fs.readFile(indexPath(root), "utf8")).entries,
        a
      ),
      false
    );
    assert.match(await fs.readFile(moved, "utf8"), new RegExp(a));
  });
});

test("Investigation selected sync validates relevant current dependencies and complete deletion closure", async () => {
  await withTempRoot("selected-local-dependencies", async (root) => {
    await writeCollection(root, [
      { id: a },
      { id: b, relations: [{ type: "补充", target: a }] }
    ]);
    const before = await fs.readFile(indexPath(root));
    await fs.writeFile(
      path.join(investigationRoot(root), a + ".md"),
      reportMarkdown({ id: a, title: "Unpublished dependency" })
    );
    assert.match(
      (await selected(root, [b])).errors.join("; "),
      /Required dependency differs/
    );
    assert.deepEqual(await fs.readFile(indexPath(root)), before);
    await fs.rm(path.join(investigationRoot(root), a + ".md"));
    assert.ok((await selected(root, [a])).errors.length > 0);
    assert.deepEqual(await fs.readFile(indexPath(root)), before);
  });
});

test("Investigation selected sync checks required owner resources and rejects later source drift", async () => {
  await withTempRoot("selected-local-resources", async (root) => {
    await writeCollection(
      root,
      [{ id: a, resources: [a + "/evidence.txt"] }, { id: b }],
      false
    );
    await writeResource(root, a + "/evidence.txt", "evidence\n");
    assert.deepEqual(
      (await synchronizeInvestigationIndex({ workspaceRoot: root })).errors,
      []
    );
    const index = indexPath(root);
    const before = await fs.readFile(index);
    await fs.rm(
      path.join(investigationRoot(root), "_resources", a, "evidence.txt")
    );
    assert.ok((await selected(root, [a])).errors.length > 0);
    assert.deepEqual(await fs.readFile(index), before);
    await writeResource(root, a + "/evidence.txt", "evidence\n");
    const source = path.join(investigationRoot(root), a + ".md");
    const originalOpen = fs.open;
    let reads = 0;
    fs.open = (async (...args) => {
      if (args[0] === source && ++reads === 2)
        await fs.writeFile(source, "later edit\n");
      return originalOpen(...args);
    }) as typeof fs.open;
    let result;
    try {
      result = await selected(root, [a]);
    } finally {
      fs.open = originalOpen;
    }
    assert.ok(result.errors.length > 0);
    assert.equal(await fs.readFile(source, "utf8"), "later edit\n");
    assert.deepEqual(await fs.readFile(index), before);
  });
});

test("Investigation selected sync rejects unsafe source links invalid UTF8 and fresh mode drift", async () => {
  for (const fault of ["symlink", "utf8", "mode"] as const)
    await withTempRoot("selected-local-safety-" + fault, async (root) => {
      await writeCollection(root, [{ id: a }, { id: b }]);
      await assertSelectedSourceSafety({
        root,
        source: path.join(investigationRoot(root), a + ".md"),
        index: indexPath(root),
        fault,
        synchronize: async () => {
          const result = await selected(root, [a]);
          return { rejected: result.errors.length > 0, details: result };
        }
      });
    });
});

test("Investigation selected removals reject known old owner remnants including empty and case variant paths", async () => {
  for (const remnant of ["file", "empty", "case", "symlink"] as const)
    await withTempRoot("selected-local-owner-" + remnant, async (root) => {
      await writeCollection(root, [{ id: a }, { id: b }]);
      const resourceRoot = path.join(investigationRoot(root), "_resources");
      await fs.mkdir(resourceRoot);
      const owner = path.join(
        resourceRoot,
        remnant === "case" ? a.toUpperCase() : a
      );
      if (remnant === "file") await fs.writeFile(owner, "unsafe owner file\n");
      else if (remnant === "symlink") await fs.symlink(root, owner);
      else await fs.mkdir(owner);
      await fs.rm(path.join(investigationRoot(root), a + ".md"));
      const before = await fs.readFile(indexPath(root));
      const result = await selected(root, [a]);
      assert.ok(result.errors.length > 0);
      assert.match(result.errors.join("; "), /owner path still exists/);
      assert.deepEqual(await fs.readFile(indexPath(root)), before);
      await fs.lstat(owner);
    });
});

test("Investigation selected removal fresh rejects a later old owner and preserves its contents", async () => {
  await withTempRoot("selected-local-owner-fresh", async (root) => {
    await writeCollection(root, [{ id: a }, { id: b }]);
    await fs.rm(path.join(investigationRoot(root), a + ".md"));
    const index = indexPath(root);
    const before = await fs.readFile(index);
    const owner = path.join(investigationRoot(root), "_resources", a);
    const originalOpen = fs.open;
    let reads = 0;
    fs.open = (async (...args) => {
      if (args[0] === index && ++reads === 3) {
        await fs.mkdir(owner, { recursive: true });
        await fs.writeFile(
          path.join(owner, "winner.txt"),
          "later owner content\n"
        );
      }
      return originalOpen(...args);
    }) as typeof fs.open;
    let result;
    try {
      result = await selected(root, [a]);
    } finally {
      fs.open = originalOpen;
    }
    assert.ok(result.errors.length > 0);
    assert.equal(
      await fs.readFile(path.join(owner, "winner.txt"), "utf8"),
      "later owner content\n"
    );
    assert.deepEqual(await fs.readFile(index), before);
  });
});

test("Investigation selected owner absence does not inspect unrelated owner trees", async () => {
  await withTempRoot("selected-local-unrelated-owner", async (root) => {
    await writeCollection(root, [{ id: a }, { id: b }]);
    const resourceRoot = path.join(investigationRoot(root), "_resources");
    await fs.mkdir(resourceRoot);
    await fs.symlink(root, path.join(resourceRoot, "unrelated-owner"));
    await fs.rm(path.join(investigationRoot(root), a + ".md"));
    const result = await selected(root, [a]);
    assert.deepEqual(result.errors, []);
    assert.equal(
      Object.hasOwn(
        JSON.parse(await fs.readFile(indexPath(root), "utf8")).entries,
        a
      ),
      false
    );
    assert.equal(
      (
        await fs.lstat(path.join(resourceRoot, "unrelated-owner"))
      ).isSymbolicLink(),
      true
    );
  });
});

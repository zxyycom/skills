import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { stageInvestigationReports } from "../src/staging.ts";
import {
  git,
  initializeGit,
  investigationRoot,
  withTempRoot,
  writeCollection
} from "./v6-support.ts";

const resourceRelative =
  "docs/investigations/_resources/one/nested/unreferenced.txt";

function componentPath(root: string, component: string): string {
  const resources = path.join(investigationRoot(root), "_resources");
  switch (component) {
    case "root":
      return resources;
    case "owner":
      return path.join(resources, "one");
    case "intermediate":
      return path.join(resources, "one", "nested");
    case "file":
      return path.join(root, resourceRelative);
    default:
      throw new Error(`Unknown fixture component: ${component}`);
  }
}

async function prepareUnreferencedResource(root: string): Promise<void> {
  await fs.mkdir(path.dirname(path.join(root, resourceRelative)), {
    recursive: true
  });
  await fs.writeFile(path.join(root, resourceRelative), "baseline bytes\n");
  await writeCollection(root, [{ id: "one" }, { id: "other" }]);
  initializeGit(root);
}

async function replaceWithSymlink(
  root: string,
  component: string,
  bytes: string
): Promise<void> {
  const target = componentPath(root, component);
  const external = path.join(root, "external-target");
  const suffix =
    component === "root"
      ? "one/nested/unreferenced.txt"
      : component === "owner"
        ? "nested/unreferenced.txt"
        : component === "intermediate"
          ? "unreferenced.txt"
          : "";
  const externalFile = suffix === "" ? external : path.join(external, suffix);
  await fs.mkdir(path.dirname(externalFile), { recursive: true });
  await fs.writeFile(externalFile, bytes);
  await fs.rename(target, path.join(root, "saved-component"));
  await fs.symlink(external, target);
}

async function observeResourceReads<T>(
  root: string,
  run: () => Promise<T>,
  afterFirst?: () => Promise<void>
) {
  const readFile = fs.readFile;
  let reads = 0;
  fs.readFile = (async (...args: Parameters<typeof fs.readFile>) => {
    const bytes = await readFile(...args);
    if (args[0] === path.join(root, resourceRelative)) {
      reads += 1;
      if (reads === 1) await afterFirst?.();
    }
    return bytes;
  }) as typeof fs.readFile;
  try {
    return { result: await run(), reads };
  } finally {
    fs.readFile = readFile;
  }
}

for (const component of ["root", "owner", "intermediate", "file"]) {
  test(`local investigation stage rejects initial unreferenced resource symlink at ${component}`, async () => {
    await withTempRoot("stage-resource-initial-symlink", async (root) => {
      await prepareUnreferencedResource(root);
      await replaceWithSymlink(root, component, "external replacement bytes\n");
      const before = await fs.readFile(path.join(root, ".git", "index"));
      for (const scope of ["domain", "all"] as const) {
        const observed = await observeResourceReads(root, () =>
          stageInvestigationReports({
            workspaceRoot: root,
            reportIds: ["one"],
            scope
          })
        );
        assert.equal(observed.result.status, "error");
        assert.equal(
          observed.reads,
          0,
          "unsafe paths must be rejected before acquiring external bytes"
        );
        assert.deepEqual(
          await fs.readFile(path.join(root, ".git", "index")),
          before
        );
      }
    });
  });
}

for (const component of ["root", "owner", "intermediate", "file"]) {
  test(`local investigation stage rejects same-byte unreferenced resource symlink replacement at ${component} between phases`, async () => {
    for (const scope of ["domain", "all"] as const) {
      await withTempRoot("stage-resource-phase-symlink", async (root) => {
        await prepareUnreferencedResource(root);
        const before = await fs.readFile(path.join(root, ".git", "index"));
        const observed = await observeResourceReads(
          root,
          () =>
            stageInvestigationReports({
              workspaceRoot: root,
              reportIds: ["one"],
              scope
            }),
          () => replaceWithSymlink(root, component, "baseline bytes\n")
        );
        assert.equal(
          observed.reads,
          1,
          "write-before validation must not reread through the replacement symlink"
        );
        assert.equal(observed.result.status, "error");
        assert.equal(observed.result.state, "source-drift");
        assert.deepEqual(
          await fs.readFile(path.join(root, ".git", "index")),
          before
        );
      });
    }
  });
}

for (const component of ["root", "owner", "intermediate", "file"]) {
  test(`local investigation stage preserves legitimate unreferenced resource deletion at ${component}`, async () => {
    await withTempRoot("stage-resource-safe-deletion", async (root) => {
      await prepareUnreferencedResource(root);
      await fs.rm(componentPath(root, component), { recursive: true });
      const result = await stageInvestigationReports({
        workspaceRoot: root,
        reportIds: ["one"],
        scope: "domain"
      });
      assert.equal(result.status, "ok");
      assert.deepEqual(result.writtenPaths, [resourceRelative]);
      assert.equal(
        git(root, ["diff", "--cached", "--name-status"]),
        `D\t${resourceRelative}\n`
      );
    });
  });
}

for (const component of ["root", "owner"]) {
  test(`local investigation stage rejects empty selected resource ${component} symlink without direct references or HEAD members`, async () => {
    await withTempRoot("stage-resource-empty-symlink", async (root) => {
      await writeCollection(root, [{ id: "one" }]);
      initializeGit(root);
      const external = path.join(root, "external-empty");
      await fs.mkdir(external);
      const target = componentPath(root, component);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.symlink(external, target);
      const before = await fs.readFile(path.join(root, ".git", "index"));
      const result = await stageInvestigationReports({
        workspaceRoot: root,
        reportIds: ["one"],
        scope: "domain"
      });
      assert.equal(result.status, "error");
      assert.deepEqual(
        await fs.readFile(path.join(root, ".git", "index")),
        before
      );
    });
  });
}

test("local investigation stage ignores unrelated symlink resource trees without inspecting their contents", async () => {
  await withTempRoot("stage-resource-unrelated-symlink", async (root) => {
    await prepareUnreferencedResource(root);
    const external = path.join(root, "external-other");
    await fs.mkdir(external);
    await fs.writeFile(
      path.join(external, "do-not-read.txt"),
      "unrelated external bytes\n"
    );
    const other = path.join(investigationRoot(root), "_resources", "other");
    await fs.symlink(external, other);
    await fs.writeFile(
      path.join(root, resourceRelative),
      "selected changed bytes\n"
    );
    const originalLstat = fs.lstat;
    const originalReaddir = fs.readdir;
    const assertLocal = (target: unknown): void => {
      if (typeof target === "string") {
        assert.ok(target !== other && !target.startsWith(other + path.sep));
        assert.ok(
          target !== external && !target.startsWith(external + path.sep)
        );
      }
    };
    fs.lstat = (async (...args: Parameters<typeof fs.lstat>) => {
      assertLocal(args[0]);
      return await originalLstat(...args);
    }) as typeof fs.lstat;
    fs.readdir = (async (...args: Parameters<typeof fs.readdir>) => {
      assertLocal(args[0]);
      return await originalReaddir(...args);
    }) as typeof fs.readdir;
    try {
      const result = await stageInvestigationReports({
        workspaceRoot: root,
        reportIds: ["one"],
        scope: "domain"
      });
      assert.equal(result.status, "ok");
      assert.deepEqual(result.writtenPaths, [resourceRelative]);
      assert.equal(
        git(root, ["show", `:${resourceRelative}`]),
        "selected changed bytes\n"
      );
      assert.equal(
        git(root, ["diff", "--cached", "--name-only"]),
        resourceRelative + "\n"
      );
    } finally {
      fs.lstat = originalLstat;
      fs.readdir = originalReaddir;
    }
  });
});

test("local investigation stage preserves ordinary unreferenced member filenames for writes and deletions", async () => {
  await withTempRoot("stage-resource-literal-member", async (root) => {
    const relative =
      "docs/investigations/_resources/one/unreferenced notes.txt";
    await fs.mkdir(path.dirname(path.join(root, relative)), {
      recursive: true
    });
    await fs.writeFile(path.join(root, relative), "baseline\n");
    await writeCollection(root, [{ id: "one" }]);
    initializeGit(root);
    const options = {
      workspaceRoot: root,
      reportIds: ["one"],
      scope: "domain" as const
    };
    await fs.writeFile(path.join(root, relative), "changed\n");
    const written = await stageInvestigationReports(options);
    assert.equal(written.status, "ok");
    assert.deepEqual(written.writtenPaths, [relative]);
    assert.equal(git(root, ["show", `:${relative}`]), "changed\n");
    await fs.rm(path.join(root, relative));
    const deleted = await stageInvestigationReports(options);
    assert.equal(deleted.status, "ok");
    assert.deepEqual(deleted.writtenPaths, [relative]);
    assert.equal(
      git(root, ["diff", "--cached", "--name-status"]),
      `D\t${relative}\n`
    );
  });
});

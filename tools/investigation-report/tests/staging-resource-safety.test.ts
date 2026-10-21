import { readOwnedResourceFixture } from "./resource-phase-test-support.ts";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { stageInvestigationReports } from "../src/staging.ts";
import { git, initializeGit } from "./git-support.ts";
import { investigationRoot, withTempRoot } from "./fixture-support.ts";
import { writeCollection } from "./collection-support.ts";

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

async function prepareUnreferencedResource(
  root: string,
  recorded = true
): Promise<void> {
  await fs.mkdir(path.dirname(path.join(root, resourceRelative)), {
    recursive: true
  });
  await fs.writeFile(path.join(root, resourceRelative), "baseline bytes\n");
  if (recorded) await writeCollection(root, [{ id: "one" }, { id: "other" }]);
  if (recorded) initializeGit(root);
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
  test(`owned resource validation rejects initial unreferenced symlink at ${component}`, async () => {
    await withTempRoot("resource-initial-symlink", async (root) => {
      await prepareUnreferencedResource(root, false);
      await replaceWithSymlink(root, component, "external replacement bytes\n");
      const observed = await observeResourceReads(root, async () => {
        await assert.rejects(readOwnedResourceFixture(root, resourceRelative));
      });
      assert.equal(
        observed.reads,
        0,
        "unsafe paths must fail before external bytes"
      );
    });
  });
}

for (const component of ["root", "owner", "intermediate", "file"]) {
  test(`owned resource validation rejects same-byte symlink replacement at ${component} between phases`, async () => {
    await withTempRoot("resource-phase-symlink", async (root) => {
      if (component === "file") {
        await prepareUnreferencedResource(root);
        const before = await fs.readFile(path.join(root, ".git/index"));
        const observed = await observeResourceReads(
          root,
          () =>
            stageInvestigationReports({
              workspaceRoot: root,
              reportIds: ["one"],
              scope: "domain"
            }),
          () => replaceWithSymlink(root, component, "baseline bytes\n")
        );
        assert.equal(observed.result.status, "error");
        assert.equal(observed.result.state, "source-drift");
        assert.equal(observed.reads, 1);
        assert.deepEqual(
          await fs.readFile(path.join(root, ".git/index")),
          before
        );
        return;
      }
      await prepareUnreferencedResource(root, false);
      const observed = await observeResourceReads(
        root,
        async () => {
          assert.equal(
            await readOwnedResourceFixture(root, resourceRelative),
            "baseline bytes\n"
          );
          await assert.rejects(
            readOwnedResourceFixture(root, resourceRelative)
          );
        },
        () => replaceWithSymlink(root, component, "baseline bytes\n")
      );
      assert.equal(
        observed.reads,
        1,
        "fresh validation must not reread through replacement"
      );
    });
  });
}

for (const component of ["root", "owner", "intermediate", "file"]) {
  test(`owned resource deletion handles missing ${component} components`, async () => {
    await withTempRoot("stage-resource-safe-deletion", async (root) => {
      await prepareUnreferencedResource(root, false);
      await fs.rm(componentPath(root, component), { recursive: true });
      assert.equal(
        await readOwnedResourceFixture(root, resourceRelative),
        null
      );
    });
  });
}

for (const component of ["root", "owner"]) {
  test(`owned resource validation rejects empty ${component} symlink without direct references or HEAD members`, async () => {
    await withTempRoot("resource-empty-symlink", async (root) => {
      await fs.mkdir(investigationRoot(root), { recursive: true });
      const external = path.join(root, "external-empty");
      await fs.mkdir(external);
      const target = componentPath(root, component);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.symlink(external, target);
      await assert.rejects(readOwnedResourceFixture(root, null));
    });
  });
}

test("owned resource validation ignores unrelated symlink trees without inspecting their contents", async () => {
  await withTempRoot("stage-resource-unrelated-symlink", async (root) => {
    await prepareUnreferencedResource(root, false);
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
      assert.equal(
        await readOwnedResourceFixture(root, resourceRelative),
        "selected changed bytes\n"
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

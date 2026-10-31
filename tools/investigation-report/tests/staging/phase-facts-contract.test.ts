import { prepareInvestigationResourceRoot } from "../../src/resources/resource-root.ts";
import {
  inspectOwnedInvestigationResources,
  inspectDirectInvestigationResource
} from "../../src/resources/resource-file-validation.ts";
import {
  expectResourceRejectionBeforeBytes,
  readOwnedResourceFixture
} from "../resources/phases/resource-phase-test-support.ts";
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs/promises";
import path from "node:path";
import { ResourceDirectoryFacts } from "../../src/resources/resource-directory-facts.ts";
import { investigationRoot, withTempRoot } from "../support/fixture-support.ts";
import { writeCollection } from "../support/collection-support.ts";

const resource = "docs/investigations/_resources/one/nested/member.txt";
async function prepare(root: string): Promise<void> {
  await fs.mkdir(path.dirname(path.join(root, resource)), { recursive: true });
  await fs.writeFile(path.join(root, resource), "same original bytes\n");
}

for (const component of ["root", "owner", "intermediate", "file"]) {
  test(`directory facts reject same-phase selected resource ${component} replacement before bytes`, async () => {
    await withTempRoot("phase-resource-replacement", async (root) => {
      await prepare(root);
      const resources = path.join(investigationRoot(root), "_resources");
      const target =
        component === "root"
          ? resources
          : component === "owner"
            ? path.join(resources, "one")
            : component === "intermediate"
              ? path.join(resources, "one/nested")
              : path.join(root, resource);
      const trigger = component === "file" ? path.dirname(target) : target;
      const external = path.join(root, "external");
      const suffix =
        component === "root"
          ? "one/nested/member.txt"
          : component === "owner"
            ? "nested/member.txt"
            : component === "intermediate"
              ? "member.txt"
              : "";
      await fs.mkdir(
        path.dirname(suffix ? path.join(external, suffix) : external),
        { recursive: true }
      );
      await fs.writeFile(
        suffix ? path.join(external, suffix) : external,
        "same original bytes\n"
      );
      const readdir = fs.readdir;
      let replaced = false;
      fs.readdir = (async (...args: Parameters<typeof fs.readdir>) => {
        const entries = await readdir(...args);
        if (args[0] === trigger && !replaced) {
          replaced = true;
          await fs.rename(target, path.join(root, "saved-component"));
          await fs.symlink(external, target);
        }
        return entries;
      }) as typeof fs.readdir;
      try {
        await expectResourceRejectionBeforeBytes(
          root,
          resource,
          () => replaced
        );
      } finally {
        fs.readdir = readdir;
      }
    });
  });
}

for (const activity of ["add", "remove"]) {
  test(`directory facts allow same-phase unrelated owner ${activity} without inspecting its tree`, async () => {
    await withTempRoot("phase-unrelated-owner", async (root) => {
      await prepare(root);
      const resources = path.join(investigationRoot(root), "_resources");
      const unrelated = path.join(resources, "unrelated");
      if (activity === "remove") await fs.mkdir(unrelated);
      await fs.writeFile(path.join(root, resource), "selected update\n");
      const original = fs.readdir,
        lstat = fs.lstat;
      let changed = false;
      fs.readdir = (async (...args: Parameters<typeof fs.readdir>) => {
        assert.notEqual(args[0], unrelated);
        const entries = await original(...args);
        if (args[0] === resources && !changed) {
          changed = true;
          if (activity === "add") await fs.mkdir(unrelated);
          else await fs.rmdir(unrelated);
        }
        return entries;
      }) as typeof fs.readdir;
      fs.lstat = (async (...args: Parameters<typeof fs.lstat>) => {
        assert.notEqual(args[0], unrelated);
        return await lstat(...args);
      }) as typeof fs.lstat;
      try {
        const bytes = await readOwnedResourceFixture(root, resource);
        assert.equal(changed, true);
        assert.equal(bytes, "selected update\n");
      } finally {
        fs.readdir = original;
        fs.lstat = lstat;
      }
    });
  });
}

test("directory facts remember absent and casefold matches when refreshing related namespaces", async () => {
  await withTempRoot("phase-related-name", async (root) => {
    const resources = path.join(investigationRoot(root), "_resources");
    await fs.mkdir(resources, { recursive: true });
    const facts = await ResourceDirectoryFacts.create(resources);
    assert.equal(await facts.entry(resources, "deleted-owner"), null);
    await fs.mkdir(path.join(resources, "Deleted-Owner"));
    await assert.rejects(
      facts.assertCurrent(),
      /related resource path name changed/u
    );
    const fresh = await ResourceDirectoryFacts.create(resources);
    assert.equal(
      (await fresh.entry(resources, "deleted-owner"))?.name,
      "Deleted-Owner"
    );
    await fs.rename(
      path.join(resources, "Deleted-Owner"),
      path.join(resources, "DELETED-OWNER")
    );
    await assert.rejects(
      fresh.assertCurrent(),
      /related resource path name changed/u
    );
  });
});

test("directory facts allow same-phase direct dependency sibling activity while preserving the referenced path", async () => {
  await withTempRoot("phase-direct-sibling", async (root) => {
    const directory = investigationRoot(root);
    const owner = path.join(directory, "_resources/other");
    await fs.mkdir(owner, { recursive: true });
    await fs.writeFile(path.join(owner, "shared.txt"), "shared\n");
    await writeCollection(root, [
      { id: "one", resources: ["other/shared.txt"] },
      { id: "other", resources: ["other/shared.txt"] }
    ]);
    const original = fs.readdir;
    let changed = false;
    fs.readdir = (async (...args: Parameters<typeof fs.readdir>) => {
      const entries = await original(...args);
      if (args[0] === owner && !changed) {
        changed = true;
        await fs.writeFile(path.join(owner, "unrelated.txt"), "sibling\n");
      }
      return entries;
    }) as typeof fs.readdir;
    try {
      const prepared = await prepareInvestigationResourceRoot(directory, {
        mode: "version-control",
        files: new Set(["other/shared.txt"])
      });
      assert.equal(prepared.status, "ready");
      if (prepared.status !== "ready") assert.fail("resource root unavailable");
      const inspected = await inspectDirectInvestigationResource(
        prepared,
        "other/shared.txt"
      );
      await prepared.directories.assertCurrent();
      assert.equal(changed, true);
      assert.deepEqual(inspected.errors, []);
    } finally {
      fs.readdir = original;
    }
  });
});

test("directory facts enumerate each stable selected directory once per phase with literal filenames", async () => {
  await withTempRoot("phase-name-index", async (root) => {
    const directory = investigationRoot(root),
      owner = path.join(directory, "_resources/one");
    await fs.mkdir(owner, { recursive: true });
    for (let i = 0; i < 12; i += 1)
      await fs.writeFile(path.join(owner, `member ${i}.txt`), `unique ${i}\n`);
    await writeCollection(root, [{ id: "one" }]);
    const original = fs.readdir;
    const counts = new Map<string, number>();
    fs.readdir = (async (...args: Parameters<typeof fs.readdir>) => {
      const target = String(args[0]);
      counts.set(target, (counts.get(target) ?? 0) + 1);
      return await original(...args);
    }) as typeof fs.readdir;
    try {
      const members = Array.from(
        { length: 12 },
        (_, i) => `one/member ${i}.txt`
      );
      for (let phase = 0; phase < 2; phase += 1) {
        const prepared = await prepareInvestigationResourceRoot(directory, {
          mode: "version-control",
          files: new Set(members)
        });
        assert.equal(prepared.status, "ready");
        if (prepared.status !== "ready")
          assert.fail("resource root unavailable");
        const inspected = await inspectOwnedInvestigationResources(
          prepared,
          ["one"],
          members
        );
        assert.deepEqual(inspected.errors, []);
        await prepared.directories.assertCurrent();
      }
      assert.equal(counts.get(path.dirname(owner)), 2);
      assert.equal(counts.get(owner), 2);
    } finally {
      fs.readdir = original;
    }
  });
});

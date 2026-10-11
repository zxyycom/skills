import { expectResourceRejectionBeforeBytes } from "./resource-phase-test-support.ts";
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs/promises";
import path from "node:path";
import { stageInvestigationReports } from "../src/staging.ts";
import { runInvestigationReportCheckCli } from "../src/cli.ts";
import { ResourceDirectoryFacts } from "../src/resource-directory-facts.ts";
import {
  git,
  initializeGit,
  investigationRoot,
  withTempRoot,
  writeCollection
} from "./v6-support.ts";

const resource = "docs/investigations/_resources/one/nested/member.txt";
async function prepare(root: string): Promise<void> {
  await fs.mkdir(path.dirname(path.join(root, resource)), { recursive: true });
  await fs.writeFile(path.join(root, resource), "same original bytes\n");
  await writeCollection(root, [{ id: "one" }, { id: "other" }]);
  initializeGit(root);
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
        const result = await stageInvestigationReports({
          workspaceRoot: root,
          reportIds: ["one"],
          scope: "domain"
        });
        assert.equal(changed, true);
        assert.equal(result.status, "ok");
        assert.deepEqual(result.status === "ok" ? result.writtenPaths : [], [
          resource
        ]);
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
    initializeGit(root);
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
      const result = await stageInvestigationReports({
        workspaceRoot: root,
        reportIds: ["one"],
        scope: "domain"
      });
      assert.equal(changed, true);
      assert.equal(result.status, "ok");
      assert.equal(git(root, ["diff", "--cached", "--name-only"]), "");
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
    initializeGit(root);
    const original = fs.readdir;
    const counts = new Map<string, number>();
    fs.readdir = (async (...args: Parameters<typeof fs.readdir>) => {
      const target = String(args[0]);
      counts.set(target, (counts.get(target) ?? 0) + 1);
      return await original(...args);
    }) as typeof fs.readdir;
    try {
      const result = await stageInvestigationReports({
        workspaceRoot: root,
        reportIds: ["one"],
        scope: "domain"
      });
      assert.equal(result.status, "ok");
      assert.equal(counts.get(path.dirname(owner)), 2);
      assert.equal(counts.get(owner), 2);
    } finally {
      fs.readdir = original;
    }
  });
});

test("investigation stage second-phase read failure retains private-safe category operation target and recovery", async () => {
  await withTempRoot("phase-failure-facts", async (root) => {
    await writeCollection(root, [{ id: "one" }]);
    initializeGit(root);
    const source = path.join(investigationRoot(root), "one.md");
    const before = await fs.readFile(path.join(root, ".git/index"));
    const original = fs.readFile;
    let reads = 0,
      stdout = "",
      stderr = "";
    fs.readFile = (async (...args: Parameters<typeof fs.readFile>) => {
      if (args[0] === source && ++reads === 2)
        throw Object.assign(
          new Error(
            "denied /private/source token=ghp_123456789012345678901234567890"
          ),
          { code: "EACCES" }
        );
      return await original(...args);
    }) as typeof fs.readFile;
    try {
      const exit = await runInvestigationReportCheckCli(
        ["--root", root, "stage", "one", "--scope", "domain"],
        {
          io: {
            stdout: (value) => {
              stdout += value;
            },
            stderr: (value) => {
              stderr += value;
            }
          }
        }
      );
      assert.equal(exit, 1);
      assert.equal(stdout, "");
      assert.match(stderr, /state: source-drift/u);
      assert.match(stderr, /causeCategory: access-denied/u);
      assert.match(stderr, /operation: read a workspace file/u);
      assert.match(stderr, /docs\/investigations\/one\.md/u);
      assert.match(stderr, /restore access required/u);
      assert.ok(!/private|ghp_|scope: Pending/u.test(stderr));
      assert.deepEqual(await original(path.join(root, ".git/index")), before);
    } finally {
      fs.readFile = original;
    }
  });
});

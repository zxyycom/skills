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

async function writeScript(
  root: string,
  owner: string,
  name: string,
  contents: string
): Promise<string> {
  const relative = `docs/investigations/_resources/${owner}/${name}`;
  const absolute = path.join(root, relative);
  await fs.mkdir(path.dirname(absolute), { recursive: true });
  await fs.writeFile(absolute, contents, "utf8");
  return relative;
}

async function assertUnselectedRepresentationsPreserved(
  scope: "all" | "domain"
): Promise<void> {
  await withTempRoot("stage-unselected-modes", async (root) => {
    const measure = await writeScript(
      root,
      "second",
      "measure.sh",
      "measure\n"
    );
    const summarize = await writeScript(
      root,
      "second",
      "summarize.py",
      "summarize\n"
    );
    await writeCollection(root, [
      { id: "first" },
      { id: "second", resources: ["second/measure.sh", "second/summarize.py"] }
    ]);
    initializeGit(root);
    git(root, ["update-index", "--chmod=+x", measure, summarize]);
    const link = "docs/investigations/_resources/second/link";
    const objectId = git(root, ["rev-parse", `:${measure}`]).trim();
    git(root, [
      "update-index",
      "--add",
      "--cacheinfo",
      `120000,${objectId},${link}`
    ]);
    const before = git(root, [
      "ls-files",
      "--stage",
      "--",
      measure,
      summarize,
      link
    ]);
    await writeCollection(root, [
      { id: "first", title: "Changed" },
      { id: "second", resources: ["second/measure.sh", "second/summarize.py"] }
    ]);
    const result = await stageInvestigationReports({
      reportIds: ["first"],
      scope,
      workspaceRoot: root
    });
    assert.equal(result.status, "ok");
    assert.equal(result.changed, true);
    assert.deepEqual(
      result.preservedPendingPaths,
      [link, measure, summarize].sort()
    );
    assert.equal(
      git(root, ["ls-files", "--stage", "--", measure, summarize, link]),
      before
    );
    assert.match(
      git(root, ["show", ":docs/investigations/first.md"]),
      /Changed/u
    );
  });
}

test("stage --scope all preserves unselected executable and symlink pending representations", async () => {
  await assertUnselectedRepresentationsPreserved("all");
});

test("stage --scope domain preserves unselected executable and symlink pending representations", async () => {
  await assertUnselectedRepresentationsPreserved("domain");
});

test(
  "stage preserves executable representation for modified and newly added owner scripts",
  { skip: process.platform === "win32" },
  async () => {
    await withTempRoot("stage-selected-executables", async (root) => {
      const measure = await writeScript(
        root,
        "first",
        "measure.sh",
        "before\n"
      );
      await fs.chmod(path.join(root, measure), 0o755);
      await writeCollection(root, [
        { id: "first", resources: ["first/measure.sh"] }
      ]);
      initializeGit(root);
      git(root, ["config", "core.fileMode", "true"]);
      await writeScript(root, "first", "measure.sh", "after\n");
      const summarize = await writeScript(
        root,
        "first",
        "summarize.py",
        "new\n"
      );
      await fs.chmod(path.join(root, summarize), 0o755);
      const result = await stageInvestigationReports({
        reportIds: ["first"],
        scope: "all",
        workspaceRoot: root
      });
      assert.equal(result.status, "ok");
      assert.deepEqual(result.writtenPaths, [measure, summarize]);
      assert.match(
        git(root, ["ls-files", "--stage", "--", measure]),
        /^100755 /u
      );
      assert.match(
        git(root, ["ls-files", "--stage", "--", summarize]),
        /^100755 /u
      );
      assert.equal(git(root, ["show", `:${measure}`]), "after\n");
      assert.equal(git(root, ["show", `:${summarize}`]), "new\n");
    });
  }
);

test(
  "stage reports executable-bit-only changes and an unchanged repeat",
  { skip: process.platform === "win32" },
  async () => {
    await withTempRoot("stage-mode-only", async (root) => {
      const script = await writeScript(root, "first", "measure.sh", "same\n");
      await writeCollection(root, [
        { id: "first", resources: ["first/measure.sh"] }
      ]);
      initializeGit(root);
      git(root, ["config", "core.fileMode", "true"]);
      await fs.chmod(path.join(root, script), 0o755);
      const options = {
        reportIds: ["first"],
        scope: "domain" as const,
        workspaceRoot: root
      };
      const first = await stageInvestigationReports(options);
      assert.equal(first.status, "ok");
      assert.equal(first.changed, true);
      assert.deepEqual(first.writtenPaths, [script]);
      assert.match(
        git(root, ["diff", "--cached", "--summary"]),
        /mode change 100644 => 100755/u
      );
      const second = await stageInvestigationReports(options);
      assert.equal(second.status, "ok");
      assert.equal(second.changed, false);
      assert.deepEqual(second.writtenPaths, []);
      await fs.chmod(path.join(root, script), 0o644);
      const third = await stageInvestigationReports(options);
      assert.equal(third.status, "ok");
      assert.equal(third.changed, true);
      assert.deepEqual(third.writtenPaths, [script]);
      assert.match(
        git(root, ["ls-files", "--stage", "--", script]),
        /^100644 /u
      );
    });
  }
);

test(
  "stage rejects executable-bit source drift before publishing pending",
  { skip: process.platform === "win32" },
  async () => {
    await withTempRoot("stage-mode-drift", async (root) => {
      const script = await writeScript(root, "first", "measure.sh", "same\n");
      await writeCollection(root, [
        { id: "first", resources: ["first/measure.sh"] }
      ]);
      initializeGit(root);
      git(root, ["config", "core.fileMode", "true"]);
      const absolute = path.join(root, script);
      const descriptor = Object.getOwnPropertyDescriptor(fs, "readFile");
      assert.ok(descriptor);
      const readFile = fs.readFile.bind(fs);
      let reads = 0;
      Object.defineProperty(fs, "readFile", {
        ...descriptor,
        value: async (...args: Parameters<typeof readFile>) => {
          const bytes = await readFile(...args);
          if (args[0] === absolute && ++reads === 1)
            await fs.chmod(absolute, 0o755);
          return bytes;
        }
      });
      const before = await readFile(path.join(root, ".git", "index"));
      try {
        const result = await stageInvestigationReports({
          reportIds: ["first"],
          scope: "domain",
          workspaceRoot: root
        });
        assert.equal(result.status, "error");
        assert.equal(result.state, "source-drift");
      } finally {
        Object.defineProperty(fs, "readFile", descriptor);
      }
      assert.equal(reads, 2);
      assert.deepEqual(
        await fs.readFile(path.join(root, ".git", "index")),
        before
      );
    });
  }
);

test(
  "stage keeps rejecting selected symlink resource sources without pending writes",
  { skip: process.platform === "win32" },
  async () => {
    await withTempRoot("stage-symlink-source", async (root) => {
      const script = await writeScript(root, "first", "measure.sh", "same\n");
      await writeCollection(root, [
        { id: "first", resources: ["first/measure.sh"] }
      ]);
      initializeGit(root);
      const link = path.join(
        investigationRoot(root),
        "_resources",
        "first",
        "link"
      );
      await fs.symlink("measure.sh", link);
      const before = await fs.readFile(path.join(root, ".git", "index"));
      const result = await stageInvestigationReports({
        reportIds: ["first"],
        scope: "domain",
        workspaceRoot: root
      });
      assert.equal(result.status, "error");
      assert.equal(result.state, "domain-stage-failed");
      assert.equal(
        result.diagnostics[0]?.code,
        "investigation-report.stage-source-read-failed"
      );
      assert.deepEqual(
        await fs.readFile(path.join(root, ".git", "index")),
        before
      );
      assert.equal(git(root, ["show", `:${script}`]), "same\n");
    });
  }
);

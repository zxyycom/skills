import {
  verifyDomainWrites,
  type DomainWritesAcquisition
} from "../src/staging-domain-writes.ts";
import { domainFailure } from "../src/staging-domain-failures.ts";
import { domainStageControl } from "../src/staging-domain-context.ts";
import { prepareInvestigationResourceRoot } from "../src/resource-root.ts";
import { inspectOwnedInvestigationResources } from "../src/resource-file-validation.ts";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { stageInvestigationReports } from "../src/staging.ts";
import { git, initializeGit } from "./git-support.ts";
import { investigationRoot, withTempRoot } from "./fixture-support.ts";
import { writeCollection } from "./collection-support.ts";

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

test("domain phase comparison rejects executable representation drift with identical bytes", () => {
  const file = {
    path: "docs/investigations/_resources/first/measure.sh",
    kind: "regular" as const,
    data: Buffer.from("same\n")
  };
  const expected: DomainWritesAcquisition = {
    status: "ok",
    sourceFiles: [file],
    value: [file],
    pending: { pathScope: "docs/investigations", files: [], members: [] }
  };
  const executable = { ...file, kind: "executable" as const };
  assert.deepEqual(verifyDomainWrites(expected, expected), { status: "ok" });
  assert.deepEqual(executable.data, file.data);
  const result = verifyDomainWrites(expected, {
    ...expected,
    sourceFiles: [executable],
    value: [executable]
  });
  assert.equal(result.status, "drift");
  if (result.status !== "drift")
    assert.fail("executable source drift was accepted");
  assert.match(result.reason, /bytes or representation changed/u);
});

test(
  "owned resource validation rejects selected symlink sources before byte reads",
  { skip: process.platform === "win32" },
  async () => {
    await withTempRoot("stage-symlink-source", async (root) => {
      const script = await writeScript(root, "first", "measure.sh", "same\n");
      await writeCollection(root, [
        { id: "first", resources: ["first/measure.sh"] }
      ]);
      await fs.symlink(
        "measure.sh",
        path.join(investigationRoot(root), "_resources/first/link")
      );
      const prepared = await prepareInvestigationResourceRoot(
        investigationRoot(root),
        {
          mode: "version-control",
          files: new Set(["first/measure.sh", "first/link"])
        }
      );
      assert.equal(prepared.status, "ready");
      if (prepared.status !== "ready") assert.fail("resource root unavailable");
      const original = fs.readFile;
      let reads = 0;
      fs.readFile = (async (...args: Parameters<typeof fs.readFile>) => {
        if (
          args[0] === path.join(root, script) ||
          args[0] ===
            path.join(investigationRoot(root), "_resources/first/link")
        )
          reads += 1;
        return await original(...args);
      }) as typeof fs.readFile;
      try {
        const inspected = await inspectOwnedInvestigationResources(
          prepared,
          ["first"],
          ["first/measure.sh", "first/link"]
        );
        assert.ok(
          inspected.errors.some((error) => error.includes("symbolic link"))
        );
        const result = domainFailure(
          domainStageControl({
            investigationsDirectory: investigationRoot(root),
            reportIds: ["first"],
            scope: "domain"
          }),
          "source-read-failed",
          new Error(inspected.errors.join("; "))
        );
        assert.equal(result.status, "error");
        assert.equal(result.state, "domain-stage-failed");
        assert.equal(
          result.diagnostics[0]?.code,
          "investigation-report.stage-source-read-failed"
        );
        assert.equal(reads, 0);
      } finally {
        fs.readFile = original;
      }
      assert.equal(
        await fs.readFile(path.join(root, script), "utf8"),
        "same\n"
      );
    });
  }
);

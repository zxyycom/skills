import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  readSkillPackageSnapshotVersionBaseline,
  readSkillPackageSnapshotVersionBaselineFromRepository,
  type SkillPackageSnapshot
} from "../skill-package-hash.ts";
import {
  alphaBaselineFiles,
  createBaselineRepository,
  createSkillRepositoryFixture,
  gitTestOptions,
  runGit,
  skillFile,
  skillMarkdown,
  skillPackageSnapshot,
  withTempRoot
} from "./skill-package-hash-test-support.ts";

test("baseline comparison prepares bounded eligible windows and defers unconsumed errors", async () => {
  const baselineFiles = {
    ...alphaBaselineFiles(),
    ...Object.fromEntries(
      Array.from({ length: 100 }, (_, i) => [
        `skills/alpha/file-${String(i).padStart(3, "0")}.txt`,
        "base\n"
      ])
    ),
    "skills/alpha/node_modules/ignored.js": "not a package input"
  };
  const snapshot = skillPackageSnapshot(
    Object.fromEntries([
      ["SKILL.md", skillMarkdown("alpha", 3, "unchanged")],
      ...Array.from({ length: 100 }, (_, i) => [
        `file-${String(i).padStart(3, "0")}.txt`,
        i === 0 ? "changed\n" : "base\n"
      ])
    ])
  );
  const source = createBaselineRepository(baselineFiles);
  const prepared: string[][] = [];
  const consumed: string[] = [];
  const repository = {
    ...source,
    async prepareRevisionFileReads(revision: string, paths: readonly string[]) {
      prepared.push([...paths]);
      return paths.map((filePath) => async () => {
        consumed.push(filePath);
        if (filePath.endsWith("file-099.txt"))
          throw new Error("unconsumed failure");
        return await source.readRevisionFile(revision, filePath);
      });
    }
  };
  const result = await readSkillPackageSnapshotVersionBaselineFromRepository(
    snapshot,
    "baseline",
    repository
  );
  assert.deepEqual(result.skills, { alpha: 3 });
  assert.ok(prepared.length > 0 && prepared.length <= 2);
  assert.ok(consumed.includes("skills/alpha/file-000.txt"));
  assert.ok(consumed.includes("skills/alpha/SKILL.md"));
  assert.ok(
    prepared.every(
      (paths) =>
        paths.length <= 32 &&
        paths.every((filePath) => !filePath.includes("node_modules/"))
    )
  );
  assert.ok(!consumed.some((filePath) => filePath.endsWith("file-099.txt")));
});

test(
  "version baseline consumer batches real Git blob reads across eligible unchanged files",
  gitTestOptions,
  async () => {
    await withTempRoot(async (tempRoot) => {
      const { repositoryRoot, alphaDirectory } =
        await createSkillRepositoryFixture(tempRoot);
      runGit(repositoryRoot, ["reset", "--hard", "HEAD"]);
      const contents = Object.fromEntries(
        Array.from({ length: 80 }, (_, i) => [
          `bulk-${String(i).padStart(3, "0")}.txt`,
          `payload-${i}\n`
        ])
      );
      for (const [filePath, data] of Object.entries(contents))
        await fs.writeFile(path.join(alphaDirectory, filePath), data);
      runGit(repositoryRoot, ["add", "skills/alpha"]);
      runGit(repositoryRoot, ["commit", "--quiet", "-m", "baseline payloads"]);
      const snapshot: SkillPackageSnapshot = {
        skills: [{ name: "alpha", directory: alphaDirectory }],
        filesBySkill: new Map([
          [
            "alpha",
            Object.entries(contents).map(([filePath, data]) =>
              skillFile(filePath, data)
            )
          ]
        ])
      };
      const trace = path.join(tempRoot, "baseline-trace.jsonl");
      const previous = process.env.GIT_TRACE2_EVENT;
      process.env.GIT_TRACE2_EVENT = trace;
      try {
        await readSkillPackageSnapshotVersionBaseline(
          snapshot,
          "HEAD",
          repositoryRoot
        );
      } finally {
        if (previous === undefined) delete process.env.GIT_TRACE2_EVENT;
        else process.env.GIT_TRACE2_EVENT = previous;
      }
      const starts = (await fs.readFile(trace, "utf8"))
        .split("\n")
        .filter((line) => line.includes('"event":"start"'));
      assert.ok(
        starts.filter((line) => line.includes('"cat-file"')).length <= 4
      );
      assert.ok(
        starts.filter((line) => line.includes('"ls-tree"')).length <= 5
      );
    });
  }
);

test(
  "version baseline consumer ignores a later corrupt Git blob after an earlier change",
  gitTestOptions,
  async () => {
    await withTempRoot(async (tempRoot) => {
      const { repositoryRoot, alphaDirectory } =
        await createSkillRepositoryFixture(tempRoot);
      runGit(repositoryRoot, ["reset", "--hard", "HEAD"]);
      await fs.writeFile(
        path.join(alphaDirectory, "a-changed.txt"),
        "original\n"
      );
      await fs.writeFile(
        path.join(alphaDirectory, "z-corrupt.txt"),
        "later blob\n"
      );
      runGit(repositoryRoot, ["add", "skills/alpha"]);
      runGit(repositoryRoot, [
        "commit",
        "--quiet",
        "-m",
        "baseline short circuit"
      ]);
      const object = runGit(repositoryRoot, [
        "rev-parse",
        "HEAD:skills/alpha/z-corrupt.txt"
      ]).trim();
      const objectPath = path.join(
        repositoryRoot,
        ".git",
        "objects",
        object.slice(0, 2),
        object.slice(2)
      );
      await fs.chmod(objectPath, 0o666);
      await fs.writeFile(objectPath, "corrupt");
      const snapshot: SkillPackageSnapshot = {
        skills: [{ name: "alpha", directory: alphaDirectory }],
        filesBySkill: new Map([
          [
            "alpha",
            [
              skillFile("a-changed.txt", "changed\n"),
              skillFile("z-corrupt.txt", "later blob\n")
            ]
          ]
        ])
      };
      const result = await readSkillPackageSnapshotVersionBaseline(
        snapshot,
        "HEAD",
        repositoryRoot
      );
      assert.deepEqual(result.skills, { alpha: 3 });
    });
  }
);
